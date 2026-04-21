#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BlogAutomationStack } from "../lib/blog-automation-stack";

const app = new cdk.App();

new BlogAutomationStack(app, process.env.STACK_NAME ?? "AwsBlogAutomationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1"
  },
  description:
    "AWS-native automated blog generation pipeline powered by Bedrock, Lambda, S3, DynamoDB, and EventBridge Scheduler."
});
