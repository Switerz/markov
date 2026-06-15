export const formatMultiplier = (v: number) => `${v.toFixed(2).replace(".", ",")}x`;

export const formatNumber = (v: number, opts: { compact?: boolean } = {}) => {
  if (!opts.compact) return new Intl.NumberFormat("pt-BR").format(v);
  const out = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
  // Normalize to "<num> mi" / "<num> mil" with single space.
  return out
    .replace(/\s?mil\b/i, " mil")
    .replace(/\s?mi\b/i, " mi")
    .replace(/\s?bi\b/i, " bi")
    .replace(/\s?tri\b/i, " tri");
};
