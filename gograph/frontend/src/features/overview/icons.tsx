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
  Shield,
  CornerDownRight,
  SlidersHorizontal,
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
  Search,
  Shield,
  CornerDownRight,
  SlidersHorizontal,
};

export function lucideIcon(name: string, size = 16): ReactNode {
  const Icon = lucideByName[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}
