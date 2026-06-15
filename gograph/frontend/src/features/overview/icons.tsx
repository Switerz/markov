import type { ReactNode } from "react";
import {
  Building2,
  Calendar,
  Play,
  Plus,
  Download,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Filter,
  ChartNoAxesCombined,
  TriangleAlert,
  Search,
  Facebook,
  MessageCircle,
  Mail,
  Monitor,
  Instagram,
  Globe,
  type LucideIcon,
} from "lucide-react";

// Map JSON icon name → lucide component for filter/metric/action icons.
// Unknown names return null so the caller can render nothing.
const lucideByName: Record<string, LucideIcon> = {
  Building2,
  Calendar,
  Play,
  Plus,
  Download,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Filter,
  ChartNoAxesCombined,
  TriangleAlert,
};

export function lucideIcon(name: string, size = 16): ReactNode {
  const Icon = lucideByName[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}

// Channel-name → icon. The JSON's `icon` field for channels is advisory
// (e.g. "Google", "Meta" don't exist in lucide). We resolve by channel name
// and fall back to a colored first-letter avatar when nothing matches.
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
  Direct: Globe,
};

export function channelIcon(name: string, size = 16): ReactNode {
  const Icon = channelIcons[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}

export function channelInitial(name: string): string {
  return (name?.trim().charAt(0) ?? "?").toUpperCase();
}
