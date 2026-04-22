import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { localDateKey, nowIso } from "../shared/dates";
import { logger } from "../shared/logger";
import { BootstrapState } from "../types/blog";
import { createRuntime } from "../services/runtime";

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function normalizePath(rawPath: string): string[] {
  return rawPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function runBootstrap(): Promise<APIGatewayProxyStructuredResultV2> {
  const { config, pipeline, repository } = createRuntime();
  const startedAt = nowIso();
  const dateKey = startedAt.slice(0, 10);
  const publishedCount = await repository.getPublishedCount();

  if (publishedCount >= config.bootstrapPostCount) {
    return json(200, {
      createdCount: 0,
      publishedCount,
      status: "already-satisfied"
    });
  }

  const remaining = config.bootstrapPostCount - publishedCount;
  const createdSlugs: string[] = [];
  const failedPosts: NonNullable<BootstrapState["failedPosts"]> = [];

  await repository.putState("bootstrap", {
    completed: false,
    failedPosts: [],
    lastAttemptAt: startedAt,
    targetCount: config.bootstrapPostCount
  });

  for (let index = 0; index < remaining; index += 1) {
    const articleOrdinal = publishedCount + index + 1;

    try {
      const post = await pipeline.generateAndPublishPost({
        articleOrdinal,
        dateKey,
        runId: `bootstrap-${articleOrdinal}-${dateKey}`
      });
      createdSlugs.push(post.slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedPosts.push({
        articleOrdinal,
        error: message,
        index
      });
      logger.error("Admin bootstrap post generation failed", {
        articleOrdinal,
        error: message,
        index
      });
    }
  }

  const finalPublishedCount = await repository.getPublishedCount();
  const completedAt = nowIso();
  const completed = finalPublishedCount >= config.bootstrapPostCount;

  await repository.putState("bootstrap", {
    completed,
    completedAt: completed ? completedAt : undefined,
    createdSlugs,
    failedPosts,
    lastAttemptAt: startedAt,
    targetCount: config.bootstrapPostCount
  });

  return json(200, {
    createdCount: createdSlugs.length,
    createdSlugs,
    failedCount: failedPosts.length,
    failedPosts,
    publishedCount: finalPublishedCount,
    status: completed ? "completed" : "partial"
  });
}

async function createSinglePost(): Promise<APIGatewayProxyStructuredResultV2> {
  const { config, pipeline, repository } = createRuntime();
  const dateKey = localDateKey(new Date(), config.scheduleTimezone);
  const currentCount = await repository.getPublishedCount();
  const articleOrdinal = currentCount + 1;
  const post = await pipeline.generateAndPublishPost({
    articleOrdinal,
    dateKey,
    runId: `manual-${dateKey}-${Date.now()}`
  });

  return json(201, {
    articleOrdinal,
    slug: post.slug,
    status: "created"
  });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const method = (event.requestContext.http.method ?? "").toUpperCase();
  const segments = normalizePath(event.rawPath ?? "/");

  if (method === "POST" && segments.length === 1 && segments[0] === "bootstrap") {
    return runBootstrap();
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "posts") {
    return createSinglePost();
  }

  return json(404, { error: "Not found" });
};
