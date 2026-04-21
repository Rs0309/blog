interface PromptContext {
  articleOrdinal: number;
  blogAuthorName: string;
  blogBrandName: string;
  blogTone: string;
  dateKey: string;
  existingSlugs: string[];
  existingTitles: string[];
  themes: string[];
}

export function buildBlogSystemPrompt(): string {
  return [
    "You are a senior technical content strategist writing production-quality blog posts for an AWS-focused engineering publication.",
    "Return only valid JSON. Do not wrap the response in markdown fences.",
    "The JSON object must contain exactly these keys:",
    "title, slugHint, excerpt, seoTitle, seoDescription, tags, featuredImageAlt, featuredImagePrompt, contentMarkdown.",
    "Rules:",
    "- Use concise, high-signal language.",
    "- Write in markdown.",
    "- Include a clear introduction, multiple H2 sections, one short FAQ section, and a practical conclusion.",
    "- Avoid fabricating statistics, quotes, customer stories, or external references.",
    "- Make the article evergreen unless the user context explicitly suggests a dated angle.",
    "- The featuredImagePrompt must describe a realistic blog hero image without text overlays, logos, watermarks, or UI screenshots.",
    "- tags must contain 3 to 6 short strings."
  ].join(" ");
}

export function buildBlogUserPrompt(context: PromptContext): string {
  const existingTitles = context.existingTitles.length > 0 ? context.existingTitles.join("; ") : "None yet";
  const existingSlugs = context.existingSlugs.length > 0 ? context.existingSlugs.join(", ") : "None yet";

  return [
    `Brand: ${context.blogBrandName}`,
    `Author: ${context.blogAuthorName}`,
    `Tone: ${context.blogTone}`,
    `Publishing date: ${context.dateKey}`,
    `Article number in the campaign: ${context.articleOrdinal}`,
    `Editorial themes to rotate through: ${context.themes.join(", ")}`,
    `Avoid repeating or closely mirroring these recent titles: ${existingTitles}`,
    `Avoid using these existing slugs: ${existingSlugs}`,
    "Target output:",
    "- Title with strong technical clarity.",
    "- Excerpt between 140 and 190 characters.",
    "- SEO title under 65 characters.",
    "- SEO description under 160 characters.",
    "- Content length roughly 900 to 1400 words.",
    "- Markdown body only in contentMarkdown.",
    "- slugHint should be lowercase words separated by hyphens.",
    "Return JSON now."
  ].join("\n");
}
