import { BlogPostRecord } from "../types/blog";

export function buildPublicAssetUrl(baseUrl: string | undefined, key: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, "")}/${key}`;
}

export function buildCanonicalUrl(baseUrl: string | undefined, slug: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, "")}/${slug}`;
}

export function serializeManifest(posts: BlogPostRecord[], generatedAt: string, publicAssetBaseUrl?: string, siteBaseUrl?: string): string {
  return JSON.stringify(
    {
      generatedAt,
      count: posts.length,
      items: posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        tags: post.tags,
        status: post.status,
        publishedAt: post.publishedAt,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        contentKey: post.contentKey,
        featuredImageKey: post.featuredImageKey,
        featuredImageUrl: buildPublicAssetUrl(publicAssetBaseUrl, post.featuredImageKey),
        canonicalUrl: buildCanonicalUrl(siteBaseUrl, post.slug)
      }))
    },
    null,
    2
  );
}
