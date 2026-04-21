import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../shared/env";
import { BedrockService } from "./bedrock-service";
import { BlogPipeline } from "./blog-pipeline";
import { MetadataRepository } from "./metadata-repository";
import { BlogStorageService } from "./storage-service";

export function createRuntime() {
  const config = getConfig();
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: {
      removeUndefinedValues: true
    }
  });

  const repository = new MetadataRepository(documentClient, config.blogTableName, config.statusIndexName);
  const storage = new BlogStorageService(new S3Client({}), config.blogBucketName);
  const bedrock = new BedrockService(new BedrockRuntimeClient({ region: config.bedrockRegion }), config);
  const pipeline = new BlogPipeline({
    bedrock,
    config,
    repository,
    storage
  });

  return {
    config,
    pipeline,
    repository
  };
}
