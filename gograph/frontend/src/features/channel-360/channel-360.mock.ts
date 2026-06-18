import type { Channel360Data } from "./types";

// Channel 360 - Google Ads instance.
// Source: docs/gograph-refactor-instrucoes/03-canal-360-google-ads.md
// Note: the JSON spec uses tone "purple" for the Middle touch slice in
// journeyRole.donut. The shared tone system has no purple; we translate
// to "indigo" per the Phase 7 contract.
export const channel360Mock: Channel360Data = {
  screen: {
    id: "channel-360-google-ads",
    title: "Google Ads",
    route: "/performance/canais/google-ads",
    activeNav: "Performance",
    breadcrumb: ["GoGraph", "Performance", "Canal 360"],
    channel: {
      name: "Google Ads",
      logo: "GoogleAds",
      recommendation: "Scale Up — Strong Consensus",
      recommendationTone: "green",
    },
  },
  topBar: {
    filters: [
      {
        id: "period",
        type: "dateRange",
        icon: "Calendar",
        value: "01 Mai — 31 Mai 2026",
      },
      {
        id: "compareWith",
        type: "dateRange",
        label: "Comparar com:",
        value: "01 Abr — 30 Abr 2026",
      },
    ],
    actions: [
      { id: "newExecution", label: "Nova execução", icon: "Plus", variant: "primary" },
      { id: "export", label: "Exportar", icon: "Download", variant: "secondary" },
    ],
  },
  metricStrip: [
    {
      id: "investment",
      title: "Investimento",
      value: "R$ 2,48M",
      icon: "ChartNoAxesCombined",
      tone: "blue",
      delta: {
        value: "+18,6%",
        label: "vs 01 Abr — 30 Abr 2026",
        tone: "positive",
      },
    },
    {
      id: "attributedRevenue",
      title: "Receita atribuída",
      value: "R$ 4,12M",
      icon: "DollarSign",
      tone: "indigo",
      delta: {
        value: "+8,4%",
        label: "vs período anterior",
        tone: "positive",
      },
    },
    {
      id: "roasConsensus",
      title: "ROAS (consenso)",
      value: "6,02x",
      icon: "ShieldCheck",
      tone: "cyan",
      delta: {
        value: "+9,4%",
        label: "vs período anterior",
        tone: "positive",
      },
    },
    {
      id: "journeyPresence",
      title: "Presença em jornadas convertidas",
      value: "34%",
      icon: "CircleGauge",
      tone: "blue",
      delta: {
        value: "-3pp",
        label: "vs período anterior",
        tone: "negative",
      },
    },
    {
      id: "dominantRole",
      title: "Papel predominante",
      value: "Início & Meio de jornada",
      icon: "Route",
      tone: "blue",
    },
  ],
  attributionEfficiency: {
    title: "Atribuição & eficiência",
    subtitle:
      "Comparação de participação no investimento, receita atribuída e eficiência relativa.",
    rows: [
      {
        model: "Markov",
        investmentShare: "34%",
        investmentBar: 34,
        attributedRevenue: "R$ 4,63M",
        revenueShare: "35%",
        relativeEfficiency: "1,15x",
        efficiencyTone: "green",
      },
      {
        model: "Shapley",
        investmentShare: "41%",
        investmentBar: 41,
        attributedRevenue: "R$ 4,01M",
        revenueShare: "30%",
        relativeEfficiency: "0,98x",
        efficiencyTone: "neutral",
      },
      {
        model: "Receita observada (último clique)",
        investmentShare: "28%",
        investmentBar: 28,
        attributedRevenue: "R$ 2,11M",
        revenueShare: "16%",
        relativeEfficiency: "0,60x",
        efficiencyTone: "red",
      },
    ],
    formula: "Eficiência relativa = ROAS do canal / ROAS médio (Shapley)",
  },
  journeyRole: {
    title: "Papel na jornada",
    subtitle:
      "Distribuição do papel de Google Ads nas jornadas convertidas (Markov).",
    donut: [
      { label: "First touch", description: "Início de jornada", value: 42, tone: "blue" },
      // JSON declares "purple"; translated to "indigo" — the local token
      // system has no purple slot.
      { label: "Middle touch", description: "Meio de jornada", value: 35, tone: "indigo" },
      { label: "Last touch", description: "Fim de jornada", value: 23, tone: "green" },
    ],
  },
  recommendationEvidence: {
    title: "Evidências da recomendação",
    badge: "Scale Up — Strong Consensus",
    whyIncreaseInvestment: [
      "ROAS (consenso) 6,02x, acima da média dos canais (4,87x).",
      "Alta presença em jornadas convertidas (34%).",
      "Papel forte no início e meio de jornada (77%).",
      "Eficiência Markov 15% acima da média.",
      "Uplift positivo em sequências relevantes.",
    ],
    risks: [
      "Dependência de orçamento pode pressionar CPCs.",
      "Saturação em segmentos de marca.",
      "Atribuição sujeita a dados de navegação.",
    ],
    bestPractices: [
      "Escalar com controle de CPC e share de impressões.",
      "Priorizar campanhas de prospecção e remarketing.",
      "Testar criativos e mensagens por etapa da jornada.",
      "Monitorar canibalização com Search (brand).",
    ],
    confidenceBox: {
      title: "Recomendação baseada em consenso forte entre Markov e Shapley.",
      link: "Ver detalhes técnicos",
    },
  },
  tables: {
    channelsBefore: {
      title: "Canais que levam até Google Ads",
      subtitle: "Top canais que antecedem Google Ads nas jornadas.",
      rows: [
        { rank: 1, channel: "Instagram", participation: "28%", journeys: "12.340" },
        { rank: 2, channel: "Organic Search", participation: "22%", journeys: "9.812" },
        { rank: 3, channel: "Facebook Ads", participation: "14%", journeys: "6.145" },
        { rank: 4, channel: "YouTube", participation: "9%", journeys: "3.982" },
        { rank: 5, channel: "Display", participation: "7%", journeys: "2.918" },
      ],
    },
    channelsAfter: {
      title: "Canais mais acessados depois de Google Ads",
      subtitle: "Top canais que aparecem após Google Ads nas jornadas.",
      rows: [
        { rank: 1, channel: "Organic Search", participation: "38%", journeys: "16.492" },
        { rank: 2, channel: "Direct", participation: "21%", journeys: "9.210" },
        { rank: 3, channel: "Email", participation: "12%", journeys: "5.231" },
        { rank: 4, channel: "Instagram", participation: "9%", journeys: "3.812" },
        { rank: 5, channel: "Display", participation: "6%", journeys: "2.641" },
      ],
    },
  },
  relevantSequences: {
    title: "Sequências relevantes",
    subtitle: "Sequências que incluem Google Ads e geram uplift.",
    items: [
      {
        path: ["Instagram", "Google Ads"],
        uplift: "+38%",
        frequencyMedian: "2,1",
        baseline: "2,84%",
        sequenceConversion: "3,92%",
        action: "Ver detalhes",
      },
      {
        path: ["Organic Search", "Google Ads"],
        uplift: "+24%",
        frequencyMedian: "2,4",
        baseline: "2,84%",
        sequenceConversion: "3,53%",
        action: "Ver detalhes",
      },
    ],
    note: "Uplift estimado via jornadas sem a sequência. Não implica causalidade.",
  },
  timeEvolution: {
    title: "Evolução temporal (consenso)",
    subtitle:
      "Receita atribuída (R$) por modelo e ROAS (consenso) ao longo do tempo.",
    controls: [
      { id: "display", label: "Exibir:", value: "Receita atribuída (R$)" },
      { id: "granularity", value: "Mensal" },
    ],
    series: [
      { month: "Dez 2025", markov: 3.6, shapley: 3.2, lastClick: 2.0, roas: "4,3x" },
      { month: "Jan 2026", markov: 4.0, shapley: 3.9, lastClick: 2.6, roas: "4,7x" },
      { month: "Fev 2026", markov: 4.5, shapley: 4.2, lastClick: 2.8, roas: "5,1x" },
      { month: "Mar 2026", markov: 4.8, shapley: 4.5, lastClick: 3.3, roas: "5,6x" },
      { month: "Abr 2026", markov: 4.7, shapley: 4.3, lastClick: 3.4, roas: "5,5x" },
      { month: "Mai 2026", markov: 5.1, shapley: 4.7, lastClick: 3.6, roas: "6,0x" },
    ],
  },
  quickDetails: {
    title: "Detalhes rápidos do canal",
    items: [
      { label: "Tipo", value: "Pago" },
      { label: "Objetivo principal", value: "Aquisição & Consideração" },
      { label: "Modelagem", value: "Markov + Shapley" },
      { label: "Janela de atribuição", value: "30 dias clique / 7 dias visualização" },
      { label: "Cobertura de dados", value: "96%" },
      { label: "Última atualização", value: "31 Mai 2026 08:45" },
    ],
  },
};
