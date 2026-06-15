export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const formatCompactBRL = (v: number) => {
  // Node ICU emits "24,8 mi" / "16,5 mil" without R$ prefix when notation=compact.
  // We normalize to "R$ 24,8M" / "R$ 16,5K".
  const compact = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
  const normalized = compact
    .replace(/\s?mil\b/i, "K")
    .replace(/\s?mi\b/i, "M")
    .replace(/\s?bi\b/i, "B")
    .replace(/\s?tri\b/i, "T");
  return `R$ ${normalized}`;
};
