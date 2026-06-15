# GoGraph Frontend Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Cada fase termina com commit. Não pule fases — Phase 0..2 são fundação para todas as 6 telas.

**Goal:** Reescrever o frontend GoGraph (atualmente `App.tsx` 66KB + `SandboxView.tsx` 30KB monolíticos) em uma arquitetura modular por feature, com design-system compartilhado, alinhada ao contrato `docs/gograph-refactor-instrucoes/00-06.md` e livre dos 4 anti-patterns do impeccable.

**Architecture:**
- **Vite + React 19 + TypeScript strict** (já existe — preservar).
- **Roteamento por feature** via `react-router-dom` v6 (6 rotas + rota interna `/decisoes-de-budget/canais/:slug`).
- **Camada `app/`** com `AppShell` (sidebar + topbar) + provider de query + provider de tema.
- **Camada `shared/`** (`ui/`, `charts/`, `format/`, `hooks/`, `tokens/`) — primitivos sem conhecimento de domínio.
- **Camada `features/`** — 1 pasta por tela com `<Feature>Page.tsx`, `components/`, `hooks/`, `types.ts`, `*.mock.ts`.
- **Dados via React Query** (`@tanstack/react-query`) sobre o client `api.ts` existente. Para campos ainda não cobertos pela API (Sankey, waterfall, recomendações priorizadas), começa com mocks tipados e migra incrementalmente — cada mock vive em `*.mock.ts` ao lado do hook que o consome.
- **Tokens visuais** em `shared/tokens/tokens.css` + `tokens.ts`, baseados no JSON do contrato (`--gg-blue: #245BFF`, `--gg-ink: #07133F`, etc.). Substitui o purple/violet do impeccable warning.
- **Tipografia dual**: `Inter` (corpo) + `Söhne`/`Geist`/`IBM Plex Sans` (display) para resolver `single-font` e `overused-font`. Decisão: usaremos **Geist (display) + Inter (body)** — Geist é distintivo, free, hospedado no Google Fonts; Inter fica só para texto pequeno tabular. Esse pareamento bate as duas regras do impeccable (contraste de eixo geométrico vs neutro, par real).
- **Contraste**: subir `--gg-text-secondary` de `#64748b`/`#53617C` para `#3F4D6E` (5.0:1 em `#F7F9FE`), satisfazendo WCAG AA.
- **Paleta**: substitui o roxo/violeta `#8B5CF6` por `#5B4FE5` (índigo mais escuro, fora do banner clichê de IA) — usado só em micro-acentos e na trilha de "Investimento em mídia".
- **Tabelas**: `@tanstack/react-table` (sem componentes pesados).
- **Forms**: `react-hook-form` + `zod`.
- **Charts**: `recharts` (já presente) para barras/linhas/donut/waterfall; `@nivo/sankey` para o fluxo de jornadas; matriz/bubble feita à mão em SVG dentro de `shared/charts/BubbleMatrix.tsx` (componente puro, sem libs extras).
- **Acessibilidade**: foco visível, `aria-label` em ícones-button, `Esc` fecha drawer, contraste auditado por `axe-core` em testes.
- **Testes**: Vitest + Testing Library para formatadores, simulações e componentes críticos. Playwright opcional fica fora do escopo desta fase.

**Tech Stack:**
- React 19, TypeScript 5.9, Vite 7 (mantém)
- **Adicionar**: `react-router-dom@6`, `@tanstack/react-query@5`, `@tanstack/react-table@8`, `react-hook-form@7`, `zod@3`, `@hookform/resolvers`, `@radix-ui/react-{dialog,tabs,select,slider,switch,dropdown-menu,tooltip,popover}`, `@nivo/core` + `@nivo/sankey`, `clsx`, `tailwind-merge` (opcional), `date-fns@4`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@axe-core/react`.

**Premissas de execução:**
- Trabalho na branch atual `feat/markov-ubiquity-analysis`. Se preferir isolar, criar worktree antes de começar (`git worktree add ../markov-frontend feat/frontend-refactor`).
- Backend em `http://127.0.0.1:8000` precisa estar de pé para validar Phase 3 em diante. `./dev.sh` resolve.
- `npm install` no diretório `gograph/frontend`.
- A `App.tsx` antiga **não é deletada** até a Phase 10 — o switch do `main.tsx` para o novo `AppShell` acontece na Phase 4, com o roteador novo importando placeholders das telas. As 6 features substituem placeholders em ordem nas Phases 5–10.

---

## Phase 0 — Bootstrap (deps, estrutura, tokens, fontes)

### Task 0.1: Instalar dependências novas

**Files:**
- Modify: `gograph/frontend/package.json`

**Step 1:** Rodar comando

```bash
cd gograph/frontend
npm install react-router-dom@^6 @tanstack/react-query@^5 @tanstack/react-table@^8 \
  react-hook-form@^7 zod@^3 @hookform/resolvers@^3 \
  @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-slider \
  @radix-ui/react-switch @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-popover \
  @nivo/core@^0.99 @nivo/sankey@^0.99 \
  clsx tailwind-merge date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react @types/node
```

**Step 2:** Verificar `package.json` lista todas as deps e roda `npm run dev` sem erro de import (App.tsx ainda em uso).

**Step 3:** Commit
```bash
git add gograph/frontend/package.json gograph/frontend/package-lock.json
git commit -m "feat(frontend): add deps for refactor (router, query, table, charts, radix)"
```

### Task 0.2: Configurar Vitest

**Files:**
- Create: `gograph/frontend/vitest.config.ts`
- Create: `gograph/frontend/src/test/setup.ts`
- Modify: `gograph/frontend/package.json` (scripts `test`, `test:watch`)
- Modify: `gograph/frontend/tsconfig.json` (`types: ["vitest/globals"]`)

**Step 1:** `vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
```

**Step 2:** `src/test/setup.ts`
```ts
import "@testing-library/jest-dom/vitest";
```

