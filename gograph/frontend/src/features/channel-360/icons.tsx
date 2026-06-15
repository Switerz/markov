import type { ReactNode } from "react";
import {
  Calendar,
  Plus,
  Download,
  ChartNoAxesCombined,
  DollarSign,
  ShieldCheck,
  CircleGauge,
  Route,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

// Local lucide name → component map for icons referenced by the
// Channel 360 contract JSON (metric strip, filters, actions, sequence
// path arrows). Returns null for unknown names so callers can safely
// render nothing.
const lucideByName: Record<string, LucideIcon> = {
  Calendar,
  Plus,
  Download,
  ChartNoAxesCombined,
  DollarSign,
  ShieldCheck,
  CircleGauge,
  Route,
  ChevronRight,
};

export function lucideIcon(name: string, size = 16): ReactNode {
  const Icon = lucideByName[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}
