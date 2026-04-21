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

  await repository.putState("bootstrap", {
    completed: false,
    lastAttemptAt: startedAt,
    targetCount: config.bootstrapPostCount
  });

  for (let index = 0; index < remaining; index += 1) {
    const post = await pipeline.generateAndPublishPost({
      articleOrdinal: publishedCount + index + 1,
      dateKey: startedAt.slice(0, 10),
      runId: `bootstrap-${publishedCount + index + 1}-${startedAt.slice(0, 10)}`
    });

    createdSlugs.push(post.slug);
  }

  const completedAt = nowIso();
  await repository.putState("bootstrap", {
    completed: true,
    completedAt,
    createdSlugs,
    lastAttemptAt: startedAt,
    targetCount: config.bootstrapPostCount
  });

  logger.info("Bootstrap run completed", {
    createdCount: createdSlugs.length,
    createdSlugs
  });

  return {
    createdCount: createdSlugs.length,
    createdSlugs,
    status: "completed"
  };
};
