import type { Tone } from "../tokens/tokens";

// Maps a channel name to a Tone for charts/bars/badges. Used in the journey
// summary, sankey heuristics, and channel-360 styling.
export function channelTone(channel: string): Tone {
  const lower = channel.toLowerCase();
  if (lower.includes("google")) return "blue";
  if (lower.includes("instagram")) return "indigo";
  if (lower.includes("meta") || lower.includes("facebook")) return "indigo";
  if (lower.includes("tiktok")) return "red";
  if (lower.includes("youtube")) return "red";
  if (lower.includes("email")) return "cyan";
  if (lower.includes("whatsapp")) return "green";
  if (lower.includes("sms")) return "orange";
  if (lower.includes("display") || lower.includes("retarget")) return "orange";
  if (lower.includes("influencer")) return "indigo";
  if (lower.includes("organic")) return "green";
  if (lower.includes("direct")) return "neutral";
  if (lower.includes("referral")) return "neutral";
  if (lower.includes("clube")) return "cyan";
  return "neutral";
}