**Step 3:** Adicionar em `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4:** Rodar `npm test` — espera "no test files found" sem erros.

**Step 5:** Commit
```bash
git add gograph/frontend/vitest.config.ts gograph/frontend/src/test/setup.ts gograph/frontend/package.json gograph/frontend/tsconfig.json
git commit -m "test(frontend): wire up vitest"
```

### Task 0.3: Criar árvore de pastas `src/`

**Files (todos com `.gitkeep` para versionar diretórios vazios):**
```
gograph/frontend/src/
├── app/
├── shared/
│   ├── ui/
│   ├── charts/
│   ├── format/
│   ├── hooks/
│   ├── icons/
│   └── tokens/
├── features/
│   ├── overview/components/
│   ├── budget-decisions/components/
│   ├── channel-360/components/
│   ├── journeys/components/
│   ├── experiments/components/
│   └── executions-quality/components/
├── lib/
│   └── (api.ts já existe — vai mudar de lugar na Task 3.1)
└── test/ (já criado em 0.2)
```

**Step 1:** Criar dirs e `.gitkeep` em cada folha:
```bash
cd gograph/frontend/src
mkdir -p app shared/{ui,charts,format,hooks,icons,tokens} \
  features/{overview,budget-decisions,channel-360,journeys,experiments,executions-quality}/components lib
for d in app shared/ui shared/charts shared/format shared/hooks shared/icons shared/tokens \
         features/overview features/overview/components \
         features/budget-decisions features/budget-decisions/components \
         features/channel-360 features/channel-360/components \
         features/journeys features/journeys/components \
         features/experiments features/experiments/components \
         features/executions-quality features/executions-quality/components \
         lib; do touch "$d/.gitkeep"; done
```

**Step 2:** Commit
```bash
git add gograph/frontend/src/
git commit -m "chore(frontend): scaffold feature/shared directory tree"
```

### Task 0.4: Tokens de design (CSS variables + TS export)

**Files:**
- Create: `gograph/frontend/src/shared/tokens/tokens.css`
- Create: `gograph/frontend/src/shared/tokens/tokens.ts`

**Step 1:** `tokens.css` — escreve as variáveis a partir do `visualTokens` do contrato + correções do impeccable:
```css
:root {
  /* Surfaces */
  --gg-bg: #FFFFFF;
  --gg-surface: #FFFFFF;
  --gg-surface-soft: #F7F9FE;
  --gg-surface-muted: #EEF2FB;
  --gg-border: #DDE4F2;
  --gg-border-strong: #C2CCDF;

  /* Text — secundário subido para passar WCAG AA em #F7F9FE */
  --gg-text-primary: #07133F;
  --gg-text-secondary: #3F4D6E;   /* era #53617C/#64748B — agora 5.0:1 */
  --gg-text-tertiary: #5B6A89;

  /* Accents */
  --gg-blue: #245BFF;
  --gg-blue-soft: #E8EEFF;
  --gg-green: #16A34A;
  --gg-green-soft: #DCFCE7;
  --gg-red: #EF4444;
  --gg-red-soft: #FEE2E2;
  --gg-orange: #F59E0B;
  --gg-orange-soft: #FEF3C7;
  --gg-indigo: #5B4FE5;            /* substitui purple #8B5CF6 */
  --gg-indigo-soft: #E6E3FB;
  --gg-cyan: #20C7B5;
  --gg-cyan-soft: #D5F5EF;
  --gg-neutral: #5B6A89;
  --gg-neutral-soft: #EEF2FB;

  /* Radius */
  --gg-radius-card: 8px;
  --gg-radius-control: 8px;
  --gg-radius-pill: 999px;

  /* Shadow */
  --gg-shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.06);
  --gg-shadow-elev: 0 18px 40px rgba(15, 23, 42, 0.08);

  /* Type */
  --gg-font-display: "Geist", "Inter", system-ui, sans-serif;
  --gg-font-body: "Inter", system-ui, sans-serif;
  --gg-font-mono: "Geist Mono", ui-monospace, monospace;

  /* Spacing scale (4pt base) */
  --gg-space-1: 4px;
  --gg-space-2: 8px;
  --gg-space-3: 12px;
  --gg-space-4: 16px;
  --gg-space-5: 24px;
  --gg-space-6: 32px;
  --gg-space-7: 48px;
  --gg-space-8: 64px;

  /* Z-index scale */
  --gg-z-dropdown: 10;
  --gg-z-sticky: 20;
  --gg-z-drawer: 40;
  --gg-z-modal-backdrop: 50;
  --gg-z-modal: 60;
  --gg-z-toast: 70;
  --gg-z-tooltip: 80;
}

html, body { font-family: var(--gg-font-body); color: var(--gg-text-primary); background: var(--gg-bg); }
button, input, select, textarea { font-family: inherit; }
```

**Step 2:** `tokens.ts` — export tipado:
```ts
export const tokens = {
  color: {
    bg: "var(--gg-bg)",
    surface: "var(--gg-surface)",
    surfaceSoft: "var(--gg-surface-soft)",
    border: "var(--gg-border)",
    textPrimary: "var(--gg-text-primary)",
    textSecondary: "var(--gg-text-secondary)",
    blue: "var(--gg-blue)",
    green: "var(--gg-green)",
    red: "var(--gg-red)",
    orange: "var(--gg-orange)",
    indigo: "var(--gg-indigo)",
    cyan: "var(--gg-cyan)",
    neutral: "var(--gg-neutral)",
  },
  tone: ["blue", "green", "red", "orange", "indigo", "cyan", "neutral"] as const,
} as const;
export type Tone = (typeof tokens.tone)[number];
```

**Step 3:** Commit
```bash
git add gograph/frontend/src/shared/tokens/
git commit -m "feat(tokens): design tokens (colors, type, spacing, z-index)"
```

### Task 0.5: Carregar fontes Geist + Inter

**Files:**
- Modify: `gograph/frontend/index.html`

**Step 1:** Adicionar dentro de `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

