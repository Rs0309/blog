import { Handler } from "aws-lambda";
import { localDateKey, nowIso } from "../shared/dates";
import { logger } from "../shared/logger";
import { DailyRotationState } from "../types/blog";
import { createRuntime } from "../services/runtime";

export const handler: Handler = async (event) => {
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
    const existingRunPost = await repository.findRunPost(runId);
    if (existingRunPost) {
      state.generatedSlug = existingRunPost.slug;
      state.generationCompleted = true;
    } else {
      const currentCount = await repository.getPublishedCount();
      const post = await pipeline.generateAndPublishPost({
        articleOrdinal: currentCount + 1,
        dateKey,
        runId
      });

      state.generatedSlug = post.slug;
      state.generationCompleted = true;
    }

    await repository.putState("daily-rotation", { ...state });
  }

  if (!state.archiveCompleted) {
    const existingArchive = await repository.findRunArchive(runId);
    if (existingArchive) {
      state.archivedSlug = existingArchive.slug;
      state.archiveCompleted = true;
    } else {
      const archived = await pipeline.archiveOldestPublishedPost(runId, state.generatedSlug ? [state.generatedSlug] : []);
      state.archivedSlug = archived?.slug ?? null;
      state.archiveCompleted = true;
    }

    await repository.putState("daily-rotation", { ...state });
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
};
