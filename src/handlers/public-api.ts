import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createRuntime } from "../services/runtime";

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60"
    },
    body: JSON.stringify(body)
  };
}

function normalizePath(rawPath: string): string[] {
  return rawPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const { repository } = createRuntime();

  if ((event.requestContext.http.method ?? "GET").toUpperCase() !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const segments = normalizePath(event.rawPath ?? "/");

  if (segments.length === 1 && segments[0] === "posts") {
    const posts = await repository.listPublishedPosts(100, true);
    return json(
      200,
      posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        tags: post.tags,
        publishedAt: post.publishedAt,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        authorName: post.authorName,
        featuredImageAlt: post.featuredImageAlt,
        featuredImageUrl: post.featuredImageUrl ?? null,
        canonicalUrl: post.canonicalUrl ?? null
      }))
    );
  }

  if (segments.length === 2 && segments[0] === "posts") {
    const post = await repository.getPostBySlug(decodeURIComponent(segments[1]));
    if (!post || post.status !== "published") {
      return json(404, { error: "Post not found" });
    }

    return json(200, post);
  }

  return json(404, { error: "Not found" });
};
