const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCanonicalUrl, buildPublicAssetUrl, serializeManifest } = require("../dist-test/services/manifest.js");

test("builds stable public URLs", () => {
  assert.equal(
    buildPublicAssetUrl("https://cdn.example.com/assets", "published/images/post/featured.png"),
    "https://cdn.example.com/assets/published/images/post/featured.png"
  );
  assert.equal(buildCanonicalUrl("https://example.com/blog", "my-post"), "https://example.com/blog/my-post");
});

test("serializes the published manifest shape", () => {
  const manifest = JSON.parse(
    serializeManifest(
      [
        {
          authorName: "Editorial Team",
          contentKey: "published/posts/my-post/index.md",
          createdAt: "2026-04-21T00:00:00.000Z",
          excerpt: "A concise summary.",
          featuredImageAlt: "Hero image",
          featuredImageKey: "published/images/my-post/featured.png",
          publishedAt: "2026-04-21T00:00:00.000Z",
          seoDescription: "SEO description",
          seoTitle: "SEO title",
          slug: "my-post",
          source: "bedrock",
          status: "published",
          tags: ["AWS", "Automation", "Bedrock"],
          title: "My Post"
        }
      ],
      "2026-04-21T00:01:00.000Z",
      "https://cdn.example.com",
      "https://example.com/blog"
    )
  );

  assert.equal(manifest.count, 1);
  assert.equal(manifest.items[0].slug, "my-post");
  assert.equal(manifest.items[0].featuredImageUrl, "https://cdn.example.com/published/images/my-post/featured.png");
  assert.equal(manifest.items[0].canonicalUrl, "https://example.com/blog/my-post");
});
