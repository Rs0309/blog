import { nowIso } from "../shared/dates";
import { AppConfig } from "../shared/env";
import { logger } from "../shared/logger";
import { ensureUniqueSlug, slugifyTitle } from "../shared/slug";
import { BlogPostRecord } from "../types/blog";
import { BedrockService } from "./bedrock-service";
import { buildCanonicalUrl, buildPublicAssetUrl, serializeManifest } from "./manifest";
import { MetadataRepository } from "./metadata-repository";
import { BlogStorageService } from "./storage-service";

interface BlogPipelineDependencies {
  bedrock: BedrockService;
  config: AppConfig;
  repository: MetadataRepository;
  storage: BlogStorageService;
}

interface GenerateAndPublishOptions {
  articleOrdinal: number;
  dateKey: string;
  runId?: string;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

function renderMarkdown(post: BlogPostRecord, bodyMarkdown: string, siteBaseUrl?: string, publicAssetBaseUrl?: string): string {
  const canonicalUrl = post.canonicalUrl ?? buildCanonicalUrl(siteBaseUrl, post.slug);
  const featuredImageUrl = post.featuredImageUrl ?? buildPublicAssetUrl(publicAssetBaseUrl, post.featuredImageKey);

  const frontmatter = [
    "---",
    `title: "${escapeYaml(post.title)}"`,
    `slug: "${post.slug}"`,
    `excerpt: "${escapeYaml(post.excerpt)}"`,
    `seoTitle: "${escapeYaml(post.seoTitle)}"`,
    `seoDescription: "${escapeYaml(post.seoDescription)}"`,
    `author: "${escapeYaml(post.authorName)}"`,
    `publishedAt: "${post.publishedAt}"`,
    `status: "${post.status}"`,
    `featuredImageAlt: "${escapeYaml(post.featuredImageAlt)}"`,
    `featuredImageKey: "${post.featuredImageKey}"`,
    `contentKey: "${post.contentKey}"`,
    `tags: [${post.tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]`,
    canonicalUrl ? `canonicalUrl: "${canonicalUrl}"` : undefined,
    featuredImageUrl ? `featuredImageUrl: "${featuredImageUrl}"` : undefined,
    "---",
    "",
    bodyMarkdown.trim(),
    ""
  ].filter(Boolean);

  return frontmatter.join("\n");
}

export class BlogPipeline {
  constructor(private readonly deps: BlogPipelineDependencies) {}

  async generateAndPublishPost(options: GenerateAndPublishOptions): Promise<BlogPostRecord> {
    const existingPosts = await this.deps.repository.listPublishedPosts(25, true);
    const existingSlugs = existingPosts.map((post) => post.slug);
    const existingTitles = existingPosts.map((post) => post.title);

    const draft = await this.deps.bedrock.generateBlogDraft({
      articleOrdinal: options.articleOrdinal,
      dateKey: options.dateKey,
      existingSlugs,
      existingTitles,
      themes: this.deps.config.blogThemes
    });

    const baseSlug = slugifyTitle(draft.slugHint || draft.title);
    const slug = ensureUniqueSlug(baseSlug, existingSlugs, options.dateKey.replace(/-/g, ""));
    const publishedAt = nowIso();
    const contentKey = `${this.deps.config.publishedPrefix}/posts/${slug}/index.md`;
    const featuredImageKey = `${this.deps.config.publishedPrefix}/images/${slug}/featured.png`;
    const canonicalUrl = buildCanonicalUrl(this.deps.config.siteBaseUrl, slug);
    const featuredImageUrl = buildPublicAssetUrl(this.deps.config.publicAssetBaseUrl, featuredImageKey);

    const post: BlogPostRecord = {
      authorName: this.deps.config.blogAuthorName,
      canonicalUrl,
      contentMarkdown: draft.contentMarkdown,
      contentKey,
      createdAt: publishedAt,
      excerpt: draft.excerpt,
      featuredImageAlt: draft.featuredImageAlt,
      featuredImageKey,
      featuredImageUrl,
      publishedAt,
      seoDescription: draft.seoDescription,
      seoTitle: draft.seoTitle,
      slug,
      source: "bedrock",
      status: "published",
      tags: draft.tags,
      title: draft.title
    };

    const imageBuffer = await this.deps.bedrock.generateFeaturedImage(draft.featuredImagePrompt);

    if (!imageBuffer) {
      post.featuredImageKey = "";
      post.featuredImageUrl = undefined;
    }

    const markdown = renderMarkdown(
      post,
      post.contentMarkdown,
      this.deps.config.siteBaseUrl,
      this.deps.config.publicAssetBaseUrl
    );

    await this.deps.storage.putText(contentKey, markdown, "text/markdown; charset=utf-8");
    if (imageBuffer) {
      await this.deps.storage.putBinary(featuredImageKey, imageBuffer, "image/png");
    }
    await this.deps.repository.savePublishedPost(post, options.runId);
    await this.refreshManifest();

    logger.info("Published new blog post", {
      slug: post.slug,
      title: post.title
    });

    return post;
  }

  async archiveOldestPublishedPost(runId: string, excludeSlugs: string[] = []): Promise<BlogPostRecord | undefined> {
    const oldest = await this.deps.repository.getOldestPublishedPost(excludeSlugs);
    if (!oldest) {
      return undefined;
    }

    const archivedAt = nowIso();
    const archivedContentKey = `${this.deps.config.archivePrefix}/posts/${oldest.slug}/index.md`;
    const archivedImageKey = `${this.deps.config.archivePrefix}/images/${oldest.slug}/featured.png`;

    await this.deps.storage.copyObject(oldest.contentKey, archivedContentKey);
    await this.deps.storage.copyObject(oldest.featuredImageKey, archivedImageKey);
    await this.deps.storage.deleteObject(oldest.contentKey);
    await this.deps.storage.deleteObject(oldest.featuredImageKey);

    const archivedRecord: BlogPostRecord = {
      ...oldest,
      archivedAt,
      contentKey: archivedContentKey,
      featuredImageKey: archivedImageKey,
      status: "archived"
    };

    await this.deps.repository.saveArchivedPost(archivedRecord, runId);
    await this.refreshManifest();

    logger.info("Archived published blog post", {
      slug: archivedRecord.slug
    });

    return archivedRecord;
  }

  private async refreshManifest(): Promise<void> {
    const publishedPosts = await this.deps.repository.listPublishedPosts(100, true);
    const manifest = serializeManifest(
      publishedPosts,
      nowIso(),
      this.deps.config.publicAssetBaseUrl,
      this.deps.config.siteBaseUrl
    );

    await this.deps.storage.putText(this.deps.config.manifestKey, manifest, "application/json; charset=utf-8");
  }
}
