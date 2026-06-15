// Slugifies a channel name for URLs.
// "Google Ads" → "google-ads", "Organic Search" → "organic-search",
// strips diacritics and non-alphanumerics.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
