import { Handler } from "aws-lambda";
import { nowIso } from "../shared/dates";
import { logger } from "../shared/logger";
import { BootstrapState } from "../types/blog";
import { createRuntime } from "../services/runtime";

export const handler: Handler = async (event) => {
  const { config, pipeline, repository } = createRuntime();
  const startedAt = nowIso();

  logger.info("Bootstrap run started", {
    event
  });

  const existingState = await repository.getState<BootstrapState>("bootstrap");
  if (existingState?.completed) {
    logger.info("Bootstrap already completed previously", {
      ...existingState
    });
    return {
      createdCount: 0,
      status: "noop"
    };
  }

  const publishedCount = await repository.getPublishedCount();
  logger.info("Current published count", { publishedCount });

  if (publishedCount >= config.bootstrapPostCount) {
    await repository.putState("bootstrap", {
      completed: true,
      completedAt: startedAt,
      lastAttemptAt: startedAt,
      targetCount: config.bootstrapPostCount
    });

    logger.info("Bootstrap skipped because target count already exists", {
      publishedCount
    });

    return {
      createdCount: 0,
      status: "already-satisfied"
    };
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
      logger.info("Generating bootstrap post", {
        articleOrdinal,
        index,
        remaining
      });

      const post = await pipeline.generateAndPublishPost({
        articleOrdinal,
        dateKey: startedAt.slice(0, 10),
        runId: `bootstrap-${articleOrdinal}-${startedAt.slice(0, 10)}`
      });

      createdSlugs.push(post.slug);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      failedPosts.push({
        articleOrdinal,
        error: errorMessage,
        index
      });

      logger.error("Bootstrap post generation failed", {
        articleOrdinal,
        error: errorMessage,
        index,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  const completedAt = nowIso();
  const finalPublishedCount = await repository.getPublishedCount();
  const completed = finalPublishedCount >= config.bootstrapPostCount;

  await repository.putState("bootstrap", {
    completed,
    completedAt: completed ? completedAt : undefined,
    createdSlugs,
    failedPosts,
    lastAttemptAt: startedAt,
    targetCount: config.bootstrapPostCount
  });

  logger.info("Bootstrap run finished", {
    completed,
    createdCount: createdSlugs.length,
    failedCount: failedPosts.length,
    finalPublishedCount
  });

  return {
    createdCount: createdSlugs.length,
    createdSlugs,
    failedCount: failedPosts.length,
    failedPosts,
    status: completed ? "completed" : "partial"
  };
};