**Step 2:** Rodar `npm run dev`, abrir DevTools → Network, confirmar carregamento das duas famílias.

**Step 3:** Commit
```bash
git add gograph/frontend/index.html
git commit -m "feat(frontend): load Geist + Inter font pair"
```

---

## Phase 1 — Shared UI primitives

Cada primitivo: arquivo único, props tipados, story-test mínimo em `*.test.tsx` (smoke + variantes). DRY rules: nenhum componente conhece domínio nem chama API.

### Task 1.1: `cn` utility (clsx + tailwind-merge)

**Files:**
- Create: `gograph/frontend/src/shared/ui/cn.ts`

**Step 1:**
```ts
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

**Step 2:** Commit `feat(ui): cn class merge utility`.

### Task 1.2: Formatadores numéricos

**Files:**
- Create: `gograph/frontend/src/shared/format/currency.ts`
- Create: `gograph/frontend/src/shared/format/percent.ts`
- Create: `gograph/frontend/src/shared/format/number.ts`
- Create: `gograph/frontend/src/shared/format/index.ts`
- Test: `gograph/frontend/src/shared/format/format.test.ts`

**Step 1 — Test first:**
```ts
import { formatBRL, formatCompactBRL } from "./currency";
import { formatPercent, formatPercentPoints } from "./percent";
import { formatNumber, formatMultiplier } from "./number";

it("formatBRL", () => expect(formatBRL(24800000)).toBe("R$ 24.800.000,00"));
it("formatCompactBRL", () => expect(formatCompactBRL(24800000)).toBe("R$ 24,8M"));
it("formatPercent", () => expect(formatPercent(0.0348)).toBe("3,48%"));
it("formatPercentPoints", () => expect(formatPercentPoints(0.0039)).toBe("+0,39 p.p."));
it("formatMultiplier", () => expect(formatMultiplier(6.02)).toBe("6,02x"));
it("formatNumber compact", () => expect(formatNumber(16492, { compact: true })).toBe("16,5 mil"));
```

**Step 2:** Implementar usando `Intl.NumberFormat("pt-BR", ...)`:
```ts
// currency.ts
export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
export const formatCompactBRL = (v: number) =>
  "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

