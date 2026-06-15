# GoGraph — Product context

> See `docs/PROJECT.md` for the full product description, data sources, and architecture. This file is the design-system pointer for impeccable.

## What it is

Internal analytics dashboard at GoCase for multi-touch marketing attribution. Combines Markov chain removal effect + Shapley values + ROAS to recommend budget decisions per channel.

## Who uses it

- Growth/Media team — reads channels table + budget recommendations, decides reallocations.
- Data/Modeling team — runs executions, audits data quality, compares scenarios.
- Ad-hoc analysts — uses the sandbox to simulate "what if we cut channel X".

## Register

**product** — app UI / internal dashboard. Design serves the data; clarity beats personality. Not a marketing site.

## Surfaces

6 routes under a single AppShell (sidebar 264px + main):

- `/` — Visão Geral (KPIs, decisions carousel, consensus matrix, journey summary)
- `/decisoes-de-budget` — channels table + allocation bubble matrix + channel drawer
- `/decisoes-de-budget/canais/:slug` — channel 360 (metrics + role + sequences + trend)
- `/jornadas` — Sankey / graph / paths / transition matrix / loops
- `/experimentos` — scenario builder + baseline vs scenario + waterfall + comparison table
- `/execucoes-e-qualidade` — execution history + trust center + comparison + details panel

## Visual language

Documented in `gograph/frontend/src/shared/tokens/tokens.css` and `tokens.ts`.

- Palette: `blue / green / red / orange / indigo / cyan / neutral` (NO purple — replaced by indigo `#5B4FE5` after impeccable audit).
- Body text secondary `#3F4D6E` (WCAG AA on `#F7F9FE`).
- Type: Geist (display, h1-h6, metric values) + Inter (body).
- Tone semantics for recommendations: Escalar→green, Defender→orange, Investigar→blue, Reduzir→red.
- 4pt spacing scale (`--gg-space-1..8`), semantic z-index scale.

## Stack

React 19 + TS strict + Vite 7 + React Router 6 + @tanstack/react-query + @tanstack/react-table + @radix-ui/* + recharts + @nivo/sankey + @xyflow/react + react-hook-form + zod + lucide-react.

## Conventions

- `src/shared/{ui,charts,format,hooks,icons,tokens}/` — pure, no domain knowledge.
- `src/features/<f>/` — one folder per screen; `<Feature>Page.tsx` + `types.ts` + `<feature>.mock.ts` + `hooks/` + `components/`.
- No cross-feature imports.
- Mocks live next to the feature, mirror the JSON contract in `docs/gograph-refactor-instrucoes/`.
- TODO(api): markers where the API doesn't yet cover a field.

Full contributor guide: `gograph/frontend/README.md`.
