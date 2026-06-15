import { LayoutDashboard, Wallet, Workflow, FlaskConical, ShieldCheck, Settings } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  to: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "overview",  label: "Visão Geral",          icon: LayoutDashboard, to: "/" },
  { id: "budget",    label: "Decisões de Budget",   icon: Wallet,          to: "/decisoes-de-budget" },
  { id: "journeys",  label: "Jornadas",             icon: Workflow,        to: "/jornadas" },
  { id: "experiments", label: "Experimentos",       icon: FlaskConical,    to: "/experimentos" },
  { id: "executions", label: "Execuções & Qualidade", icon: ShieldCheck,   to: "/execucoes-e-qualidade" },
];

export const BOTTOM_NAV: NavItem[] = [
  { id: "settings", label: "Configurações", icon: Settings, to: "/configuracoes" },
];
