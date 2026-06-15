import type { ReactNode } from "react";
import {
  Search,
  Facebook,
  MessageCircle,
  Mail,
  Monitor,
  Instagram,
  Globe,
  Play,
  type LucideIcon,
} from "lucide-react";

// Channel-name → icon. The product JSON's `icon` field for channels is
// advisory (e.g. "Google", "Meta" don't exist in lucide). We resolve by
// channel name and fall back to a colored first-letter avatar (via
// `channelInitial`) when nothing matches.
const channelIcons: Record<string, LucideIcon> = {
  "Google Ads": Search,
  "Meta Ads": Facebook,
  "WhatsApp CRM": MessageCircle,
  Email: Mail,
  Display: Monitor,
  Instagram,
  "Search (Marca)": Search,
  "Video (YouTube)": Play,
  Orgânico: Globe,
  "Organic Search": Globe,
  Direct: Globe,
};

export function channelIcon(name: string, size = 16): ReactNode {
  const Icon = channelIcons[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}

export function channelInitial(name: string): string {
  return (name?.trim().charAt(0) ?? "?").toUpperCase();
}
