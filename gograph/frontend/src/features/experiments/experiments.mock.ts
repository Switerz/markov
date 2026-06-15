import type { ExperimentsData } from "./types";

// Populated in Phase 9. Mocked data lives here until the API covers everything.
// Mirrors docs/gograph-refactor-instrucoes/05-experimentos.md JSON contract.
// Note: the contract JSON references a "purple" tone for one scenario row;
// since the shared token palette no longer includes purple, we substitute
// "indigo" (the closest neutral-saturated tone in the design system).
export const experimentsMock: ExperimentsData = {
  screen: {
    id: "experiments",
    title: "Experimentos",
    subtitle:
      "Simule cenários, compare impactos e valide hipóteses antes de executar.",
    route: "/experimentos",
    activeNav: "Experimentos",
  },
  topBar: {
    executionContext: {
      label: "Contexto de execução",
      value: "01 Mai — 31 Mai 2026",
      icon: "Calendar",
    },
    actions: [
      { id: "newScenario", label: "Novo cenário", icon: "Plus", variant: "primary" },
      {
        id: "saveExperiment",
        label: "Salvar experimento",
        icon: "Save",
        variant: "secondary",
      },
      { id: "more", label: "Mais opções", icon: "EllipsisVertical", variant: "icon" },
    ],
  },
  scenarioBuilder: {
    title: "Construção do cenário",
    subtitle: "Defina a ação e os parâmetros do cenário.",
    actionTypes: [
      { id: "removeChannel", label: "Remover canal", icon: "Trash2", active: true },
      { id: "reducePresence", label: "Reduzir presença", icon: "Activity" },
      {
        id: "redistributeBudget",
        label: "Redistribuir budget",
        icon: "ChartNoAxesCombined",
      },
      { id: "compareModels", label: "Comparar modelos", icon: "GitCompare" },
    ],
    fields: [
      {
        id: "channel",
        label: "Canal / Tática",
        type: "select",
        value: "Display",
        icon: "Monitor",
      },
      { id: "action", label: "Ação", type: "select", value: "Remover canal" },
      {
        id: "intensity",
        label: "Intensidade",
        type: "slider",
        value: 100,
        marks: ["0%", "50%", "100%"],
      },
      {
        id: "period",
        label: "Período de simulação",
        type: "dateRange",
        value: "01 Mai — 31 Mai 2026 (período inteiro)",
        icon: "Calendar",
      },
      { id: "advancedOptions", label: "Opções avançadas", type: "accordion" },
    ],
    primaryAction: { label: "Aplicar cenário", icon: "Play" },
  },
  baselineVsScenario: {
    title: "Baseline vs Cenário",
    legend: [
      { label: "Baseline", tone: "blue" },
      { label: "Cenário", tone: "green" },
    ],
    baseline: {
      title: "Baseline (atual)",
      period: "01 Mai — 31 Mai 2026",
      metrics: [
        { label: "Probabilidade de conversão", value: "3,48%" },
        { label: "Receita atribuída", value: "R$ 24,8M" },
        { label: "Investimento total", value: "R$ 4,12M" },
        { label: "ROAS atribuído", value: "6,02x" },
        { label: "Impacto estimado", value: "—" },
      ],
    },
    scenario: {
      title: "Cenário: Sem Display",
      period: "01 Mai — 31 Mai 2026",
      metrics: [
        {
          label: "Probabilidade de conversão",
          value: "3,10%",
          delta: "-0,38pp",
          tone: "negative",
        },
        {
          label: "Receita atribuída",
          value: "R$ 22,1M",
          delta: "-10,9%",
          tone: "negative",
        },
        {
          label: "Investimento total",
          value: "R$ 3,50M",
          delta: "-15,1%",
          tone: "negative",
        },
        {
          label: "ROAS atribuído",
          value: "6,31x",
          delta: "+0,29x",
          tone: "positive",
        },
        {
          label: "Impacto estimado",
          value: "-R$ 2,72M",
          delta: "-10,9%",
          tone: "negative",
        },
      ],
    },
    delta: {
      title: "Delta (Cenário vs Baseline)",
      metrics: [
        { label: "Probabilidade de conversão", value: "-0,38pp", tone: "negative" },
        {
          label: "Receita atribuída",
          value: "-R$ 2,72M",
          delta: "-10,9%",
          tone: "negative",
        },
        {
          label: "Investimento total",
          value: "-R$ 0,62M",
          delta: "-15,1%",
          tone: "negative",
        },
        {
          label: "ROAS atribuído",
          value: "+0,29x",
          delta: "+4,8%",
          tone: "positive",
        },
        {
          label: "Impacto estimado",
          value: "-R$ 2,72M",
          delta: "-10,9%",
          tone: "negative",
        },
      ],
    },
  },
  redistributionChart: {
    title: "Redistribuição da atribuição",
    subtitle: "Variação da receita atribuída por canal/tática (R$)",
    control: "Canal (agregado)",
    waterfall: [
      { label: "Baseline", value: 24.8, display: "24,8M", type: "start" },
      {
        label: "Display (removido)",
        value: -2.72,
        display: "-2,72M",
        type: "negative",
      },
      { label: "Meta Ads", value: 1.05, display: "+1,05M", type: "positive" },
      { label: "Google Ads", value: 0.68, display: "+0,68M", type: "positive" },
      { label: "Email", value: 0.54, display: "+0,54M", type: "positive" },
      { label: "WhatsApp CRM", value: 0.28, display: "+0,28M", type: "positive" },
      { label: "Influencers", value: 0.0, display: "", type: "bridge" },
      { label: "Cenário", value: 22.1, display: "22,1M", type: "end" },
    ],
    note: "A remoção de Display reduz a receita atribuída em R$ 2,72M (-10,9%). O impacto é parcialmente compensado por Meta Ads e Google Ads.",
  },
  scenarioInsights: {
    title: "Insights do cenário",
    hypothesis:
      "Display apresenta baixa eficiência marginal e sua remoção pode manter ROAS estável realocando valor para canais com maior propensão de conversão.",
    mainLearnings: [
      "A remoção de Display reduz a receita atribuída em 10,9%.",
      "Meta Ads e Google Ads compensam 63% da perda de receita.",
      "ROAS melhora +0,29x, indicando maior eficiência do investimento.",
    ],
    riskBox: {
      title: "Risco & Observações",
      items: [
        "Display contribui para alcance incremental e construção de demanda.",
        "A remoção pode impactar volume futuro não capturado neste período.",
      ],
    },
    nextRecommendedTest: {
      title: "Próximo teste recomendado",
      description:
        "Executar um teste incremental de geo-holdout removendo Display em 10% das regiões por 2-3 semanas para validar o impacto causal.",
      estimatedImpact: {
        revenue: "-R$ 2,7M",
        roas: "+0,29x",
        confidence: "Alta",
      },
    },
    actions: [
      {
        id: "createIncrementalTestPlan",
        label: "Criar plano de teste incremental",
        icon: "FlaskConical",
        variant: "primary",
      },
      {
        id: "saveDraft",
        label: "Salvar rascunho do cenário",
        icon: "Bookmark",
        variant: "secondary",
      },
    ],
  },
  scenarioComparisonTable: {
    title: "Comparação de cenários",
    columns: [
      "Cenário",
      "Prob. de conversão",
      "Receita atribuída",
      "Investimento total",
      "ROAS atribuído",
      "Impacto estimado",
      "Ações",
    ],
    rows: [
      {
        scenario: "Baseline (atual)",
        description: "Período inteiro",
        conversionProbability: "3,48%",
        revenue: "R$ 24,8M",
        investment: "R$ 4,12M",
        roas: "6,02x",
        impact: "—",
        tone: "blue",
      },
      {
        scenario: "Sem Display",
        description: "Remover canal",
        conversionProbability: "3,10%",
        conversionDelta: "-0,38pp",
        revenue: "R$ 22,1M",
        revenueDelta: "-10,9%",
        investment: "R$ 3,50M",
        investmentDelta: "-15,1%",
        roas: "6,31x",
        roasDelta: "+0,29x",
        impact: "-R$ 2,72M",
        impactDelta: "-10,9%",
        tone: "red",
      },
      {
        scenario: "Sem Influencers",
        description: "Remover canal",
        conversionProbability: "3,33%",
        conversionDelta: "-0,15pp",
        revenue: "R$ 23,5M",
        revenueDelta: "-5,2%",
        investment: "R$ 3,63M",
        investmentDelta: "-11,9%",
        roas: "6,47x",
        roasDelta: "+0,45x",
        impact: "-R$ 1,29M",
        impactDelta: "-5,2%",
        tone: "indigo",
      },
      {
        scenario: "Menos 10% Meta Ads",
        description: "Reduzir presença",
        conversionProbability: "3,31%",
        conversionDelta: "-0,17pp",
        revenue: "R$ 23,9M",
        revenueDelta: "-3,5%",
        investment: "R$ 3,71M",
        investmentDelta: "-10,0%",
        roas: "6,44x",
        roasDelta: "+0,42x",
        impact: "-R$ 0,90M",
        impactDelta: "-3,5%",
        tone: "orange",
      },
    ],
    action: "Ver todos os cenários (7)",
  },
};
