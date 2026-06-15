import type { Tone } from "../../shared/tokens/tokens";

// Maps a recommendation label to the shared visual tone used by badges,
// table rows, drawer header chip, and bubbles in the allocation matrix.
// Keep semantics aligned with the spec:
//   Escalar    → green   (positive)
//   Defender   → orange  (warning / hold)
//   Investigar → blue    (informational / dig in)
//   Reduzir    → red     (negative / cut)
export const recommendationTone = (recommendation: string): Tone => {
  switch (recommendation) {
    case "Escalar":
      return "green";
    case "Defender":
      return "orange";
    case "Investigar":
      return "blue";
    case "Reduzir":
      return "red";
    default:
      return "neutral";
  }
};
