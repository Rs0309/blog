import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { BlogPostRecord } from "../types/blog";

interface RunMarker {
  slug: string;
}

function toPostItem(post: BlogPostRecord): Record<string, unknown> {
  const sortTimestamp = post.status === "archived" ? post.archivedAt ?? post.publishedAt : post.publishedAt;

  return {
    pk: `POST#${post.slug}`,
    sk: "META",
    entityType: "POST",
    gsi1pk: `STATUS#${post.status.toUpperCase()}`,
    gsi1sk: `${sortTimestamp}#${post.slug}`,
    ...post
  };
}

function fromPostItem(item: Record<string, unknown>): BlogPostRecord {
  return {
    archivedAt: item.archivedAt ? String(item.archivedAt) : undefined,
    authorName: String(item.authorName),
    canonicalUrl: item.canonicalUrl ? String(item.canonicalUrl) : undefined,
    contentMarkdown: String(item.contentMarkdown ?? ""),
    contentKey: String(item.contentKey),
    createdAt: String(item.createdAt),
    excerpt: String(item.excerpt),
    featuredImageAlt: String(item.featuredImageAlt),
    featuredImageKey: String(item.featuredImageKey),
    featuredImageUrl: item.featuredImageUrl ? String(item.featuredImageUrl) : undefined,
    publishedAt: String(item.publishedAt),
    seoDescription: String(item.seoDescription),
    seoTitle: String(item.seoTitle),
    slug: String(item.slug),
    source: "bedrock",
    status: String(item.status) as BlogPostRecord["status"],
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    title: String(item.title)
  };
}

export class MetadataRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly statusIndexName: string
  ) {}

  async getState<T>(name: string): Promise<T | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `STATE#${name}`,
          sk: "META"
        }
      })
    );

    if (!response.Item) {
      return undefined;
    }

    const { pk, sk, entityType, ...state } = response.Item;
    void pk;
    void sk;
    void entityType;
    return state as T;
  }

  async putState(name: string, state: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `STATE#${name}`,
          sk: "META",
          entityType: "STATE",
          ...state
        }
      })
    );
  }

  async listPublishedPosts(limit = 100, newestFirst = true): Promise<BlogPostRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.statusIndexName,
        KeyConditionExpression: "gsi1pk = :status",
        ExpressionAttributeValues: {
          ":status": "STATUS#PUBLISHED"
        },
        Limit: limit,
        ScanIndexForward: !newestFirst
      })
    );

    return (response.Items ?? []).map((item) => fromPostItem(item as Record<string, unknown>));
  }

  async getPublishedCount(): Promise<number> {
    let count = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: this.statusIndexName,
          KeyConditionExpression: "gsi1pk = :status",
          ExpressionAttributeValues: {
            ":status": "STATUS#PUBLISHED"
          },
          Select: "COUNT",
          ExclusiveStartKey: lastEvaluatedKey
        })
      );

      count += response.Count ?? 0;
      lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return count;
  }

  async getOldestPublishedPost(excludeSlugs: string[] = []): Promise<BlogPostRecord | undefined> {
    const items = await this.listPublishedPosts(50, false);
    const excluded = new Set(excludeSlugs);
    return items.find((item) => !excluded.has(item.slug));
  }

  async getPostBySlug(slug: string): Promise<BlogPostRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `POST#${slug}`,
          sk: "META"
        }
      })
    );

    if (!response.Item) {
      return undefined;
    }

    return fromPostItem(response.Item as Record<string, unknown>);
  }

  async findRunPost(runId: string): Promise<BlogPostRecord | undefined> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `RUN#${runId}`,
          ":prefix": "POST#"
        },
        Limit: 1
      })
    );

    const item = response.Items?.[0] as Record<string, unknown> | undefined;
    if (!item) {
      return undefined;
    }

    return {
      archivedAt: undefined,
      authorName: "",
      contentMarkdown: "",
      contentKey: "",
      createdAt: String(item.createdAt ?? ""),
      excerpt: "",
      featuredImageAlt: "",
      featuredImageKey: "",
      publishedAt: String(item.createdAt ?? ""),
      seoDescription: "",
      seoTitle: "",
      slug: String(item.slug),
      source: "bedrock",
      status: "published",
      tags: [],
      title: String(item.title ?? "")
    };
  }

  async findRunArchive(runId: string): Promise<RunMarker | undefined> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `RUN#${runId}`,
          ":prefix": "ARCHIVE#"
        },
        Limit: 1
      })
    );

    const item = response.Items?.[0] as Record<string, unknown> | undefined;
    if (!item) {
      return undefined;
    }

    return {
      slug: String(item.slug)
    };
  }

  async deletePost(slug: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `POST#${slug}`,
          sk: "META"
        }
      })
    );
  }

  async savePublishedPost(post: BlogPostRecord, runId?: string): Promise<void> {
    const transactItems: Array<Record<string, unknown>> = [
      {
        Put: {
          TableName: this.tableName,
          Item: toPostItem(post)
        }
      }
    ];

    if (runId) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: {
            pk: `RUN#${runId}`,
            sk: `POST#${post.slug}`,
            entityType: "RUN_MARKER",
            createdAt: post.createdAt,
            slug: post.slug,
            title: post.title
          }
        }
      });
    }

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: transactItems
      })
    );
  }

  async saveArchivedPost(post: BlogPostRecord, runId?: string): Promise<void> {
    const transactItems: Array<Record<string, unknown>> = [
      {
        Put: {
          TableName: this.tableName,
          Item: toPostItem(post)
        }
      }
    ];

    if (runId) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: {
            pk: `RUN#${runId}`,
            sk: `ARCHIVE#${post.slug}`,
            entityType: "RUN_MARKER",
            archivedAt: post.archivedAt,
            slug: post.slug
          }
        }
      });
    }

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: transactItems
      })
    );
  }
}
