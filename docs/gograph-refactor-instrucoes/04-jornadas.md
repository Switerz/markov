# Tela 04 - Jornadas

## Tarefa para IA

Refatorar a tela `Jornadas` para explorar fluxos de usuarios ate conversao, com filtros, abas de visualizacao, Sankey, construtor de jornada, top caminhos, matriz de transicao e loops/padroes.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "journeys",
    "title": "Jornadas",
    "subtitle": "Explore e compreenda os caminhos que levam seus usuarios ate a conversao.",
    "route": "/jornadas",
    "activeNav": "Jornadas"
  },
  "topBar": {
    "actions": [
      { "id": "newExecution", "label": "Nova execucao", "icon": "Plus", "variant": "primary" },
      { "id": "export", "label": "Exportar", "icon": "Download", "variant": "secondary" }
    ]
  },
  "filters": [
    { "id": "audience", "type": "select", "icon": "Users", "value": "Convertidos e nao convertidos" },
    { "id": "period", "type": "dateRange", "icon": "Calendar", "value": "01 Mai — 31 Mai 2026" },
    { "id": "journeyLength", "type": "select", "label": "Comprimento da jornada", "value": "1 — 10+ toques" },
    { "id": "origin", "type": "select", "label": "Origem", "value": "Todos os canais" },
    { "id": "destination", "type": "select", "label": "Destino", "value": "Conversao" },
    { "id": "hideDirect", "type": "switch", "label": "Ocultar diretos", "value": false },
    { "id": "hideSelfLoops", "type": "switch", "label": "Ocultar self-loops", "value": false }
  ],
  "viewTabs": [
    { "id": "flow", "label": "Fluxo", "icon": "Workflow", "active": true },
    { "id": "graph", "label": "Grafo", "icon": "Network" },
    { "id": "paths", "label": "Caminhos", "icon": "Route" },
    { "id": "matrix", "label": "Matriz", "icon": "Grid3X3" }
  ],
  "flowMetric": {
    "label": "Metrica do fluxo:",
    "value": "Receita atribuida"
  },
  "journeyFlow": {
    "title": "Fluxo de jornadas",
    "subtitle": "Participacao de jornadas por toque → Receita atribuida",
    "leftNodes": [
      { "channel": "Organic Social", "value": "32,1%", "tone": "blue" },
      { "channel": "Google Ads", "value": "27,4%", "tone": "green" },
      { "channel": "Meta Ads", "value": "18,6%", "tone": "purple" },
      { "channel": "Email", "value": "8,2%", "tone": "orange" },
      { "channel": "Referral", "value": "6,1%", "tone": "red" },
      { "channel": "Outros", "value": "7,6%", "tone": "gray" }
    ],
    "middleNodes": [
      { "channel": "Google Ads", "value": "23,5%", "icon": "GoogleAds" },
      { "channel": "Direct", "value": "30,2%", "icon": "ExternalLink" },
      { "channel": "Meta Ads", "value": "15,6%", "icon": "Meta" },
      { "channel": "Email", "value": "8,6%", "icon": "Mail" },
      { "channel": "WhatsApp CRM", "value": "12,1%", "icon": "MessageCircle" },
      { "channel": "Outros", "value": "10,0%", "icon": "Ellipsis" }
    ],
    "outcomeNodes": [
      { "label": "Conversao", "value": "38,7%", "tone": "green", "icon": "CircleCheck" },
      { "label": "Nao converteu", "value": "61,3%", "tone": "red", "icon": "CircleX" }
    ],
    "footer": {
      "coverage": "100% dos caminhos estao sendo exibidos",
      "legend": "Espessura = participacao | Nos = toques | Cores = canais",
      "action": "Ver como Grafo"
    }
  },
  "journeyBuilder": {
    "title": "Construir jornada",
    "subtitle": "Monte um caminho hipotetico e simule seu desempenho esperado.",
    "path": [
      { "step": 1, "label": "Entrada" },
      { "step": 2, "label": "Meta Ads" },
      { "step": 3, "label": "WhatsApp CRM" },
      { "step": 4, "label": "Conversao", "tone": "green" }
    ],
    "actions": [
      { "id": "addTouchpoint", "label": "Adicionar touchpoint", "icon": "Plus" }
    ],
    "quickSuggestions": ["Google Ads", "Direct", "Organic Social", "Email"],
    "estimatedInterpretation": {
      "description": "Baseado em dados dos ultimos 31 dias",
      "metrics": [
        { "title": "Participacao esperada", "value": "3,24%" },
        { "title": "Frequencia media", "value": "4,2 toques" },
        { "title": "Conversao esperada", "value": "6,82%" },
        { "title": "Receita esperada", "value": "R$ 18,73", "subtitle": "por usuario" }
      ]
    },
    "primaryAction": "Simular caminho",
    "secondaryAction": "Limpar"
  },
  "topPaths": {
    "title": "Top caminhos",
    "columns": ["#", "Caminho", "Participacao", "Receita atribuida", "Conversoes", "Ticket medio", "Tempo ate conversao"],
    "rows": [
      {
        "rank": 1,
        "path": "Organic Social > Google Ads > Direct > Conversao",
        "participation": "6,21%",
        "delta": "+12,4%",
        "revenue": "R$ 1,24M",
        "conversions": "5.642",
        "ticket": "R$ 220,11",
        "timeToConversion": "2,6 dias"
      },
      {
        "rank": 2,
        "path": "Google Ads > Direct > Conversao",
        "participation": "5,08%",
        "delta": "+8,7%",
        "revenue": "R$ 1,02M",
        "conversions": "4.912",
        "ticket": "R$ 207,98",
        "timeToConversion": "1,9 dias"
      },
      {
        "rank": 3,
        "path": "Meta Ads > WhatsApp CRM > Conversao",
        "participation": "3,24%",
        "delta": "+14,6%",
        "revenue": "R$ 648K",
        "conversions": "3.102",
        "ticket": "R$ 208,77",
        "timeToConversion": "2,3 dias"
      },
      {
        "rank": 4,
        "path": "Email > Direct > Conversao",
        "participation": "2,71%",
        "delta": "-4,5%",
        "revenue": "R$ 412K",
        "conversions": "1.976",
        "ticket": "R$ 208,47",
        "timeToConversion": "2,8 dias"
      },
      {
        "rank": 5,
        "path": "Organic Social > Direct > Conversao",
        "participation": "2,45%",
        "delta": "+6,1%",
        "revenue": "R$ 372K",
        "conversions": "1.654",
        "ticket": "R$ 225,09",
        "timeToConversion": "1,7 dias"
      }
    ],
    "action": "Ver todos os caminhos"
  },
  "transitionMatrix": {
    "title": "Matriz de transicao",
    "metric": "Participacao (%)",
    "columns": ["Organic Social", "Google Ads", "Meta Ads", "Direct", "WhatsApp CRM", "Email", "Outros"],
    "rows": [
      { "from": "Organic Social", "values": [null, 23.6, 11.2, 29.8, 9.6, 7.4, 18.4] },
      { "from": "Google Ads", "values": [12.3, null, 10.1, 34.7, 12.8, 6.3, 23.8] },
      { "from": "Meta Ads", "values": [9.1, 14.6, null, 28.9, 20.5, 7.1, 19.8] },
      { "from": "Direct", "values": [7.6, 9.7, 7.3, null, 14.2, 5.6, 55.6] },
      { "from": "WhatsApp CRM", "values": [6.2, 8.3, 10.9, 22.4, null, 5.9, 46.3] },
      { "from": "Email", "values": [5.8, 6.9, 6.2, 23.1, 10.8, null, 47.2] },
      { "from": "Outros", "values": [6.7, 7.8, 6.5, 22.6, 9.4, 4.6, 42.4] }
    ],
    "action": "Ver matriz completa"
  },
  "loopsAndPatterns": {
    "title": "Loops e padroes",
    "filter": "Todos os padroes",
    "columns": ["Participacao", "Conversao"],
    "items": [
      { "pattern": "WhatsApp CRM -> WhatsApp CRM", "description": "Loop de 2 toques", "participation": "7,32%", "conversion": "12,1%", "tone": "green" },
      { "pattern": "Meta Ads -> Meta Ads", "description": "Loop de 2 toques", "participation": "5,48%", "conversion": "9,6%", "tone": "blue" },
      { "pattern": "Direct -> Direct", "description": "Loop de 2 toques", "participation": "3,91%", "conversion": "8,4%", "tone": "neutral" },
      { "pattern": "Email -> Email", "description": "Loop de 2 toques", "participation": "2,61%", "conversion": "7,2%", "tone": "orange" }
    ],
    "action": "Ver todos os loops e padroes"
  }
}
```

## Componentes sugeridos

- `JourneysPage`
- `JourneyFilters`
- `JourneyViewTabs`
- `JourneySankeyPanel`
- `JourneyBuilder`
- `TopPathsTable`
- `TransitionMatrixHeatmap`
- `LoopsPatternsList`

## Instrucoes de implementacao

- Usar abas para alternar entre `Fluxo`, `Grafo`, `Caminhos` e `Matriz`.
- Na aba `Fluxo`, renderizar um Sankey usando `@nivo/sankey` ou `@visx/sankey`.
- O construtor de jornada deve ser um formulario controlado com `react-hook-form`.
- Sugestoes rapidas adicionam touchpoints ao caminho.
- `TransitionMatrixHeatmap` deve mapear intensidade por opacidade azul.
- `LoopsPatternsList` deve usar barras horizontais para participacao/conversao.
- Em telas menores, colocar o construtor abaixo do Sankey.

## Criterios de aceite

- Filtros e switches aparecem acima das abas.
- A aba `Fluxo` esta ativa por padrao.
- Sankey mostra nos de origem, intermediarios e destino.
- Construtor permite adicionar/remover touchpoints visualmente.
- Top caminhos, matriz e loops aparecem em tres cards na parte inferior.

