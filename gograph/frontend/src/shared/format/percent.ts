export const formatPercent = (v: number, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);

export const formatPercentPoints = (v: number) => {
  const pp = v * 100;
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${pp.toFixed(2).replace(".", ",")} p.p.`;
};
