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
    "You are a content strategist writing clear, practical blog posts for a business growth publication aimed at local service businesses and small business owners.",
    "Return only valid JSON. Do not wrap the response in markdown fences.",
    "The JSON object must contain exactly these keys:",
    "title, slugHint, excerpt, seoTitle, seoDescription, tags, featuredImageAlt, featuredImagePrompt, contentMarkdown.",
    "Rules:",
    "- Write in plain, friendly language that a non-technical business owner can understand — avoid jargon.",
    "- Write in markdown.",
    "- Include a short engaging introduction, multiple H2 sections that give real actionable advice, one short FAQ section, and a practical conclusion.",
    "- Avoid fabricating statistics, quotes, customer stories, or external references.",
    "- Make the article evergreen and focused on how businesses can grow, automate, and serve customers better.",
    "- The featuredImagePrompt must describe a realistic blog hero image showing business people or modern office environments, without text overlays, logos, watermarks, or UI screenshots.",
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
    "- Title that is clear, benefit-focused, and accessible to a small business owner.",
    "- Excerpt between 140 and 190 characters.",
    "- SEO title under 65 characters.",
    "- SEO description under 160 characters.",
    "- Content length roughly 900 to 1400 words.",
    "- Markdown body only in contentMarkdown.",
    "- slugHint should be lowercase words separated by hyphens.",
    "Return JSON now."
  ].join("\n");
}