// percent.ts
export const formatPercent = (v: number, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const formatPercentPoints = (v: number) => {
  const pp = v * 100;
  const s = pp >= 0 ? "+" : "";
  return `${s}${pp.toFixed(2).replace(".", ",")} p.p.`;
};

// number.ts
export const formatMultiplier = (v: number) => `${v.toFixed(2).replace(".", ",")}x`;
export const formatNumber = (v: number, opts: { compact?: boolean } = {}) =>
  new Intl.NumberFormat("pt-BR", {
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(v).replace("M", "mi").replace("K", "mil");
```

**Step 3:** `npm test` — passar.

**Step 4:** Commit `feat(format): pt-BR number/currency/percent formatters`.

### Task 1.3: `Button`

**Files:**
- Create: `gograph/frontend/src/shared/ui/Button.tsx`
- Test: `gograph/frontend/src/shared/ui/Button.test.tsx`

**Step 1 — props:**
```ts
type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
};
```

**Step 2:** Implementar com classes baseadas em tokens (`bg-[var(--gg-blue)]` ou um wrapper) — usar CSS module `Button.module.css` para encapsular sem Tailwind.

**Step 3:** Teste smoke:
```tsx
it("renders primary with label", () => {
  render(<Button variant="primary">Nova execucao</Button>);
  expect(screen.getByRole("button", { name: /nova execucao/i })).toBeInTheDocument();
});
it("icon variant requires aria-label (a11y)", () => {
  render(<Button variant="icon" aria-label="Mais opções"><span /></Button>);
  expect(screen.getByLabelText(/mais opcoes/i)).toBeInTheDocument();
});
```

**Step 4:** Commit `feat(ui): Button (primary/secondary/ghost/danger/icon)`.

### Task 1.4: `Card` (e `Card.Header`, `Card.Title`, `Card.Body`, `Card.Footer`)

**Files:**
- Create: `gograph/frontend/src/shared/ui/Card.tsx`
- Test: `gograph/frontend/src/shared/ui/Card.test.tsx`

Compor com `forwardRef`. Borda `var(--gg-border)`, raio `var(--gg-radius-card)`, sombra `var(--gg-shadow-soft)`.

Commit `feat(ui): Card composition`.

### Task 1.5: `Badge`

**Files:**
- Create: `gograph/frontend/src/shared/ui/Badge.tsx`
- Test: `gograph/frontend/src/shared/ui/Badge.test.tsx`

Props: `tone: Tone`, `variant: "solid" | "soft" | "outline"`, `size: "sm" | "md"`. Soft é o default (usado nas recomendações `Escalar`/`Defender`/etc).

Commit `feat(ui): Badge`.

### Task 1.6: `StatDelta`

**Files:**
- Create: `gograph/frontend/src/shared/ui/StatDelta.tsx`
- Test: `gograph/frontend/src/shared/ui/StatDelta.test.tsx`

Props: `value: string`, `label?: string`, `tone: "positive" | "negative" | "neutral" | "warning"`. Renderiza seta `ArrowUp`/`ArrowDown` + texto. Cor por tone via tokens.

Commit `feat(ui): StatDelta`.

### Task 1.7: `MetricCard`

**Files:**
- Create: `gograph/frontend/src/shared/ui/MetricCard.tsx`
- Test: `gograph/frontend/src/shared/ui/MetricCard.test.tsx`

Props batendo com o tipo `Metric` do contrato:
```ts
export type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  delta?: { value: string; label: string; tone: "positive" | "negative" | "neutral" | "warning" };
  icon: React.ReactNode;
  tone: Tone;
};
```

Layout: tile do ícone (32px) à esquerda com fundo tone-soft, título + valor + subtitle + StatDelta.

Commit `feat(ui): MetricCard`.

### Task 1.8: `DataTable` (wrapper sobre @tanstack/react-table)

**Files:**
- Create: `gograph/frontend/src/shared/ui/DataTable.tsx`
- Create: `gograph/frontend/src/shared/ui/DataTable.module.css`
- Test: `gograph/frontend/src/shared/ui/DataTable.test.tsx`

Props genéricos:
```ts
export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  enableColumnVisibility?: boolean;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string;
  getRowId?: (row: TData) => string;
  emptyState?: React.ReactNode;
  pageSize?: number;
};
```

Inclui: header sticky, busca global, paginação, hover row, linha selecionada destacada (fundo `--gg-blue-soft`).

Commit `feat(ui): DataTable (tanstack-table wrapper)`.

### Task 1.9: `Tabs` (Radix Tabs styled)

**Files:**
- Create: `gograph/frontend/src/shared/ui/Tabs.tsx`
- Test: `gograph/frontend/src/shared/ui/Tabs.test.tsx`

Re-exporta `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`. Active tab: underline azul + texto bold.

Commit `feat(ui): Tabs (Radix)`.

### Task 1.10: `Select`, `DateRangePicker`, `Switch`, `Slider`, `Tooltip`, `Drawer` (Radix wrappers)

**Files:** um arquivo por componente em `src/shared/ui/`.

- `Select.tsx` — Radix Select, suporta `icon` à esquerda do trigger.
- `DateRangePicker.tsx` — começa como Radix Popover + `<input type="text">` formatado por `date-fns` (`format(d, "dd MMM yyyy", { locale: ptBR })`). Iteração 2 substitui por calendário visual; iteração 1 aceita digitação.
- `Switch.tsx` — Radix Switch.
- `Slider.tsx` — Radix Slider single ou range.
- `Tooltip.tsx` — Radix Tooltip com `aria-describedby` automático.
- `Drawer.tsx` — Radix Dialog em side="right", largura 360–420px, trap de foco e fechamento por `Esc` nativos do Radix.

Teste smoke para cada (montagem + acessibilidade básica).

Commit `feat(ui): Select/DateRangePicker/Switch/Slider/Tooltip/Drawer (Radix)`.

### Task 1.11: `ProgressBar`, `IconTile`

**Files:**
- Create: `gograph/frontend/src/shared/ui/ProgressBar.tsx`
- Create: `gograph/frontend/src/shared/ui/IconTile.tsx`

`ProgressBar`: track + fill, label opcional à direita, prop `tone`.
`IconTile`: quadrado 32px/40px com fundo tone-soft e ícone tone-strong, usado em `MetricCard` e `DecisionCard`.

Commit `feat(ui): ProgressBar + IconTile`.

### Task 1.12: Barrel `shared/ui/index.ts`

Export central. Commit `chore(ui): barrel exports`.

---

## Phase 2 — Shared chart primitives

Todos os charts são puros — recebem `data` + `config`. Tamanho responsivo via `ResponsiveContainer` (recharts) ou prop `height`.

### Task 2.1: `BubbleMatrix` (SVG puro)

**Files:**
- Create: `gograph/frontend/src/shared/charts/BubbleMatrix.tsx`
- Test: `gograph/frontend/src/shared/charts/BubbleMatrix.test.tsx`

Props:
```ts
export type BubblePoint = {
  id: string;
  x: number;          // 0..100 (ou negativo, se domain assim)
  y: number;
  size: number;       // raw value — escalado para raio
  tone: Tone;
  label: string;
};
export type BubbleMatrixProps = {
  points: BubblePoint[];
  axes: { x: string; y: string };
  quadrants: { label: string; position: "top-left" | "top-right" | "bottom-left" | "bottom-right"; description?: string }[];
  xScale?: "linear" | "log";
  yScale?: "linear" | "log";
  xDomain?: [number, number];
  yDomain?: [number, number];
  onPointClick?: (id: string) => void;
  height?: number;
};
```

Implementação:
- SVG 100% width × `height` (default 360).
- Padding interno para eixos.
- Grid de 4 quadrantes com label canto + description (`var(--gg-text-secondary)`).
- Escalas linear/log feitas com helpers internos (sem d3 — math simples).
- Bolha: `circle` com `fill="var(--gg-{tone})"` opacity 0.7 + tooltip nativo (`<title>`) inicialmente.

Teste: render N pontos, verifica `<circle>` correspondente, click handler dispara.

Commit `feat(charts): BubbleMatrix (SVG, 4-quadrant scatter)`.

### Task 2.2: `DonutRoleChart` (recharts PieChart)

**Files:**
- Create: `gograph/frontend/src/shared/charts/DonutRoleChart.tsx`

Props:
```ts
export type DonutRoleChartProps = {
  segments: { label: string; description?: string; value: number; tone: Tone }[];
  centerLabel?: string;
};
```

Donut com `innerRadius=60%`, gap entre slices, legenda à direita (não embaixo).

Commit `feat(charts): DonutRoleChart`.

### Task 2.3: `WaterfallChart`

**Files:**
- Create: `gograph/frontend/src/shared/charts/WaterfallChart.tsx`

Props:
```ts
export type WaterfallStep = {
  label: string;
  value: number;
  display: string;
  type: "start" | "positive" | "negative" | "bridge" | "end";
};
export type WaterfallChartProps = {
  steps: WaterfallStep[];
  height?: number;
};
```

Implementação com `recharts/BarChart` + cálculo de base (running total) por step. Cores: start/end neutros, positive verde, negative vermelho, bridge transparente.

Commit `feat(charts): WaterfallChart`.

### Task 2.4: `BarLineTrendChart`

**Files:**
- Create: `gograph/frontend/src/shared/charts/BarLineTrendChart.tsx`

Combined chart (recharts `ComposedChart`): bars empilhadas/agrupadas para `markov`/`shapley`/`lastClick` + linha pontilhada de ROAS no eixo Y secundário.

Commit `feat(charts): BarLineTrendChart (combined bars + line)`.

### Task 2.5: `SankeyJourneyChart`

**Files:**
- Create: `gograph/frontend/src/shared/charts/SankeyJourneyChart.tsx`

Wrap em `@nivo/sankey/ResponsiveSankey`. Props:
```ts
export type SankeyNode = { id: string; tone?: Tone; icon?: React.ReactNode };
export type SankeyLink = { source: string; target: string; value: number };
export type SankeyJourneyChartProps = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  metricLabel: string;
};
```

Tema custom: cor por tone via `tokens.color[*]`, fonte `Inter`.

Commit `feat(charts): SankeyJourneyChart (nivo)`.

### Task 2.6: `TransitionHeatmap`

**Files:**
- Create: `gograph/frontend/src/shared/charts/TransitionHeatmap.tsx`

Matriz NxN com opacidade do `var(--gg-blue)` proporcional ao valor (clamp 0..1). Diagonal nula renderiza hachurada / cinza claro. Header sticky para linha/coluna.

Commit `feat(charts): TransitionHeatmap`.

### Task 2.7: Barrel `shared/charts/index.ts`

Commit `chore(charts): barrel exports`.

---

## Phase 3 — Data layer (api + react-query + mocks tipados)

### Task 3.1: Mover `api.ts` para `lib/`

**Files:**
- Move: `gograph/frontend/src/api.ts` → `gograph/frontend/src/lib/api.ts`
- Modify: `gograph/frontend/src/App.tsx` (re-aponta import) e `SandboxView.tsx`.

**Step 1:** `git mv` para preservar histórico:
```bash
git mv gograph/frontend/src/api.ts gograph/frontend/src/lib/api.ts
```

**Step 2:** Atualizar 2 imports:
- `App.tsx`: `from "./api"` → `from "./lib/api"`
- `SandboxView.tsx`: idem.

**Step 3:** Rodar `npm run dev` — verificar que tela antiga ainda funciona.

**Step 4:** Commit `chore(frontend): move api.ts under lib/`.

### Task 3.2: QueryClient + Provider

**Files:**
- Create: `gograph/frontend/src/app/queryClient.ts`
- Create: `gograph/frontend/src/app/Providers.tsx`

**Step 1:** `queryClient.ts`
```ts
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
```

**Step 2:** `Providers.tsx`
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./queryClient";
import { TooltipProvider } from "../shared/ui/Tooltip";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

**Step 3:** Commit `feat(app): QueryClient + Providers wrapper`.

### Task 3.3: Hooks de domínio em cada feature

Cada feature terá seu próprio `hooks/use<X>.ts` no momento da Phase respectiva. Phase 3 só define o padrão:

```ts
// padrão
export function useModelRuns() {
  return useQuery({ queryKey: ["runs"], queryFn: () => api.listRuns() });
}
export function useChannels(runId: number | null) {
  return useQuery({
    queryKey: ["channels", runId],
    enabled: runId != null,
    queryFn: () => api.getChannels(runId!),
  });
}
```

Sem código novo agora — só doc inline em `lib/api.ts` final do arquivo:
```ts
// Convention: feature-scoped query hooks live under features/<f>/hooks/use<X>.ts
// and use the keys: ["runs"], ["overview", id], ["channels", id], ["graph", id], ["paths", id], ...
```

Commit `docs(lib): query-key convention`.

### Task 3.4: Mocks tipados por tela

**Files (1 por feature, criados vazios agora; populados nas Phases 5–10):**
- `features/overview/overview.mock.ts`
- `features/budget-decisions/budget-decisions.mock.ts`
- `features/channel-360/channel-360.mock.ts`
- `features/journeys/journeys.mock.ts`
- `features/experiments/experiments.mock.ts`
- `features/executions-quality/executions-quality.mock.ts`

Cada um exporta um objeto `<feature>Mock` espelhando o JSON do contrato com tipos locais (`<feature>/types.ts`). Os tipos saem do JSON via inferência manual — NÃO `as any`.

Cria os arquivos com placeholder:
```ts
import type { OverviewData } from "./types";
export const overviewMock: OverviewData = { /* preencher na Phase 5 */ } as const;
```

Cria também `types.ts` em cada feature com `export type <Feature>Data = {...}` vazio (`{}` por enquanto).

Commit `chore(features): mock + types skeletons`.

---

## Phase 4 — AppShell + roteador

### Task 4.1: `Sidebar`

**Files:**
- Create: `gograph/frontend/src/app/Sidebar.tsx`
- Create: `gograph/frontend/src/app/Sidebar.module.css`

Largura 264px, lista de itens vindo de constante `NAV_ITEMS` em `app/nav.ts`:
```ts
export const NAV_ITEMS = [
  { id: "overview", label: "Visão Geral", icon: "LayoutDashboard", to: "/" },
  { id: "budget", label: "Decisões de Budget", icon: "Wallet", to: "/decisoes-de-budget" },
  { id: "journeys", label: "Jornadas", icon: "Workflow", to: "/jornadas" },
  { id: "experiments", label: "Experimentos", icon: "FlaskConical", to: "/experimentos" },
  { id: "executions", label: "Execuções & Qualidade", icon: "ShieldCheck", to: "/execucoes-e-qualidade" },
] as const;
export const BOTTOM_NAV = [{ id: "settings", label: "Configurações", icon: "Settings", to: "/configuracoes" }];
```

Item ativo: fundo `var(--gg-blue-soft)`, texto `var(--gg-blue)`, ícone idem. Bloco do usuário no rodapé (avatar com iniciais, nome, role).

Acessibilidade: `<nav aria-label="Navegação principal">`, `aria-current="page"` no item ativo.

Commit `feat(app): Sidebar with nav + user`.

### Task 4.2: `TopBar` genérica

**Files:**
- Create: `gograph/frontend/src/app/TopBar.tsx`

Slot-based:
```tsx
type TopBarProps = {
  title?: string;
  subtitle?: string;
  breadcrumb?: { label: string; to?: string }[];
  filters?: React.ReactNode;
  actions?: React.ReactNode;
};
```

Cada feature monta seus próprios filtros e ações como children.

Commit `feat(app): TopBar slot-based`.

### Task 4.3: `AppShell`

**Files:**
- Create: `gograph/frontend/src/app/AppShell.tsx`
- Create: `gograph/frontend/src/app/AppShell.module.css`

Grid: sidebar fixa + content (`min-width: 0` no main para evitar overflow).

```tsx
export function AppShell() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
```

Commit `feat(app): AppShell layout`.

### Task 4.4: `routes.tsx`

**Files:**
- Create: `gograph/frontend/src/app/routes.tsx`

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./AppShell";
import { OverviewPage } from "../features/overview/OverviewPage";
import { BudgetDecisionsPage } from "../features/budget-decisions/BudgetDecisionsPage";
import { Channel360Page } from "../features/channel-360/Channel360Page";
import { JourneysPage } from "../features/journeys/JourneysPage";
import { ExperimentsPage } from "../features/experiments/ExperimentsPage";
import { ExecutionsQualityPage } from "../features/executions-quality/ExecutionsQualityPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "decisoes-de-budget", element: <BudgetDecisionsPage /> },
      { path: "decisoes-de-budget/canais/:slug", element: <Channel360Page /> },
      { path: "jornadas", element: <JourneysPage /> },
      { path: "experimentos", element: <ExperimentsPage /> },
      { path: "execucoes-e-qualidade", element: <ExecutionsQualityPage /> },
    ],
  },
]);
```

