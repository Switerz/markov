# Tela 01 - Visao Geral

## Tarefa para IA

Refatorar a tela `Visao Geral` para reproduzir o dashboard executivo da imagem de referencia. A tela deve resumir performance, recomendacoes prioritarias, consenso dos modelos, resumo da jornada e confianca da analise.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "overview",
    "title": "Visao Geral",
    "subtitle": null,
    "route": "/visao-geral",
    "activeNav": "Visao Geral"
  },
  "topBar": {
    "filters": [
      {
        "id": "account",
        "type": "select",
        "icon": "Building2",
        "value": "GoCase"
      },
      {
        "id": "period",
        "type": "dateRange",
        "icon": "Calendar",
        "value": "01 Mai — 31 Mai 2026"
      },
      {
        "id": "compareWith",
        "type": "dateRange",
        "label": "Comparar com:",
        "value": "01 Abr — 30 Abr 2026"
      },
      {
        "id": "execution",
        "type": "select",
        "icon": "Play",
        "value": "Execucao: v2026.05.31.01"
      },
      {
        "id": "confidence",
        "type": "status",
        "icon": "Circle",
        "label": "Confianca:",
        "value": "Alta",
        "tone": "green"
      }
    ],
    "actions": [
      {
        "id": "newExecution",
        "label": "Nova execucao",
        "icon": "Plus",
        "variant": "primary"
      },
      {
        "id": "export",
        "label": "Exportar",
        "icon": "Download",
        "variant": "secondary"
      }
    ]
  },
  "metrics": [
    {
      "id": "revenue",
      "title": "Receita analisada",
      "value": "R$ 24,8M",
      "icon": "TrendingUp",
      "tone": "blue",
      "delta": {
        "value": "+18,6%",
        "label": "vs 01 Abr — 30 Abr 2026",
        "tone": "positive"
      }
    },
    {
      "id": "investment",
      "title": "Investimento em midia",
      "value": "R$ 4,12M",
      "icon": "DollarSign",
      "tone": "purple",
      "delta": {
        "value": "+8,4%",
        "label": "vs periodo anterior",
        "tone": "positive"
      }
    },
    {
      "id": "roas",
      "title": "ROAS atribuido",
      "value": "6,02x",
      "icon": "ShieldCheck",
      "tone": "cyan",
      "delta": {
        "value": "+9,4%",
        "label": "vs periodo anterior",
        "tone": "positive"
      }
    },
    {
      "id": "conversionRate",
      "title": "Taxa de conversao",
      "value": "3,48% vs 3,09%",
      "subtitle": "Observada / Modelada",
      "icon": "Filter",
      "tone": "blue",
      "delta": {
        "value": "+0,39 p.p.",
        "label": "diferenca (obs - mod)",
        "tone": "positive"
      }
    },
    {
      "id": "scaleOpportunities",
      "title": "Oportunidades de escala",
      "value": "R$ 2,31M",
      "subtitle": "5 canais com potencial",
      "icon": "ChartNoAxesCombined",
      "tone": "green"
    },
    {
      "id": "misallocatedBudget",
      "title": "Budget mal alocado",
      "value": "R$ 612k",
      "subtitle": "14,8% do investimento",
      "icon": "TriangleAlert",
      "tone": "orange"
    }
  ],
  "priorityDecisions": {
    "title": "Decisoes prioritarias",
    "subtitle": "Recomendacoes baseadas no consenso dos modelos e nas oportunidades identificadas.",
    "sort": "Impacto",
    "cards": [
      {
        "channel": "Google Ads",
        "icon": "Google",
        "recommendation": "Escalar",
        "tone": "green",
        "shareSpend": "34%",
        "shareRevenue": "41%",
        "roas": "7,45x",
        "description": "Alta eficiencia e forte contribuicao em conversoes de fundo de funil.",
        "actions": ["Criar cenario", "Ver canal"]
      },
      {
        "channel": "Meta Ads",
        "icon": "Meta",
        "recommendation": "Escalar",
        "tone": "green",
        "shareSpend": "28%",
        "shareRevenue": "27%",
        "roas": "5,10x",
        "description": "Escalar com controle de frequencia e expansao de publicos vencedores.",
        "actions": ["Criar cenario", "Ver canal"]
      },
      {
        "channel": "WhatsApp CRM",
        "icon": "MessageCircle",
        "recommendation": "Defender",
        "tone": "orange",
        "shareSpend": "9%",
        "shareRevenue": "12%",
        "roas": "8,32x",
        "description": "Excelente eficiencia no fechamento. Manter investimento e automatizacoes.",
        "actions": ["Criar cenario", "Ver canal"]
      },
      {
        "channel": "Email",
        "icon": "Mail",
        "recommendation": "Investigar",
        "tone": "blue",
        "shareSpend": "6%",
        "shareRevenue": "4%",
        "roas": "2,11x",
        "description": "Abaixo do esperado. Testar segmentacoes e conteudo para reativacao.",
        "actions": ["Criar cenario", "Ver canal"]
      },
      {
        "channel": "Display",
        "icon": "Monitor",
        "recommendation": "Reduzir",
        "tone": "red",
        "shareSpend": "7%",
        "shareRevenue": "3%",
        "roas": "1,02x",
        "description": "Baixa eficiencia incremental. Reduzir investimento gradualmente.",
        "actions": ["Criar cenario", "Ver canal"]
      }
    ]
  },
  "modelConsensus": {
    "title": "Consenso dos modelos",
    "subtitle": "Cada ponto representa um canal. Tamanho = investimento em midia.",
    "viewBy": "Canais",
    "axes": {
      "x": "Markov",
      "y": "Shapley"
    },
    "quadrants": [
      {
        "label": "Investigar",
        "position": "top-left",
        "description": "Shapley alto, Markov baixo"
      },
      {
        "label": "Escalar",
        "position": "top-right",
        "description": "Alto consenso positivo"
      },
      {
        "label": "Reduzir",
        "position": "bottom-left",
        "description": "Baixo consenso negativo"
      },
      {
        "label": "Defender",
        "position": "bottom-right",
        "description": "Markov alto, Shapley baixo"
      }
    ],
    "points": [
      { "channel": "Google Ads", "x": 52, "y": 78, "size": "1M+", "tone": "blue" },
      { "channel": "Meta Ads", "x": 75, "y": 55, "size": "500K", "tone": "purple" },
      { "channel": "WhatsApp CRM", "x": 65, "y": 14, "size": "250K", "tone": "green" },
      { "channel": "Search (Marca)", "x": 58, "y": -42, "size": "250K", "tone": "orange" },
      { "channel": "Email", "x": -35, "y": 49, "size": "100K", "tone": "orange" },
      { "channel": "Display", "x": -55, "y": -30, "size": "100K", "tone": "red" },
      { "channel": "Video (YouTube)", "x": -50, "y": -55, "size": "100K", "tone": "red" }
    ],
    "legend": ["100K", "250K", "500K", "1M+"]
  },
  "journeySummary": {
    "title": "Resumo da jornada",
    "columns": [
      {
        "title": "Top canais de entrada",
        "items": [
          { "name": "Google Ads", "value": "38%" },
          { "name": "Meta Ads", "value": "24%" },
          { "name": "Organico", "value": "15%" },
          { "name": "Direct", "value": "9%" },
          { "name": "Outros", "value": "14%" }
        ]
      },
      {
        "title": "Top assistentes",
        "items": [
          { "name": "WhatsApp CRM", "value": "23%" },
          { "name": "Email", "value": "18%" },
          { "name": "Display", "value": "12%" },
          { "name": "Instagram", "value": "9%" },
          { "name": "Outros", "value": "38%" }
        ]
      },
      {
        "title": "Top canais de fechamento",
        "items": [
          { "name": "WhatsApp CRM", "value": "42%" },
          { "name": "Direct", "value": "24%" },
          { "name": "Email", "value": "16%" },
          { "name": "Organico", "value": "10%" },
          { "name": "Outros", "value": "8%" }
        ]
      }
    ],
    "flow": [
      { "stage": "Entrada", "value": "100%" },
      { "stage": "Assistidos", "value": "88%" },
      { "stage": "Engajados", "value": "69%" },
      { "stage": "Leads", "value": "34%" },
      { "stage": "Conversoes", "value": "100%", "amount": "24,8M" }
    ],
    "averageTimeToConversion": "6,2 dias"
  },
  "analysisConfidence": {
    "title": "Confianca da analise",
    "modelCalibration": [
      { "label": "Markov (Ordem 10)", "value": "92%" },
      { "label": "Shapley (Amostra 50k)", "value": "89%" },
      { "label": "Regressao (Baseline)", "value": "84%" }
    ],
    "dataQuality": [
      { "label": "Cobertura de eventos", "value": "98%" },
      { "label": "Match de usuarios", "value": "93%" },
      { "label": "Atraso medio", "value": "1,2h" }
    ],
    "summary": {
      "label": "Confianca geral: Alta",
      "description": "Modelos alinhados e dados de alta qualidade. Recomendacoes com alto grau de confianca."
    }
  },
  "footerNote": "Os valores de receita sao liquidos de impostos e cancelamentos. Atribuicao nao considera efeitos de estoque."
}
```

## Componentes sugeridos

- `OverviewPage`
- `OverviewHeaderFilters`
- `MetricCardGrid`
- `PriorityDecisionCarousel`
- `DecisionCard`
- `ModelConsensusMatrix`
- `JourneySummaryPanel`
- `JourneyFlowStepper`
- `AnalysisConfidencePanel`

## Instrucoes de implementacao

- Usar `AppShell` compartilhado com sidebar fixa.
- Renderizar filtros no topo em linha, antes dos cards de metrica.
- Implementar os seis cards de metrica com `MetricCard`, usando icones `lucide-react`.
- A secao de decisoes prioritarias deve ser uma faixa horizontal com cards compactos e opcional carousel/scroll horizontal.
- Implementar a matriz de consenso com componente reutilizavel `BubbleMatrix`, onde `x`, `y`, `size` e `tone` vem de dados.
- O resumo da jornada deve combinar listas ranqueadas e um fluxo visual com setas.
- O painel de confianca deve usar barras horizontais e um bloco verde de resumo.
- Extrair todos os dados para `overview.mock.ts` ou hook `useOverviewData`.

## Criterios de aceite

- A primeira dobra da tela mostra titulo, filtros, acoes e seis metricas.
- Os cards de decisoes priorizadas aparecem na mesma ordem da imagem.
- A matriz tem eixos Markov/Shapley, quadrantes e bolhas nomeadas.
- O resumo da jornada aparece ao lado da matriz em desktop.
- A tela nao possui dados hardcoded dentro do JSX principal.

