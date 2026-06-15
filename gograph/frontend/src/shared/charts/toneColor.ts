import type { Tone } from "../tokens/tokens";

export const toneColor = (tone: Tone): string => `var(--gg-${tone})`;
export const toneSoftColor = (tone: Tone): string => `var(--gg-${tone}-soft)`;