Criar **placeholders** vazios para cada `*Page.tsx` (cada feature recebe substituição real na sua Phase 5..10):

```tsx
// features/overview/OverviewPage.tsx (placeholder)
export function OverviewPage() { return <div>Em construção</div>; }
```

(Mesma estrutura para os outros 5.)

Commit `feat(app): router + page placeholders`.

### Task 4.5: Substituir `main.tsx`

**Files:**
- Modify: `gograph/frontend/src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Providers } from "./app/Providers";
import { router } from "./app/routes";
import "./shared/tokens/tokens.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
);
```

Não importa mais `App.tsx`. App antiga fica órfã mas viva (não deletar — referência durante migração).

**Step 2:** `npm run dev` → navegar pelas 6 rotas, confirmar AppShell + sidebar + placeholder.

Commit `feat(app): switch entrypoint to router-based AppShell`.

---

## Phases 5–10 — Features

Para cada feature segue **a mesma receita** (não vou repetir tudo abaixo, só os pontos específicos):

1. Preencher `types.ts` com tipos batendo o JSON do contrato.
2. Preencher `*.mock.ts` com os dados literais do JSON.
3. Criar `<Feature>Page.tsx` montando seções com `TopBar` + componentes próprios.
4. Criar componentes internos em `components/` (1 por seção do JSON).
5. Substituir o placeholder no `routes.tsx` (já feito na Phase 4).
6. Quando o endpoint já existe (`/model-runs/{id}/...`), criar hook `hooks/use*.ts` consumindo a API; quando não existe, ficar no mock e marcar `// TODO(api): ...` na linha relevante.
7. Smoke test: `<Feature>Page` renderiza sem erro.
8. Acessibilidade: `axe.run` no teste, esperar 0 violations.
9. Commit por seção/componente para manter PR review viável.

