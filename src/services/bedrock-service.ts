import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { compactDateKey } from "../shared/dates";
import { AppConfig } from "../shared/env";
import { logger } from "../shared/logger";
import { slugifyTitle } from "../shared/slug";
import { GeneratedBlogDraft } from "../types/blog";
import { buildBlogSystemPrompt, buildBlogUserPrompt } from "../config/prompts";

interface GenerateDraftInput {
  articleOrdinal: number;
  dateKey: string;
  existingSlugs: string[];
  existingTitles: string[];
  themes: string[];
}

function stripCodeFences(value: string): string {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractTextContent(response: unknown): string {
  const content = (response as { output?: { message?: { content?: Array<{ text?: string }> } } }).output?.message?.content;
  if (!content || content.length === 0) {
    throw new Error("Bedrock returned an empty response");
  }

  const text = content
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Bedrock response did not include any text content");
  }

  return text;
}

function validateDraft(raw: Record<string, unknown>): GeneratedBlogDraft {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6)
    : [];

  const draft: GeneratedBlogDraft = {
    contentMarkdown: String(raw.contentMarkdown ?? "").trim(),
    excerpt: String(raw.excerpt ?? "").trim(),
    featuredImageAlt: String(raw.featuredImageAlt ?? "").trim(),
    featuredImagePrompt: String(raw.featuredImagePrompt ?? "").trim(),
    seoDescription: String(raw.seoDescription ?? "").trim(),
    seoTitle: String(raw.seoTitle ?? "").trim(),
    slugHint: String(raw.slugHint ?? raw.title ?? "").trim(),
    tags,
    title: String(raw.title ?? "").trim()
  };

  if (!draft.title || !draft.contentMarkdown || !draft.featuredImagePrompt || !draft.excerpt) {
    throw new Error("Bedrock response is missing one or more required draft fields");
  }

  if (draft.tags.length < 3) {
    throw new Error("Bedrock response returned fewer than 3 tags");
  }

  if (draft.contentMarkdown.length < 1200) {
    throw new Error("Generated blog content was too short");
  }

  draft.slugHint = slugifyTitle(draft.slugHint || draft.title, `post-${compactDateKey(new Date().toISOString().slice(0, 10))}`);
  return draft;
}

export class BedrockService {
  constructor(
    private readonly client: BedrockRuntimeClient,
    private readonly config: AppConfig
  ) {}

  async generateBlogDraft(input: GenerateDraftInput): Promise<GeneratedBlogDraft> {
    const command = new ConverseCommand({
      modelId: this.config.textModelId,
      system: [{ text: buildBlogSystemPrompt() }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: buildBlogUserPrompt({
                articleOrdinal: input.articleOrdinal,
                blogAuthorName: this.config.blogAuthorName,
                blogBrandName: this.config.blogBrandName,
                blogTone: this.config.blogTone,
                dateKey: input.dateKey,
                existingSlugs: input.existingSlugs.slice(0, 20),
                existingTitles: input.existingTitles.slice(0, 20),
                themes: input.themes
              })
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: 6000,
        temperature: 0.8,
        topP: 0.9
      }
    });

    const response = await this.client.send(command);
    const rawText = extractTextContent(response);
    logger.info("Received Bedrock blog draft response", {
      modelId: this.config.textModelId,
      preview: rawText.slice(0, 180)
    });

    const parsed = JSON.parse(stripCodeFences(rawText)) as Record<string, unknown>;
    return validateDraft(parsed);
  }

  async generateFeaturedImage(prompt: string): Promise<Buffer> {
    const response = await this.client.send(
      new InvokeModelCommand({
        modelId: this.config.imageModelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          taskType: "TEXT_IMAGE",
          textToImageParams: {
            text: prompt,
            negativeText: "watermark, text, logo, signature, blurry, low quality, distorted, overexposed, duplicate subjects"
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            width: this.config.imageWidth,
            height: this.config.imageHeight,
            cfgScale: 8,
            seed: Math.floor(Math.random() * 1_000_000)
          }
        })
      })
    );

    const body = JSON.parse(new TextDecoder().decode(response.body)) as {
      error?: string;
      images?: string[];
    };

    if (!body.images || body.images.length === 0) {
      throw new Error(body.error ?? "Bedrock did not return an image");
    }

    if (body.error) {
      logger.warn("Bedrock image generation returned a moderation warning", {
        modelId: this.config.imageModelId,
        error: body.error
      });
    }

    return Buffer.from(body.images[0], "base64");
  }
}
