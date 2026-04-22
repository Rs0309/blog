import * as path from "node:path";
import { Aws, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

const STATUS_INDEX_NAME = "status-index";

function envOrDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolveBootstrapTimestamp(delayMinutes: number): string {
  return new Date(Date.now() + delayMinutes * 60_000).toISOString().slice(0, 19);
}

function toModelArn(region: string, modelIdOrArn: string): string {
  if (modelIdOrArn.startsWith("arn:")) {
    return modelIdOrArn;
  }

  return `arn:${Aws.PARTITION}:bedrock:${region}::foundation-model/${modelIdOrArn}`;
}

export class BlogAutomationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const scheduleTimezone = envOrDefault("SCHEDULE_TIMEZONE", "UTC");
    const bedrockRegion = envOrDefault("BEDROCK_REGION", Stack.of(this).region);
    const textModelId = envOrDefault("TEXT_MODEL_ID", "amazon.nova-pro-v1:0");
    const imageModelId = envOrDefault("IMAGE_MODEL_ID", "amazon.titan-image-generator-v2:0");
    const bootstrapDelayMinutes = Number(envOrDefault("BOOTSTRAP_DELAY_MINUTES", "10"));
    const explicitBootstrapAt = optionalTrimmedEnv("BOOTSTRAP_AT");
    const bootstrapAt = explicitBootstrapAt ?? resolveBootstrapTimestamp(bootstrapDelayMinutes);
    const dailyScheduleExpression = envOrDefault("DAILY_SCHEDULE_EXPRESSION", "cron(0 6 * * ? *)");

    const blogBucket = new s3.Bucket(this, "BlogAssetsBucket", {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    const blogAssetsDistribution = new cloudfront.Distribution(this, "BlogAssetsDistribution", {
      comment: "Public CDN for generated blog images and published assets",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(blogBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      defaultRootObject: "published/posts-manifest.json"
    });

    const publicAssetBaseUrl = optionalTrimmedEnv("PUBLIC_ASSET_BASE_URL") ?? `https://${blogAssetsDistribution.domainName}`;

    const metadataTable = new dynamodb.Table(this, "BlogMetadataTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
      removalPolicy: RemovalPolicy.RETAIN
    });

    metadataTable.addGlobalSecondaryIndex({
      indexName: STATUS_INDEX_NAME,
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const schedulerDlq = new sqs.Queue(this, "SchedulerDlq", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14)
    });

    schedulerDlq.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowSchedulerServiceToSendMessages",
        principals: [new iam.ServicePrincipal("scheduler.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [schedulerDlq.queueArn],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": Aws.ACCOUNT_ID
          }
        }
      })
    );

    const commonEnvironment = {
      BLOG_BUCKET_NAME: blogBucket.bucketName,
      BLOG_TABLE_NAME: metadataTable.tableName,
      STATUS_INDEX_NAME,
      BEDROCK_REGION: bedrockRegion,
      TEXT_MODEL_ID: textModelId,
      IMAGE_MODEL_ID: imageModelId,
      BLOG_BRAND_NAME: envOrDefault("BLOG_BRAND_NAME", "Cloud Scale Daily"),
      BLOG_AUTHOR_NAME: envOrDefault("BLOG_AUTHOR_NAME", "Editorial Team"),
      BLOG_TONE: envOrDefault("BLOG_TONE", "Confident, practical, senior-engineer friendly"),
      BLOG_CATEGORY_THEMES: envOrDefault(
        "BLOG_CATEGORY_THEMES",
        "Cloud Computing, Serverless, DevOps Automation, AWS Cost Optimization, Platform Engineering"
      ),
      SITE_BASE_URL: process.env.SITE_BASE_URL ?? "",
      PUBLIC_ASSET_BASE_URL: publicAssetBaseUrl,
      BOOTSTRAP_POST_COUNT: envOrDefault("BOOTSTRAP_POST_COUNT", "10"),
      MAX_PUBLISHED_POSTS: envOrDefault("MAX_PUBLISHED_POSTS", "10"),
      PUBLISHED_PREFIX: envOrDefault("PUBLISHED_PREFIX", "published"),
      ARCHIVE_PREFIX: envOrDefault("ARCHIVE_PREFIX", "archive"),
      MANIFEST_KEY: envOrDefault("MANIFEST_KEY", "published/posts-manifest.json"),
      IMAGE_WIDTH: envOrDefault("IMAGE_WIDTH", "1408"),
      IMAGE_HEIGHT: envOrDefault("IMAGE_HEIGHT", "768"),
      SCHEDULE_TIMEZONE: scheduleTimezone
    };

    const bootstrapFunction = new lambdaNodejs.NodejsFunction(this, "BootstrapGeneratorFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/bootstrap.ts"),
      handler: "handler",
      timeout: Duration.minutes(15),
      memorySize: 1536,
      environment: commonEnvironment,
      bundling: {
        target: "node20",
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true
      }
    });

    const dailyRotationFunction = new lambdaNodejs.NodejsFunction(this, "DailyRotationFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/daily-rotation.ts"),
      handler: "handler",
      timeout: Duration.minutes(15),
      memorySize: 1536,
      environment: commonEnvironment,
      bundling: {
        target: "node20",
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true
      }
    });

    const publicApiFunction = new lambdaNodejs.NodejsFunction(this, "PublicPostsApiFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/public-api.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: commonEnvironment,
      bundling: {
        target: "node20",
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true
      }
    });

    const adminApiFunction = new lambdaNodejs.NodejsFunction(this, "AdminBlogApiFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/admin-api.ts"),
      handler: "handler",
      timeout: Duration.minutes(15),
      memorySize: 1536,
      environment: commonEnvironment,
      bundling: {
        target: "node20",
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true
      }
    });

    const publicApiUrl = publicApiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["content-type"]
      }
    });

    const adminApiUrl = adminApiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["content-type"]
      }
    });

    blogBucket.grantReadWrite(bootstrapFunction);
    blogBucket.grantReadWrite(dailyRotationFunction);
    blogBucket.grantReadWrite(adminApiFunction);
    metadataTable.grantReadWriteData(bootstrapFunction);
    metadataTable.grantReadWriteData(dailyRotationFunction);
    metadataTable.grantReadData(publicApiFunction);
    metadataTable.grantReadWriteData(adminApiFunction);

    const bedrockPolicy = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [toModelArn(bedrockRegion, textModelId), toModelArn(bedrockRegion, imageModelId)]
    });

    bootstrapFunction.addToRolePolicy(bedrockPolicy);
    dailyRotationFunction.addToRolePolicy(bedrockPolicy);

    const schedulerInvokeRole = new iam.Role(this, "SchedulerInvokeLambdaRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com")
    });

    schedulerInvokeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [bootstrapFunction.functionArn, dailyRotationFunction.functionArn]
      })
    );

    const baseTargetConfig = {
      roleArn: schedulerInvokeRole.roleArn,
      deadLetterConfig: {
        arn: schedulerDlq.queueArn
      },
      retryPolicy: {
        maximumEventAgeInSeconds: 3600,
        maximumRetryAttempts: 3
      }
    };

    new scheduler.CfnSchedule(this, "BootstrapSchedule", {
      name: `${this.stackName}-bootstrap`,
      description: "Runs the one-time Day 1 bootstrap that fills the blog with the initial posts.",
      flexibleTimeWindow: {
        mode: "OFF"
      },
      scheduleExpression: `at(${bootstrapAt})`,
      scheduleExpressionTimezone: explicitBootstrapAt ? scheduleTimezone : undefined,
      target: {
        ...baseTargetConfig,
        arn: bootstrapFunction.functionArn,
        input: JSON.stringify({
          source: "eventbridge-scheduler",
          action: "bootstrap"
        })
      }
    });

    new scheduler.CfnSchedule(this, "DailyRotationSchedule", {
      name: `${this.stackName}-daily-rotation`,
      description: "Creates a new blog post each day and archives one older published post.",
      flexibleTimeWindow: {
        mode: "OFF"
      },
      scheduleExpression: dailyScheduleExpression,
      scheduleExpressionTimezone: scheduleTimezone,
      target: {
        ...baseTargetConfig,
        arn: dailyRotationFunction.functionArn,
        input: JSON.stringify({
          source: "eventbridge-scheduler",
          action: "daily-rotation"
        })
      }
    });

    new CfnOutput(this, "BlogAssetsBucketName", { value: blogBucket.bucketName });
    new CfnOutput(this, "BlogAssetsDistributionUrl", { value: publicAssetBaseUrl });
    new CfnOutput(this, "BlogMetadataTableName", { value: metadataTable.tableName });
    new CfnOutput(this, "BootstrapFunctionName", { value: bootstrapFunction.functionName });
    new CfnOutput(this, "DailyRotationFunctionName", { value: dailyRotationFunction.functionName });
    new CfnOutput(this, "PublicPostsApiUrl", { value: publicApiUrl.url });
    new CfnOutput(this, "AdminBlogApiUrl", { value: adminApiUrl.url });
    new CfnOutput(this, "BedrockRegion", { value: bedrockRegion });
  }
}
