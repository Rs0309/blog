export function slugifyTitle(input: string, fallback = "generated-post"): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || fallback;
}

export function ensureUniqueSlug(base: string, existingSlugs: Iterable<string>, suffixSeed?: string): string {
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) {
    return base;
  }

  if (suffixSeed) {
    const seeded = `${base}-${suffixSeed}`;
    if (!taken.has(seeded)) {
      return seeded;
    }
  }

  let counter = 2;
  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}
