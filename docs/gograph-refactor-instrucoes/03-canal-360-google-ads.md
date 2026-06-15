# Tela 03 - Canal 360 - Google Ads

## Tarefa para IA

Criar/refatorar a tela `Canal 360` para o canal `Google Ads`, exibindo performance atribuida, papel na jornada, sequencias relevantes, recomendacoes e detalhes rapidos do canal.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "channel-360-google-ads",
    "title": "Google Ads",
    "route": "/decisoes-de-budget/canais/google-ads",
    "activeNav": "Decisoes de Budget",
    "breadcrumb": ["GoGraph", "Decisoes de Budget", "Canal 360"],
    "channel": {
      "name": "Google Ads",
      "logo": "GoogleAds",
      "recommendation": "Scale Up — Strong Consensus",
      "recommendationTone": "green"
    }
  },
  "topBar": {
    "filters": [
      { "id": "period", "type": "dateRange", "icon": "Calendar", "value": "01 Mai — 31 Mai 2026" },
      { "id": "compareWith", "type": "dateRange", "label": "Comparar com:", "value": "01 Abr — 30 Abr 2026" }
    ],
    "actions": [
      { "id": "newExecution", "label": "Nova execucao", "icon": "Plus", "variant": "primary" },
      { "id": "export", "label": "Exportar", "icon": "Download", "variant": "secondary" }
    ]
  },
  "metricStrip": [
    {
      "id": "investment",
      "title": "Investimento",
      "value": "R$ 2,48M",
      "icon": "ChartNoAxesCombined",
      "tone": "blue",
      "delta": { "value": "+18,6%", "label": "vs 01 Abr — 30 Abr 2026", "tone": "positive" }
    },
    {
      "id": "attributedRevenue",
      "title": "Receita atribuida",
      "value": "R$ 4,12M",
      "icon": "DollarSign",
      "tone": "purple",
      "delta": { "value": "+8,4%", "label": "vs periodo anterior", "tone": "positive" }
    },
    {
      "id": "roasConsensus",
      "title": "ROAS (consenso)",
      "value": "6,02x",
      "icon": "ShieldCheck",
      "tone": "cyan",
      "delta": { "value": "+9,4%", "label": "vs periodo anterior", "tone": "positive" }
    },
    {
      "id": "journeyPresence",
      "title": "Presenca em jornadas convertidas",
      "value": "34%",
      "icon": "CircleGauge",
      "tone": "blue",
      "delta": { "value": "-3pp", "label": "vs periodo anterior", "tone": "negative" }
    },
    {
      "id": "dominantRole",
      "title": "Papel predominante",
      "value": "Inicio & Meio de jornada",
      "icon": "Route",
      "tone": "blue"
    }
  ],
  "attributionEfficiency": {
    "title": "Atribuicao & eficiencia",
    "subtitle": "Comparacao de participacao no investimento, receita atribuida e eficiencia relativa.",
    "rows": [
      {
        "model": "Markov",
        "investmentShare": "34%",
        "investmentBar": 34,
        "attributedRevenue": "R$ 4,63M",
        "revenueShare": "35%",
        "relativeEfficiency": "1,15x",
        "efficiencyTone": "green"
      },
      {
        "model": "Shapley",
        "investmentShare": "41%",
        "investmentBar": 41,
        "attributedRevenue": "R$ 4,01M",
        "revenueShare": "30%",
        "relativeEfficiency": "0,98x",
        "efficiencyTone": "neutral"
      },
      {
        "model": "Receita observada (ultimo clique)",
        "investmentShare": "28%",
        "investmentBar": 28,
        "attributedRevenue": "R$ 2,11M",
        "revenueShare": "16%",
        "relativeEfficiency": "0,60x",
        "efficiencyTone": "red"
      }
    ],
    "formula": "Eficiencia relativa = ROAS do canal / ROAS medio (Shapley)"
  },
  "journeyRole": {
    "title": "Papel na jornada",
    "subtitle": "Distribuicao do papel de Google Ads nas jornadas convertidas (Markov).",
    "donut": [
      { "label": "First touch", "description": "Inicio de jornada", "value": 42, "tone": "blue" },
      { "label": "Middle touch", "description": "Meio de jornada", "value": 35, "tone": "purple" },
      { "label": "Last touch", "description": "Fim de jornada", "value": 23, "tone": "green" }
    ]
  },
  "recommendationEvidence": {
    "title": "Evidencias da recomendacao",
    "badge": "Scale Up — Strong Consensus",
    "whyIncreaseInvestment": [
      "ROAS (consenso) 6,02x, acima da media dos canais (4,87x).",
      "Alta presenca em jornadas convertidas (34%).",
      "Papel forte no inicio e meio de jornada (77%).",
      "Eficiencia Markov 15% acima da media.",
      "Uplift positivo em sequencias relevantes."
    ],
    "risks": [
      "Dependencia de orcamento pode pressionar CPCs.",
      "Saturacao em segmentos de marca.",
      "Atribuicao sujeita a dados de navegacao."
    ],
    "bestPractices": [
      "Escalar com controle de CPC e share de impressoes.",
      "Priorizar campanhas de prospeccao e remarketing.",
      "Testar criativos e mensagens por etapa da jornada.",
      "Monitorar canibalizacao com Search (brand)."
    ],
    "confidenceBox": {
      "title": "Recomendacao baseada em consenso forte entre Markov e Shapley.",
      "link": "Ver detalhes tecnicos"
    }
  },
  "tables": {
    "channelsBefore": {
      "title": "Canais que levam ate Google Ads",
      "subtitle": "Top canais que antecedem Google Ads nas jornadas.",
      "rows": [
        { "rank": 1, "channel": "Instagram", "participation": "28%", "journeys": "12.340" },
        { "rank": 2, "channel": "Organic Search", "participation": "22%", "journeys": "9.812" },
        { "rank": 3, "channel": "Facebook Ads", "participation": "14%", "journeys": "6.145" },
        { "rank": 4, "channel": "YouTube", "participation": "9%", "journeys": "3.982" },
        { "rank": 5, "channel": "Display", "participation": "7%", "journeys": "2.918" }
      ]
    },
    "channelsAfter": {
      "title": "Canais mais acessados depois de Google Ads",
      "subtitle": "Top canais que aparecem apos Google Ads nas jornadas.",
      "rows": [
        { "rank": 1, "channel": "Organic Search", "participation": "38%", "journeys": "16.492" },
        { "rank": 2, "channel": "Direct", "participation": "21%", "journeys": "9.210" },
        { "rank": 3, "channel": "Email", "participation": "12%", "journeys": "5.231" },
        { "rank": 4, "channel": "Instagram", "participation": "9%", "journeys": "3.812" },
        { "rank": 5, "channel": "Display", "participation": "6%", "journeys": "2.641" }
      ]
    }
  },
  "relevantSequences": {
    "title": "Sequencias relevantes",
    "subtitle": "Sequencias que incluem Google Ads e geram uplift.",
    "items": [
      {
        "path": ["Instagram", "Google Ads"],
        "uplift": "+38%",
        "frequencyMedian": "2,1",
        "baseline": "2,84%",
        "sequenceConversion": "3,92%",
        "action": "Ver detalhes"
      },
      {
        "path": ["Organic Search", "Google Ads"],
        "uplift": "+24%",
        "frequencyMedian": "2,4",
        "baseline": "2,84%",
        "sequenceConversion": "3,53%",
        "action": "Ver detalhes"
      }
    ],
    "note": "Uplift estimado via jornadas sem a sequencia. Nao implica causalidade."
  },
  "timeEvolution": {
    "title": "Evolucao temporal (consenso)",
    "subtitle": "Receita atribuida (R$) por modelo e ROAS (consenso) ao longo do tempo.",
    "controls": [
      { "id": "display", "label": "Exibir:", "value": "Receita atribuida (R$)" },
      { "id": "granularity", "value": "Mensal" }
    ],
    "series": [
      { "month": "Dez 2025", "markov": 3.6, "shapley": 3.2, "lastClick": 2.0, "roas": "4,3x" },
      { "month": "Jan 2026", "markov": 4.0, "shapley": 3.9, "lastClick": 2.6, "roas": "4,7x" },
      { "month": "Fev 2026", "markov": 4.5, "shapley": 4.2, "lastClick": 2.8, "roas": "5,1x" },
      { "month": "Mar 2026", "markov": 4.8, "shapley": 4.5, "lastClick": 3.3, "roas": "5,6x" },
      { "month": "Abr 2026", "markov": 4.7, "shapley": 4.3, "lastClick": 3.4, "roas": "5,5x" },
      { "month": "Mai 2026", "markov": 5.1, "shapley": 4.7, "lastClick": 3.6, "roas": "6,0x" }
    ]
  },
  "quickDetails": {
    "title": "Detalhes rapidos do canal",
    "items": [
      { "label": "Tipo", "value": "Pago" },
      { "label": "Objetivo principal", "value": "Aquisicao & Consideracao" },
      { "label": "Modelagem", "value": "Markov + Shapley" },
      { "label": "Janela de atribuicao", "value": "30 dias clique / 7 dias visualizacao" },
      { "label": "Cobertura de dados", "value": "96%" },
      { "label": "Ultima atualizacao", "value": "31 Mai 2026 08:45" }
    ]
  }
}
```

## Componentes sugeridos

- `Channel360Page`
- `ChannelHeader`
- `ChannelMetricStrip`
- `AttributionEfficiencyTable`
- `JourneyRoleDonut`
- `RecommendationEvidencePanel`
- `AdjacentChannelsTables`
- `RelevantSequencesList`
- `ChannelTrendChart`
- `ChannelQuickDetails`

## Instrucoes de implementacao

- A tela deve usar grid principal de 12 colunas: conteudo analitico em 9 colunas e painel direito em 3 colunas.
- `ChannelMetricStrip` pode usar cards mais horizontais que `MetricCard`, mas deve compartilhar `StatDelta`.
- `JourneyRoleDonut` deve usar `recharts/PieChart`.
- `ChannelTrendChart` deve combinar barras por modelo e linha pontilhada de ROAS.
- `RelevantSequencesList` deve renderizar caminho com icones dos canais e seta entre eles.
- `RecommendationEvidencePanel` fica fixo na coluna direita no desktop, abaixo dos cards de evidencia.
- O JSON do canal deve permitir reaproveitar a mesma tela para outros canais.

## Criterios de aceite

- Breadcrumb, logo Google Ads, badge verde e filtros aparecem no topo.
- Cards de metricas ocupam uma faixa unica.
- Tabelas de canais antes/depois e sequencias ficam no meio da pagina.
- Coluna direita contem evidencias, riscos, boas praticas e detalhes rapidos.
- A tela pode ser populada trocando apenas o objeto `channelData`.