---

## Phase 5 — Feature `overview`

Arquivo de referência: `docs/gograph-refactor-instrucoes/01-visao-geral.md`.

### Task 5.1: `overview/types.ts`
Definir `OverviewData`, `MetricItem`, `PriorityDecision`, `ModelConsensusPoint`, `JourneySummary`, `ConfidencePanel`.

### Task 5.2: `overview/overview.mock.ts`
Preencher com todos os valores do JSON do 01-visao-geral.md.

### Task 5.3: `components/OverviewHeaderFilters.tsx`
Linha de filtros (`Select` account, `DateRangePicker` período, `DateRangePicker` comparar, `Select` execução, `Badge` Confiança alta) + ações (`Button` primary "Nova execução", `Button` secondary "Exportar").

### Task 5.4: `components/MetricCardGrid.tsx`
Grid 6 colunas em desktop (responsivo: `repeat(auto-fit, minmax(220px, 1fr))`). Itera sobre `OverviewData["metrics"]` renderizando `MetricCard`.

### Task 5.5: `components/PriorityDecisionCarousel.tsx`
Faixa horizontal com scroll-snap; cada cartão = `DecisionCard` (channel icon + recommendation badge + share/spend/revenue/roas + descrição + ações).

### Task 5.6: `components/ModelConsensusMatrix.tsx`
Wrap em `BubbleMatrix` da Phase 2.

### Task 5.7: `components/JourneySummaryPanel.tsx`
3 listas ranqueadas + `JourneyFlowStepper` (5 etapas com setas).

### Task 5.8: `components/AnalysisConfidencePanel.tsx`
2 grupos de progress bars + box verde resumo.

### Task 5.9: `OverviewPage.tsx`
Compõe tudo. `TopBar` recebe `<OverviewHeaderFilters />` como `filters` e ações como `actions`. Conteúdo: MetricCardGrid → PriorityDecisionCarousel → grid 2 colunas (ModelConsensusMatrix | JourneySummaryPanel) → AnalysisConfidencePanel → footerNote.

### Task 5.10: Hook `useOverviewData`
Hoje: retorna `overviewMock`. Marcar TODO na função para futura integração com `api.getOverview(runId)` + composição de outros endpoints.

### Task 5.11: Smoke + a11y test
`OverviewPage.test.tsx`: renderiza, encontra todos os 6 títulos de métrica, `axe.run` 0 violations.

### Task 5.12: Commit final da feature
```
feat(overview): full screen — header, metrics, decisions, consensus, journey, confidence
```

---

