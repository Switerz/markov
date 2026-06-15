# GoGraph Frontend

React + Vite + TypeScript SPA for the GoGraph attribution platform.

## Stack
- React 19 + TypeScript 5.9 (strict)
- Vite 7
- react-router-dom 6 (browser router via `createBrowserRouter` + `RouterProvider`)
- @tanstack/react-query 5 (server state)
- @tanstack/react-table 8 (data tables)
- react-hook-form 7 + zod 3 (forms + validation)
- @radix-ui/react-* (dialog, tabs, select, slider, switch, dropdown-menu, tooltip, popover)
- recharts + @nivo/sankey + @xyflow/react (charts and graphs)
- lucide-react (icons)
- vitest + @testing-library/react (tests, jsdom)

## Commands
```bash
npm install         # install deps
npm run dev         # vite dev server at http://127.0.0.1:5173
npm run build       # type-check + production build to dist/
npm test            # run vitest once
npm run test:watch  # vitest watch mode
```

The full stack (API + front) can be started with `./dev.sh` from the repo root.

## Folder structure

```
src/
├── app/                          AppShell + Sidebar + TopBar + router + Providers
├── shared/                       Reusable layer (no domain knowledge)
│   ├── ui/                       Button, Card, MetricCard, DataTable, Drawer, Tabs, ...
│   ├── charts/                   BubbleMatrix, DonutRoleChart, WaterfallChart, ...
│   ├── format/                   pt-BR formatters (BRL, percent, slugify)
│   ├── hooks/                    cross-feature hooks (e.g. useScenarioSimulation)
│   ├── icons/                    channel icon resolver
│   └── tokens/                   design tokens (CSS + TS)
├── features/                     One folder per screen
│   ├── overview/
│   ├── budget-decisions/
│   ├── channel-360/
│   ├── journeys/
│   ├── experiments/
│   └── executions-quality/
│        Each feature has: <Feature>Page.tsx, types.ts, <feature>.mock.ts,
│        hooks/use<Feature>Data.ts, components/<Section>.tsx
├── lib/
│   └── api.ts                    HTTP client for the FastAPI backend
└── test/
    └── setup.ts                  jest-dom + jsdom polyfills for Radix
```

## Architectural rules
1. **Tokens only**: never hardcode colors except `#fff` on filled surfaces. Every other color comes from `var(--gg-*)`.
2. **No cross-feature imports**: `features/X` may import from `shared/`, `app/`, and its own files only. If two features need the same helper, hoist it to `shared/`.
3. **Charts are pure**: they receive `data` + `config` props, never call `api`.
4. **API calls go through React Query hooks** under `features/<f>/hooks/use<X>.ts`. The query-key convention is documented at the bottom of `lib/api.ts`.
5. **Mocks live next to the feature**: `<feature>.mock.ts` mirrors the contract JSON in `docs/gograph-refactor-instrucoes/` and is the source of truth until the API covers a field. Mark missing endpoints with `TODO(api):` comments.
6. **Icon-only buttons must have `aria-label`** (enforced by lint pattern + manual review).
7. **Mobile-first**: every feature collapses gracefully at `≤ 1080px` (single-column layout, tables scroll horizontally).

## Adding a new route
1. Create `src/features/<new-feature>/{NewFeaturePage.tsx, types.ts, new-feature.mock.ts, components/}`.
2. Register the route in `src/app/routes.tsx`.
3. Add a nav entry in `src/app/nav.ts`.
4. Build sections, all backed by `shared/ui` and `shared/charts` primitives.
5. Add a smoke test under `src/features/<new-feature>/NewFeaturePage.test.tsx`.

## Tokens
See `src/shared/tokens/tokens.css` for the full palette + spacing + typography + z-index scale. Hot paths:
- `--gg-blue`, `--gg-green`, `--gg-red`, `--gg-orange`, `--gg-indigo`, `--gg-cyan`, `--gg-neutral` — semantic palette.
- `--gg-text-primary`, `--gg-text-secondary`, `--gg-text-tertiary` — text scale (secondary passes WCAG AA on `--gg-surface-soft`).
- `--gg-font-display` (Geist) for headings; `--gg-font-body` (Inter) for body.

## Tests
`npm test` runs Vitest in jsdom. The setup file (`src/test/setup.ts`) polyfills `ResizeObserver`, pointer capture, and `scrollIntoView` so Radix primitives work under jsdom.
