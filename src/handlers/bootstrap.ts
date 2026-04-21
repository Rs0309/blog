import { Handler } from "aws-lambda";
import { nowIso } from "../shared/dates";
import { logger } from "../shared/logger";
import { BootstrapState } from "../types/blog";
import { createRuntime } from "../services/runtime";

export const handler: Handler = async (event) => {
  try {
    console.log("DEBUG: Bootstrap handler invoked", JSON.stringify(event));
    
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
    logger.info("Posts to generate", { remaining, bootstrapPostCount: config.bootstrapPostCount });

    const createdSlugs: string[] = [];

    await repository.putState("bootstrap", {
      completed: false,
      lastAttemptAt: startedAt,
      targetCount: config.bootstrapPostCount
    });

    for (let index = 0; index < remaining; index += 1) {
      try {
        logger.info("Generating post", { index, articleOrdinal: publishedCount + index + 1 });
        
        const post = await pipeline.generateAndPublishPost({
          articleOrdinal: publishedCount + index + 1,
          dateKey: startedAt.slice(0, 10),
          runId: `bootstrap-${publishedCount + index + 1}-${startedAt.slice(0, 10)}`
        });

        logger.info("Post generated successfully", { slug: post.slug, index });
        createdSlugs.push(post.slug);
      } catch (postError) {
        logger.error("Failed to generate post", {
          index,
          error: postError instanceof Error ? postError.message : String(postError),
          stack: postError instanceof Error ? postError.stack : undefined
        });
        throw postError;
      }
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("FATAL: Bootstrap handler failed", JSON.stringify({
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    }));
    
    logger.error("Bootstrap handler failed with unhandled error", {
      error: errorMessage,
      stack: errorStack
    });
    
    throw error;
  }
};
