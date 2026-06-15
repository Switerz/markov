import {
  Workflow,
  Network,
  Route,
  Grid3X3,
  type LucideIcon,
} from "lucide-react";
import { Tabs } from "../../../shared/ui";
import type { ViewTab } from "../types";

export type JourneyViewTabsProps = {
  tabs: ViewTab[];
};

const iconByName: Record<string, LucideIcon> = {
  Workflow,
  Network,
  Route,
  Grid3X3,
};

export function JourneyViewTabs({ tabs }: JourneyViewTabsProps) {
  return (
    <Tabs.List aria-label="Visualização das jornadas">
      {tabs.map((tab) => {
        const Icon = iconByName[tab.icon];
        return (
          <Tabs.Trigger key={tab.id} value={tab.id}>
            {Icon && (
              <Icon
                size={14}
                aria-hidden
                style={{ marginRight: 6, verticalAlign: "-2px" }}
              />
            )}
            {tab.label}
          </Tabs.Trigger>
        );
      })}
    </Tabs.List>
  );
}