## Phase 6 — Feature `budget-decisions`

Referência: `02-decisoes-de-budget.md`.

Componentes:
- `RecommendationSummaryCards` — 4 cards (Escalar/Defender/Investigar/Reduzir) usando `MetricCard` com `tone` semântica.
- `AllocationMatrix` — `BubbleMatrix` com `xScale="log"`.
- `OpportunitiesRisksPanel` — Card 2 colunas (oportunidades verdes / riscos vermelhos) + nota técnica abaixo.
- `ChannelDecisionTable` — `DataTable` com 10 colunas, busca, visibilidade de colunas, click na linha abre Drawer.
- `ChannelDetailsDrawer` — Radix Dialog side="right", tabs `Resumo`/`Jornada`/`Impactos`/`Cenários`. Estado controlado via prop `channel: ChannelRow | null`. Conteúdo da tab "Resumo": métricas (`MetricCard` compactos), recommendation card (Badge + descrição), bullets de rationale, role na jornada, listas `transitions.before/after`, `RecommendedActionSimulator`.
- `RecommendedActionSimulator` — `Slider` com marks `-20%` / `Atual` / `+20%` / `+40%` + caixa de impacto estimado.

Tarefas (T6.1..T6.10): types, mock, cada componente, page, hook, tests, commit.

Hook: `useBudgetDecisionsData(runId)` — tabela vem de `api.getChannels(runId)` + `api.getDiagnostics(runId)`; matriz, oportunidades/riscos e simulator continuam mock por enquanto (TODO).

---

## Phase 7 — Feature `channel-360`

Referência: `03-canal-360-google-ads.md`. Tela parametrizada por `:slug` (`useParams`).

Componentes:
- `ChannelHeader` — breadcrumb, logo do canal (mapeado de slug para ícone via `shared/icons/channelIcons.ts`), nome, badge da recomendação.
- `ChannelMetricStrip` — 5 métricas horizontais (variante mais larga do `MetricCard`).
- `AttributionEfficiencyTable` — tabela 3 linhas (Markov / Shapley / Last-click) com bar inline para `investmentShare`.
- `JourneyRoleDonut` — `DonutRoleChart` (first/middle/last touch).
- `RecommendationEvidencePanel` — coluna direita (3 colunas no grid) com 3 listas: why-increase / risks / best-practices + confidenceBox + `quickDetails`.
- `AdjacentChannelsTables` — 2 tabelas pequenas lado a lado.
- `RelevantSequencesList` — items renderizados como rows com ícones de canais + setas + uplift badge.
- `ChannelTrendChart` — `BarLineTrendChart`.

Layout: grid 12 colunas — esquerda 9 (strip + atribuição+role + adjacent + sequences + trend), direita 3 (evidence + quickDetails).

Hook: `useChannel360Data(slug)` — começa em mock; channel data real virá futuramente de um endpoint dedicado.

---

## Phase 8 — Feature `journeys`

Referência: `04-jornadas.md`.

Componentes:
- `JourneyFilters` — linha de filtros (`Select` audiência, `DateRangePicker`, `Select` comprimento, `Select` origem, `Select` destino) + 2 `Switch` (ocultar diretos / self-loops).
- `JourneyViewTabs` — Tabs (Fluxo / Grafo / Caminhos / Matriz).
- `JourneySankeyPanel` (tab Fluxo) — `SankeyJourneyChart` consumindo `api.getGraph(runId)` adaptado para nodes/links + métrica do fluxo no header.
- `JourneyGraphPanel` (tab Grafo) — reutiliza componente atual de xyflow (extraído da `App.tsx` antiga, isolado em `features/journeys/components/JourneyGraphPanel.tsx`). Refatorar para usar tokens.
- `TopPathsTable` (tab Caminhos) — `DataTable` com colunas `#`, caminho (renderizado com ícones), participação + delta, receita, conversões, ticket, tempo.
- `TransitionMatrixHeatmap` (tab Matriz) — `TransitionHeatmap`.
- `JourneyBuilder` — abaixo do Sankey: form `react-hook-form` + `zod` schema, lista visual de touchpoints (chips com `X`), botão "Adicionar touchpoint" abre Popover com Select de canais + quick suggestions, ações primary "Simular caminho" / secondary "Limpar". Interpretação estimada vem de hook puro `useScenarioSimulation` (criado em Phase 9 e compartilhado).
- `LoopsPatternsList` — cards com pattern + descrição + bars (participação/conversão).

Hooks:
- `useJourneyGraph(runId)` → `api.getGraph(runId)`
- `usePaths(runId)` → `api.getPaths(runId)`
- `useLoops(runId)` → `api.getLoops(runId)` + `api.getLoopDiagnostics(runId)`
- `useTransitionMatrix(runId)` → derivado de `useChannels` + `useGraph`.

---

## Phase 9 — Feature `experiments`

Referência: `05-experimentos.md`.

Componentes:
- `ScenarioBuilderForm` — `react-hook-form` + `zod`. Tabs de tipo de ação (Trash, Activity, ChartNoAxesCombined, GitCompare). Campos: `channel`, `intensity` slider, `period` daterange, `advancedOptions` accordion.
- `BaselineScenarioComparison` — 3 colunas (Baseline / Cenário / Delta) com lista de métricas + setas tone.
- `AttributionRedistributionWaterfall` — `WaterfallChart` + nota descritiva.
- `ScenarioInsightsPanel` — coluna lateral fixa com hypothesis, learnings, riskBox, nextRecommendedTest, ações.
- `ScenarioComparisonTable` — `DataTable` lista de cenários.

Hook: `useScenarioSimulation` puro (sem rede inicialmente) — recebe `{ action, channel, intensity }` e devolve métricas mockadas. Documentar TODO para conectar com `api.analyzeScenario` quando o sandbox aceitar tipos de ação além de "criar caminho".

`useScenarios(runId)` → `api.listScenarios(runId)`.

---

## Phase 10 — Feature `executions-quality`

