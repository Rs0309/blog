# Setup Guide

## 1. Prerequisites

- An AWS account in a region where your chosen Bedrock text and image models are available.
- Amazon Bedrock model access enabled for:
  - `amazon.nova-pro-v1:0` for text
  - `amazon.titan-image-generator-v2:0` for images
- A GitHub repository containing this project.
- An IAM user or role whose access key and secret key will be stored in GitHub Secrets.

## 2. Recommended Regions

- Deploy the stack in `us-east-1` unless you have a strong reason not to.
- Keep `BEDROCK_REGION` set to a region that supports both your text model and image model.
- If you keep the default models in this project, `us-east-1` is the safest starting point.

## 3. GitHub Secrets

Create these repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## 4. GitHub Variables

Create these repository variables:

- `AWS_REGION`
  Example: `us-east-1`
- `BEDROCK_REGION`
  Example: `us-east-1`
- `STACK_NAME`
  Example: `AwsBlogAutomationStack`
- `SCHEDULE_TIMEZONE`
  Example: `Asia/Kolkata`
- `DAILY_SCHEDULE_EXPRESSION`
  Example: `cron(0 8 * * ? *)`
- `BOOTSTRAP_DELAY_MINUTES`
  Example: `10`
- `BLOG_BRAND_NAME`
  Example: `Cloud Scale Daily`
- `BLOG_AUTHOR_NAME`
  Example: `Editorial Team`
- `BLOG_TONE`
  Example: `Confident, practical, senior-engineer friendly`
- `BLOG_CATEGORY_THEMES`
  Example: `Cloud Computing, Serverless, DevOps Automation, AWS Cost Optimization, Platform Engineering`
- `TEXT_MODEL_ID`
  Example: `amazon.nova-pro-v1:0`
- `IMAGE_MODEL_ID`
  Example: `amazon.titan-image-generator-v2:0`
- `SITE_BASE_URL`
  Optional. Example: `https://example.com/blog`
- `PUBLIC_ASSET_BASE_URL`
  Optional override. Example: `https://cdn.example.com`

## 5. IAM Permissions

### GitHub Actions deploy principal

The GitHub Actions credentials need enough permission to bootstrap and deploy the CDK stack. A practical starting policy is:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "dynamodb:*",
        "lambda:*",
        "logs:*",
        "scheduler:*",
        "s3:*",
        "sqs:*",
        "ssm:GetParameter",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "iam:DetachRolePolicy",
        "iam:GetRole",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": "*"
    }
  ]
}
```

If you already have a tightly governed AWS environment, scope those permissions down to your stack naming convention and deployment region.

### Lambda execution permissions

This project provisions Lambda permissions in CDK. The runtime role includes access for:

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:Query`
- `dynamodb:TransactWriteItems`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`

### EventBridge Scheduler invoke role

The Scheduler role needs:

- `lambda:InvokeFunction`

## 6. First-Time Deployment

1. Push this repository to your GitHub repo.
2. Add the GitHub Secrets and Variables listed above.
3. Enable Bedrock model access in AWS for the chosen models.
4. Trigger the GitHub Actions workflow manually with `workflow_dispatch`, or push to `main`.
5. The workflow will:
   - install dependencies
   - type-check the code
   - run unit tests
   - configure AWS credentials
   - bootstrap the CDK environment
   - synthesize the stack
   - deploy the stack

## 7. Day 1 Bootstrap Behavior

- The stack creates a one-time EventBridge Scheduler schedule.
- By default, it fires 10 minutes after deployment.
- It generates posts until the published count reaches `BOOTSTRAP_POST_COUNT`.
- The flow is idempotent enough for practical retries because it checks current published count before generating additional posts.

If you want the bootstrap run at a precise wall-clock time, set:

- `BOOTSTRAP_AT`
  Example: `2026-04-21T09:30:00`
- `SCHEDULE_TIMEZONE`
  Example: `Asia/Kolkata`

## 8. Daily Rotation Behavior

- The recurring scheduler triggers the daily Lambda once per day.
- The Lambda generates 1 new post.
- It then archives the oldest published post by:
  - copying the markdown and image from `published/` to `archive/`
  - deleting the old published objects
  - updating the metadata status in DynamoDB to `archived`
- The handler keeps simple state in DynamoDB so the same day is not processed twice under normal retries.

## 9. Accessing Generated Content

Generated images and published asset files land in S3:

- `published/posts/<slug>/index.md`
- `published/images/<slug>/featured.png`
- `archive/posts/<slug>/index.md`
- `archive/images/<slug>/featured.png`
- `published/posts-manifest.json`

Full blog records, including the generated markdown body and public image URL, are stored in DynamoDB.

After deployment, use the stack outputs:

- `PublicPostsApiUrl`
  Public endpoint base. Fetch `GET <url>posts` for the list and `GET <url>posts/<slug>` for a post.
- `BlogAssetsDistributionUrl`
  Public CloudFront base URL for generated images and published assets.

## 10. Operational Recommendations

- Put CloudFront in front of the S3 bucket if you want public asset URLs.
- Keep the bucket private and use signed access unless you explicitly need public delivery.
- Add CloudWatch alarms for Lambda errors and Scheduler DLQ depth in production.
- If you later want stronger workflow orchestration for large bootstrap batches, upgrade the Day 1 flow to SQS or Step Functions without changing the storage model.

## 11. Local Development

```bash
npm install
npm run build
npm test
npx cdk synth
```
