# GoGraph - Instrucoes Gerais de Refatoracao Frontend

Use este arquivo como contrato compartilhado antes de aplicar qualquer arquivo de tela. As imagens fornecidas representam o estado desejado. A implementacao deve preservar o produto atual, mas reorganizar componentes para melhorar coesao, reuso e manutencao.

## Objetivo

Refatorar o frontend GoGraph para um dashboard analitico React moderno, responsivo e consistente, com componentes coesos por dominio e uma base visual compartilhada entre:

- Visao Geral
- Decisoes de Budget
- Canal 360
- Jornadas
- Experimentos
- Execucoes & Qualidade

## Bibliotecas recomendadas

Priorize bibliotecas ja presentes no projeto. Se nao existirem equivalentes, use:

- `react` + `typescript` para componentes fortemente tipados.
- `@tanstack/react-query` para carregamento, cache e sincronizacao de dados.
- `@tanstack/react-table` para tabelas com sorting, filtros, paginacao e colunas configuraveis.
- `recharts` para barras, linhas, donuts, waterfall simples e graficos combinados.
- `@nivo/sankey` ou `@visx/sankey` para fluxo de jornadas.
- `lucide-react` para icones.
- `@radix-ui/react-*` ou `shadcn/ui` para dropdown, tabs, dialog, sheet, tooltip, popover e switch.
- `react-hook-form` + `zod` para formularios de cenario, simulacao e parametros.
- `clsx` + `tailwind-merge` se o projeto usar Tailwind.
- `date-fns` para periodos e formatacao de datas.

## Principios de coesao

- Componentes de layout ficam em `shared/layout`.
- Primitivos visuais ficam em `shared/ui`: `Card`, `Button`, `MetricCard`, `Badge`, `DataTable`, `Tabs`, `Select`, `DateRangePicker`, `Drawer`, `StatDelta`, `ProgressBar`, `IconTile`.
- Componentes de grafico reutilizaveis ficam em `shared/charts`: `BubbleMatrix`, `DonutRoleChart`, `WaterfallChart`, `BarLineTrendChart`, `SankeyJourneyChart`, `TransitionHeatmap`.
- Cada tela fica em uma feature: `features/overview`, `features/budget-decisions`, `features/channel-360`, `features/journeys`, `features/experiments`, `features/executions-quality`.
- Cada feature deve expor apenas uma pagina principal e componentes internos da propria feature.
- Evite componentes gigantes. Uma secao visual da tela deve virar um componente de secao.
- Evite duplicar cards de metrica: parametrizar por `title`, `value`, `delta`, `tone`, `icon`, `description`.
- Evite strings soltas espalhadas: usar objetos de dados tipados e mocks locais enquanto integra API.

## Layout global desejado

```json
{
  "appShell": {
    "brand": "GoGraph",
    "sidebarWidth": 264,
    "background": "#FFFFFF",
    "contentBackground": "#FFFFFF",
    "navigation": [
      "Visao Geral",
      "Decisoes de Budget",
      "Jornadas",
      "Experimentos",
      "Execucoes & Qualidade"
    ],
    "bottomNavigation": ["Configuracoes"],
    "user": {
      "initials": "AM",
      "name": "Ana Martins",
      "role": "Analista de Growth"
    }
  },
  "visualTokens": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "textPrimary": "#07133F",
    "textSecondary": "#53617C",
    "border": "#DDE4F2",
    "surface": "#FFFFFF",
    "surfaceSoft": "#F7F9FE",
    "blue": "#245BFF",
    "green": "#16A34A",
    "red": "#EF4444",
    "orange": "#F59E0B",
    "purple": "#8B5CF6",
    "cyan": "#20C7B5",
    "radius": {
      "card": 8,
      "control": 8,
      "pill": 999
    },
    "shadow": "0 10px 30px rgba(15, 23, 42, 0.06)"
  },
  "responsive": {
    "desktop": "sidebar fixa + conteudo em grid",
    "tablet": "sidebar compacta ou colapsavel + grids em 2 colunas",
    "mobile": "navegacao superior/overlay + cards empilhados + tabelas com scroll horizontal"
  }
}
```

## Estrutura sugerida de componentes

```txt
src/
  app/
    AppShell.tsx
    routes.tsx
  shared/
    ui/
      Button.tsx
      Card.tsx
      MetricCard.tsx
      DataTable.tsx
      Badge.tsx
      Drawer.tsx
      Tabs.tsx
      DateRangePicker.tsx
      Select.tsx
      Tooltip.tsx
      ProgressBar.tsx
    charts/
      BubbleMatrix.tsx
      DonutRoleChart.tsx
      WaterfallChart.tsx
      BarLineTrendChart.tsx
      SankeyJourneyChart.tsx
      TransitionHeatmap.tsx
    format/
      currency.ts
      percent.ts
      number.ts
  features/
    overview/
      OverviewPage.tsx
      components/
    budget-decisions/
      BudgetDecisionsPage.tsx
      components/
    channel-360/
      Channel360Page.tsx
      components/
    journeys/
      JourneysPage.tsx
      components/
    experiments/
      ExperimentsPage.tsx
      components/
    executions-quality/
      ExecutionsQualityPage.tsx
      components/
```

## Padrao de dados por tela

Cada tela deve receber dados por props ou hooks de feature, nunca buscar dados diretamente dentro de componentes visuais compartilhados.

```ts
type DeltaTone = "positive" | "negative" | "neutral" | "warning";

type Metric = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  delta?: {
    value: string;
    label: string;
    tone: DeltaTone;
  };
  icon: string;
  tone: "blue" | "green" | "red" | "orange" | "purple" | "cyan" | "neutral";
};
```

## Regras visuais

- Sidebar branca, divisoria vertical suave e item ativo com fundo azul muito claro.
- Cards brancos com borda `#DDE4F2`, raio de 8px e sombra minima.
- Botoes primarios azuis com icone `Plus` quando criam execucao/cenario.
- Botoes secundarios brancos com borda e icone.
- Usar estados semaforicos consistentes:
  - positivo: verde
  - negativo/risco: vermelho
  - alerta/defender: laranja
  - investigar: azul
  - dados neutros: cinza/azul escuro
- Tabelas com cabecalho discreto, linhas de 48-56px, divisorias horizontais e menus de acoes por linha.
- Graficos devem ter legendas compactas e labels principais visiveis.

## Acessibilidade e qualidade

- Todos os botoes de icone precisam de `aria-label`.
- Tooltips devem explicar icones de informacao.
- Contraste minimo WCAG AA para textos.
- Tabelas devem ter cabecalhos semanticos.
- Drawer lateral deve prender foco quando aberto e fechar com `Esc`.
- Graficos devem ter descricao textual curta em `aria-label` ou tabela alternativa.
- Textos longos devem quebrar linha sem estourar cards.

## Criterios gerais de aceite

- O app renderiza sem erro de console.
- Cada tela bate com a composicao visual das imagens: sidebar, filtros, cards, grids, tabelas, paineis laterais e hierarquia.
- Componentes comuns sao reutilizados entre telas.
- Nenhuma tela depende de valores hardcoded dentro do JSX principal; dados ficam em objetos tipados, mocks ou API adapters.
- Layout desktop suporta largura de 1440px a 1920px.
- Layout mobile empilha secoes, preserva leitura e permite scroll horizontal em tabelas/graficos largos.

