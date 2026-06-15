import type { ReactNode } from "react";
import {
  Building2,
  Calendar,
  Play,
  Plus,
  Download,
  TrendingUp,
  Shield,
  Search,
  CornerDownRight,
  SlidersHorizontal,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

// Local lucide name → component map for the icons referenced by the
// budget-decisions contract JSON (summary cards, filters, actions,
// table controls). Returns null for unknown names so the caller can
// safely render nothing.
const lucideByName: Record<string, LucideIcon> = {
  Building2,
  Calendar,
  Play,
  Plus,
  Download,
  TrendingUp,
  Shield,
  Search,
  CornerDownRight,
  SlidersHorizontal,
  ChevronRight,
};

export function lucideIcon(name: string, size = 16): ReactNode {
  const Icon = lucideByName[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}
