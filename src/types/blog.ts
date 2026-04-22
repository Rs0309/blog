export type BlogStatus = "published" | "archived";

export interface GeneratedBlogDraft {
  contentMarkdown: string;
  excerpt: string;
  featuredImageAlt: string;
  featuredImagePrompt: string;
  seoDescription: string;
  seoTitle: string;
  slugHint: string;
  tags: string[];
  title: string;
}

export interface BlogPostRecord {
  archivedAt?: string;
  authorName: string;
  canonicalUrl?: string;
  contentMarkdown: string;
  contentKey: string;
  createdAt: string;
  excerpt: string;
  featuredImageAlt: string;
  featuredImageKey: string;
  featuredImageUrl?: string;
  publishedAt: string;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  source: "bedrock";
  status: BlogStatus;
  tags: string[];
  title: string;
}

export interface BootstrapState {
  completed: boolean;
  completedAt?: string;
  lastAttemptAt: string;
  targetCount: number;
}

export interface DailyRotationState {
  archiveCompleted: boolean;
  archivedSlug?: string | null;
  completed: boolean;
  completedAt?: string;
  dateKey: string;
  generatedSlug?: string;
  generationCompleted: boolean;
  lastAttemptAt: string;
}
