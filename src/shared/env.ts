export interface AppConfig {
  archivePrefix: string;
  bedrockRegion: string;
  blogAuthorName: string;
  blogBrandName: string;
  blogThemes: string[];
  blogTone: string;
  blogBucketName: string;
  blogTableName: string;
  bootstrapPostCount: number;
  imageHeight: number;
  imageModelId: string;
  imageWidth: number;
  manifestKey: string;
  maxPublishedPosts: number;
  publicAssetBaseUrl?: string;
  publishedPrefix: string;
  scheduleTimezone: string;
  siteBaseUrl?: string;
  statusIndexName: string;
  textModelId: string;
}

let cachedConfig: AppConfig | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }

  return value;
}

function csvEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    archivePrefix: process.env.ARCHIVE_PREFIX ?? "archive",
    bedrockRegion: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    blogAuthorName: process.env.BLOG_AUTHOR_NAME ?? "Editorial Team",
    blogBrandName: process.env.BLOG_BRAND_NAME ?? "Cloud Scale Daily",
    blogThemes: csvEnv("BLOG_CATEGORY_THEMES", [
      "Cloud Computing",
      "Serverless",
      "DevOps Automation",
      "AWS Cost Optimization",
      "Platform Engineering"
    ]),
    blogTone: process.env.BLOG_TONE ?? "Confident, practical, senior-engineer friendly",
    blogBucketName: requireEnv("BLOG_BUCKET_NAME"),
    blogTableName: requireEnv("BLOG_TABLE_NAME"),
    bootstrapPostCount: numberEnv("BOOTSTRAP_POST_COUNT", 10),
    imageHeight: numberEnv("IMAGE_HEIGHT", 768),
    imageModelId: process.env.IMAGE_MODEL_ID ?? "amazon.titan-image-generator-v2:0",
    imageWidth: numberEnv("IMAGE_WIDTH", 1408),
    manifestKey: process.env.MANIFEST_KEY ?? "published/posts-manifest.json",
    maxPublishedPosts: numberEnv("MAX_PUBLISHED_POSTS", 10),
    publicAssetBaseUrl: optionalEnv("PUBLIC_ASSET_BASE_URL"),
    publishedPrefix: process.env.PUBLISHED_PREFIX ?? "published",
    scheduleTimezone: process.env.SCHEDULE_TIMEZONE ?? "UTC",
    siteBaseUrl: optionalEnv("SITE_BASE_URL"),
    statusIndexName: process.env.STATUS_INDEX_NAME ?? "status-index",
    textModelId: process.env.TEXT_MODEL_ID ?? "amazon.nova-pro-v1:0"
  };

  return cachedConfig;
}
