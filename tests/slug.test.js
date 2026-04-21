const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureUniqueSlug, slugifyTitle } = require("../dist-test/shared/slug.js");

test("slugifies titles into clean lowercase paths", () => {
  assert.equal(slugifyTitle("AWS Lambda + Bedrock: Production Patterns"), "aws-lambda-bedrock-production-patterns");
});

test("adds a deterministic suffix when a slug already exists", () => {
  const slug = ensureUniqueSlug("aws-bedrock-automation", ["aws-bedrock-automation"], "20260421");
  assert.equal(slug, "aws-bedrock-automation-20260421");
});
