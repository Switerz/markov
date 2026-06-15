import type { ReactNode } from "react";
import {
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  TriangleAlert,
  ListFilter,
  Plus,
  Settings,
  Download,
  RefreshCw,
  Ellipsis,
  EllipsisVertical,
  type LucideIcon,
} from "lucide-react";

// Map JSON icon name → lucide component for executions-quality icons.
const lucideByName: Record<string, LucideIcon> = {
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  TriangleAlert,
  ListFilter,
  Plus,
  Settings,
  Download,
  RefreshCw,
  Ellipsis,
  EllipsisVertical,
};

export function lucideIcon(name: string, size = 16): ReactNode {
  const Icon = lucideByName[name];
  return Icon ? <Icon size={size} aria-hidden /> : null;
}
