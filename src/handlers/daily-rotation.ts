import { Handler } from "aws-lambda";
import { localDateKey, nowIso } from "../shared/dates";
import { logger } from "../shared/logger";
import { DailyRotationState } from "../types/blog";
import { createRuntime } from "../services/runtime";

export const handler: Handler = async (event) => {
  try {
    console.log("DEBUG: Daily rotation handler invoked", JSON.stringify(event));
    
    const { config, pipeline, repository } = createRuntime();
    const startedAt = nowIso();
    const dateKey = localDateKey(new Date(), config.scheduleTimezone);
    const runId = `daily-${dateKey}`;

    logger.info("Daily rotation started", {
      dateKey,
      event
    });

    const persistedState = await repository.getState<DailyRotationState>("daily-rotation");
    let state: DailyRotationState =
      persistedState?.dateKey === dateKey
        ? persistedState
        : {
            archiveCompleted: false,
            completed: false,
            dateKey,
            generationCompleted: false,
            lastAttemptAt: startedAt
          };

    if (state.completed && state.dateKey === dateKey) {
      logger.info("Daily rotation already completed for this day", {
        dateKey
      });

      return {
        archivedSlug: state.archivedSlug ?? null,
        generatedSlug: state.generatedSlug ?? null,
        status: "noop"
      };
    }

    state.lastAttemptAt = startedAt;
    await repository.putState("daily-rotation", { ...state });

    if (!state.generationCompleted) {
      try {
        logger.info("Checking for existing run post", { runId });
        const existingRunPost = await repository.findRunPost(runId);
        if (existingRunPost) {
          state.generatedSlug = existingRunPost.slug;
          state.generationCompleted = true;
          logger.info("Found existing run post, skipping generation", { slug: existingRunPost.slug });
        } else {
          logger.info("Generating new post", { runId });
          const currentCount = await repository.getPublishedCount();
          const post = await pipeline.generateAndPublishPost({
            articleOrdinal: currentCount + 1,
            dateKey,
            runId
          });

          state.generatedSlug = post.slug;
          state.generationCompleted = true;
          logger.info("Post generated successfully", { slug: post.slug });
        }

        await repository.putState("daily-rotation", { ...state });
      } catch (genError) {
        logger.error("Failed during generation phase", {
          error: genError instanceof Error ? genError.message : String(genError),
          stack: genError instanceof Error ? genError.stack : undefined
        });
        throw genError;
      }
    }

    if (!state.archiveCompleted) {
      try {
        logger.info("Checking for existing archive", { runId });
        const existingArchive = await repository.findRunArchive(runId);
        if (existingArchive) {
          state.archivedSlug = existingArchive.slug;
          state.archiveCompleted = true;
          logger.info("Found existing archive, skipping", { slug: existingArchive.slug });
        } else {
          logger.info("Archiving oldest published post", { runId, excludeSlugs: state.generatedSlug ? [state.generatedSlug] : [] });
          const archived = await pipeline.archiveOldestPublishedPost(runId, state.generatedSlug ? [state.generatedSlug] : []);
          state.archivedSlug = archived?.slug ?? null;
          state.archiveCompleted = true;
          logger.info("Archive completed", { archivedSlug: state.archivedSlug });
        }

        await repository.putState("daily-rotation", { ...state });
      } catch (archError) {
        logger.error("Failed during archive phase", {
          error: archError instanceof Error ? archError.message : String(archError),
          stack: archError instanceof Error ? archError.stack : undefined
        });
        throw archError;
      }
    }

    const completedAt = nowIso();
    state.completed = true;
    state.completedAt = completedAt;
    await repository.putState("daily-rotation", { ...state });

    logger.info("Daily rotation completed", {
      archivedSlug: state.archivedSlug ?? null,
      generatedSlug: state.generatedSlug ?? null
    });

    return {
      archivedSlug: state.archivedSlug ?? null,
      generatedSlug: state.generatedSlug ?? null,
      status: "completed"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("FATAL: Daily rotation handler failed", JSON.stringify({
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    }));
    
    logger.error("Daily rotation handler failed with unhandled error", {
      error: errorMessage,
      stack: errorStack
    });
    
    throw error;
  }
};
