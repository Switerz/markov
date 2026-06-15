export const tokens = {
  color: {
    bg: "var(--gg-bg)",
    surface: "var(--gg-surface)",
    surfaceSoft: "var(--gg-surface-soft)",
    border: "var(--gg-border)",
    textPrimary: "var(--gg-text-primary)",
    textSecondary: "var(--gg-text-secondary)",
    blue: "var(--gg-blue)",
    green: "var(--gg-green)",
    red: "var(--gg-red)",
    orange: "var(--gg-orange)",
    indigo: "var(--gg-indigo)",
    cyan: "var(--gg-cyan)",
    neutral: "var(--gg-neutral)",
  },
  tone: ["blue", "green", "red", "orange", "indigo", "cyan", "neutral"] as const,
} as const;
export type Tone = (typeof tokens.tone)[number];
