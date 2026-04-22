# AWS Blog Automation

AWS-native automated blog generation pipeline built with Node.js, AWS CDK, Lambda, EventBridge Scheduler, S3, DynamoDB, Bedrock, and GitHub Actions.

## � Blog Data Not Generating?

**👉 [Read FIX_BLOG_NOW.md](FIX_BLOG_NOW.md)** - 90 seconds to fix (most likely: enable Bedrock model access)

Alternatively: **[START_HERE.md](START_HERE.md)** - More detailed guide

## What It Does

- On Day 1, schedules and generates 10 initial blog posts automatically.
- Every following day, generates 1 fresh post and archives 1 older published post.
- Creates a matching featured image for every blog post with Amazon Bedrock image generation.
- Stores generated images in S3, stores the full blog content plus image URLs in DynamoDB, and keeps a markdown copy plus manifest in S3.
- Exposes published posts through a public read API and serves blog assets through a public CloudFront URL.
- Exposes an admin trigger API for manual bootstrap and manual post creation.
- Deploys through GitHub Actions using `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` stored in GitHub Secrets.

## Architecture

```mermaid
flowchart LR
    GH["GitHub Actions"] --> CDK["AWS CDK Deploy"]
    CDK --> SCHED["EventBridge Scheduler"]
    CDK --> L1["Bootstrap Lambda"]
    CDK --> L2["Daily Rotation Lambda"]
    CDK --> S3["S3 Blog Assets Bucket"]
    CDK --> DDB["DynamoDB Metadata Table"]

    SCHED --> L1
    SCHED --> L2
    L1 --> BR["Amazon Bedrock"]
    L2 --> BR
    L1 --> S3
    L2 --> S3
    L1 --> DDB
    L2 --> DDB
```

## Project Structure

```text
.
|-- .github/workflows/deploy.yml
|-- docs/setup.md
|-- infra/
|   |-- bin/blog-automation.ts
|   `-- lib/blog-automation-stack.ts
|-- src/
|   |-- config/prompts.ts
|   |-- handlers/
|   |   |-- bootstrap.ts
|   |   `-- daily-rotation.ts
|   |-- services/
|   |   |-- bedrock-service.ts
|   |   |-- blog-pipeline.ts
|   |   |-- manifest.ts
|   |   |-- metadata-repository.ts
|   |   |-- runtime.ts
|   |   `-- storage-service.ts
|   |-- shared/
|   |   |-- dates.ts
|   |   |-- env.ts
|   |   |-- logger.ts
|   |   `-- slug.ts
|   `-- types/blog.ts
|-- tests/
|   |-- manifest.test.ts
|   `-- slug.test.ts
|-- .env.example
|-- cdk.json
|-- package.json
`-- tsconfig.json
```

## AWS Resources Created

- `S3 Bucket`
  Stores published markdown, archived markdown, featured images, and a published-post manifest JSON.
- `DynamoDB Table`
  Stores full blog content, image locations, bootstrap state, and daily rotation state.
- `Bootstrap Lambda`
  Generates the initial Day 1 inventory.
- `Daily Rotation Lambda`
  Generates 1 post and archives 1 old post each day.
- `Public Posts API Lambda URL`
  Exposes published posts at `/posts` and `/posts/{slug}`.
- `Admin Blog API Lambda URL`
  Exposes POST endpoints for `/bootstrap` and `/posts`.
- `CloudFront Distribution`
  Serves the generated images and other published S3 assets publicly.
- `EventBridge Scheduler`
  Triggers the one-time bootstrap flow and the recurring daily rotation flow.
- `IAM Roles`
  Lambda execution role and Scheduler invoke role.
- `SQS DLQ`
  Captures failed Scheduler deliveries.

## Storage Layout

```text
s3://<bucket>/
|-- published/
|   |-- posts/<slug>/index.md
|   |-- images/<slug>/featured.png
|   `-- posts-manifest.json
`-- archive/
    |-- posts/<slug>/index.md
    `-- images/<slug>/featured.png
```

## Environment and Secrets

GitHub Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Recommended GitHub Variables:

- `AWS_REGION`
- `BEDROCK_REGION`
- `STACK_NAME`
- `SCHEDULE_TIMEZONE`
- `DAILY_SCHEDULE_EXPRESSION`
- `BOOTSTRAP_DELAY_MINUTES` or `BOOTSTRAP_AT`
- `BLOG_BRAND_NAME`
- `BLOG_AUTHOR_NAME`
- `BLOG_TONE`
- `BLOG_CATEGORY_THEMES`
- `TEXT_MODEL_ID`
- `IMAGE_MODEL_ID`
- `SITE_BASE_URL`
- `PUBLIC_ASSET_BASE_URL`

## Setup

Full setup and IAM guidance lives in [docs/setup.md](./docs/setup.md).

Follow the detailed guide for:

- AWS prerequisites
- Bedrock model access
- GitHub Secrets and Variables
- IAM permissions
- First deployment
- How the Day 1 and daily automation behave

## Notes

- The stack now creates CloudFront in front of the S3 bucket by default so generated image URLs are publicly fetchable while the bucket stays private.
- The bootstrap schedule defaults to deployment time plus 10 minutes unless `BOOTSTRAP_AT` is provided.
- The daily handler archives by moving the oldest published post from the `published/` prefix to the `archive/` prefix and updating its metadata status to `archived`.
