import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { OverviewPage } from "../features/overview/OverviewPage";
import { BudgetDecisionsPage } from "../features/budget-decisions/BudgetDecisionsPage";
import { Channel360Page } from "../features/channel-360/Channel360Page";
import { JourneysPage } from "../features/journeys/JourneysPage";
import { ExperimentsPage } from "../features/experiments/ExperimentsPage";
import { ExecutionsQualityPage } from "../features/executions-quality/ExecutionsQualityPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "performance", element: <BudgetDecisionsPage /> },
      { path: "performance/canais/:slug", element: <Channel360Page /> },
      // Legacy slugs kept so old links keep working.
      { path: "decisoes-de-budget", element: <BudgetDecisionsPage /> },
      { path: "decisoes-de-budget/canais/:slug", element: <Channel360Page /> },
      { path: "jornadas", element: <JourneysPage /> },
      { path: "experimentos", element: <ExperimentsPage /> },
      { path: "execucoes-e-qualidade", element: <ExecutionsQualityPage /> },
      { path: "configuracoes", element: <SettingsPage /> },
    ],
  },
]);