Referência: `06-execucoes-e-qualidade.md`.

Componentes:
- `ExecutionSummaryCards` — 4 cards.
- `ExecutionHistoryTable` — `DataTable` com busca/filtro/paginação. Click destaca linha e atualiza `ExecutionDetailsPanel`.
- `TrustCenterPanel` — overall confidence + grupos de `ProgressBar` + box de alertas (vermelho-soft) + checks aprovados (verde-soft).
- `ExecutionComparisonPanel` — linhas com mini-bars antes/depois + delta colorido por linha.
- `ExecutionDetailsPanel` — painel lateral persistente em desktop (não drawer, fica fixo na coluna direita). Tabs Parâmetros/Entradas/Saídas/Logs, lista de parâmetros, notas, confidenceBox, ações.

Layout: grid 12 colunas — esquerda 8 (cards + history table + trustcenter+comparison row), direita 4 (details panel).

Hook: `useModelRuns()` (lista) e `useModelRun(id)` (detalhe via `api.getOverview`). Comparação entre execuções: usa cache de duas queries.

---

## Phase 11 — Cleanup

### Task 11.1: Deletar legado
**Files:**
- Delete: `gograph/frontend/src/App.tsx`
- Delete: `gograph/frontend/src/SandboxView.tsx`

Garantir que nenhuma rota nova ainda importa esses arquivos:
```bash
grep -rE 'from "\\./App"|from "\\./SandboxView"' gograph/frontend/src
```
Deve dar zero hits.

Commit `chore(frontend): remove legacy monolithic App + SandboxView`.

### Task 11.2: Pass final do `impeccable detect`
```bash
npx impeccable detect http://127.0.0.1:5173
```
Esperar **0 anti-patterns** (low-contrast resolvido pelo `#3F4D6E`, fonte única resolvido pelo par Geist+Inter, AI palette resolvida pelo `#5B4FE5`).

Se sobrar findings, criar tasks corretivas pontuais e re-rodar.

Commit (se houver ajustes) `style(frontend): final impeccable polish`.

### Task 11.3: Auditoria de a11y
Rodar `axe` em cada feature (já incluído nos testes) + checagem manual:
- Tab order em todas as rotas.
- `Esc` fecha Drawer/Dialog.
- `aria-current="page"` na Sidebar.
- Contraste de placeholder text em inputs.

Commit (se houver) `fix(a11y): final pass`.

### Task 11.4: README do frontend
**Files:**
- Create: `gograph/frontend/README.md`

Documentar: estrutura de pastas, comandos (`npm run dev/build/test`), convenções (1 hook por endpoint, mocks ao lado da feature), tokens, como adicionar uma rota nova.

Commit `docs(frontend): contributor README`.

### Task 11.5: Atualizar `docs/PROJECT.md`
**Files:**
- Modify: `docs/PROJECT.md`

Atualizar seção `## 6. Frontend` apontando para nova estrutura e o README novo.

Commit `docs: refresh frontend description after refactor`.

---

## Critérios de aceite gerais (gate de "done")

- [ ] `npm run dev` sobe sem warnings.
- [ ] `npm run build` produz bundle sem erro de TypeScript.
- [ ] `npm test` 100% verde.
- [ ] `npx impeccable detect http://127.0.0.1:5173` reporta 0 findings em todas as 6 rotas.
- [ ] Todas as 6 telas batem visualmente com os JSONs dos arquivos `01..06`.
- [ ] Nenhum componente compartilhado importa de `features/`.
- [ ] Nenhum componente em `features/X` importa de `features/Y` (cross-feature proibido — passa por `shared/` ou eleva para `app/`).
- [ ] Nenhuma string de domínio hardcoded no JSX principal — tudo via tipos/mocks/hooks.
- [ ] Layout desktop 1440–1920px ok; tablet 768–1024px com sidebar colapsável; mobile 360–767px stack vertical + scroll horizontal nas tabelas.
- [ ] `App.tsx` e `SandboxView.tsx` legados removidos.

---

## Risco e mitigações

| Risco | Mitigação |
|---|---|
| Quebrar o frontend em produção durante a migração | Phase 4 troca `main.tsx` mas mantém legado em disco; placeholders evitam tela branca; commits pequenos e reversíveis. |
| API real não suporta todos os payloads dos JSONs | Hooks marcam `// TODO(api):` em campos sem endpoint; mocks vivem ao lado e são óbvios. |
| Sankey/Waterfall não baterem visualmente | `@nivo/sankey` e `recharts/ComposedChart` cobrem os 2 — se desviar, ajustar tema em `shared/charts/*` (ponto único de mudança). |
| Drawer e tabs do channel-360 vazarem foco | Radix Dialog/Tabs cuidam disso nativamente; teste a11y na Task 11.3 confirma. |
| Refactor de 1832 linhas do App.tsx perder feature escondida | Antes da Phase 11.1 (deletar), abrir App.tsx e listar cada `Tab`/seção, garantindo que cada uma tem equivalente nas features novas. Checklist abaixo. |

### Checklist de equivalência App.tsx → features (preencher na Phase 11.1)

| App.tsx atual | Nova feature |
|---|---|
| RunForm + status | `executions-quality` (Nova execução action) |
| Overview tab | `overview` |
| Channels tab | `budget-decisions` (tabela) + `channel-360` (drill) |
| Diagnostics tab | `budget-decisions` (matriz) + `channel-360` (role/efficiency) |
| Graph tab | `journeys` (tab Grafo) |
| Paths tab | `journeys` (tab Caminhos) |
| Loops tab | `journeys` (LoopsPatternsList) |
| Funnel tabs | `journeys` (matriz + sequential) ou ficar em `executions-quality` se for diagnóstico — decidir antes da Phase 8 |
| Data quality | `executions-quality` (TrustCenter) |
| SandboxView | `experiments` |

Marcar ✅ por linha à medida que cada feature absorve o conteúdo correspondente.
