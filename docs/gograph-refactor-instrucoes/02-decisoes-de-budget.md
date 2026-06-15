# Tela 02 - Decisoes de Budget

## Tarefa para IA

Refatorar a tela `Decisoes de Budget` para priorizar alocacao de investimento por canal, com matriz visual, tabela detalhada e drawer lateral do canal selecionado.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "budget-decisions",
    "title": "Decisoes de Budget",
    "route": "/decisoes-de-budget",
    "activeNav": "Decisoes de Budget"
  },
  "topBar": {
    "filters": [
      { "id": "account", "type": "select", "icon": "Building2", "value": "GoCase" },
      { "id": "period", "type": "dateRange", "icon": "Calendar", "value": "01 Mai — 31 Mai 2026" },
      { "id": "execution", "type": "select", "icon": "Play", "value": "Execucao: v2026.05.31.01" },
      { "id": "compareWith", "type": "dateRange", "label": "Comparar com:", "value": "01 Abr — 30 Abr 2026" }
    ],
    "actions": [
      { "id": "newExecution", "label": "Nova execucao", "icon": "Plus", "variant": "primary" },
      { "id": "export", "label": "Exportar", "icon": "Download", "variant": "secondary" }
    ]
  },
  "summaryCards": [
    {
      "id": "scale",
      "title": "Escalar",
      "value": "3",
      "subtitle": "R$ 3,38M de oportunidades",
      "icon": "TrendingUp",
      "tone": "green"
    },
    {
      "id": "defend",
      "title": "Defender",
      "value": "2",
      "subtitle": "R$ 1,42M sob risco se reduzir",
      "icon": "Shield",
      "tone": "orange"
    },
    {
      "id": "investigate",
      "title": "Investigar",
      "value": "2",
      "subtitle": "R$ 0,91M a validar",
      "icon": "Search",
      "tone": "blue"
    },
    {
      "id": "reduce",
      "title": "Reduzir",
      "value": "1",
      "subtitle": "R$ 0,61M a realocar",
      "icon": "CornerDownRight",
      "tone": "red"
    }
  ],
  "allocationMatrix": {
    "title": "Matriz de alocacao",
    "subtitle": "Bolhas = Receita atribuida (tamanho) • Cor = Recomendacao",
    "axes": {
      "x": "Participacao no investimento",
      "y": "Participacao na receita atribuida"
    },
    "scale": {
      "x": ["0%", "1%", "10%", "100%"],
      "y": ["0%", "50%", "100%"]
    },
    "quadrants": [
      { "label": "Investigar", "position": "top-left", "description": "Alto retorno, baixo investimento" },
      { "label": "Escalar", "position": "top-right", "description": "Alto retorno, alto investimento" },
      { "label": "Reduzir", "position": "bottom-left", "description": "Baixo retorno, baixo investimento" },
      { "label": "Defender", "position": "bottom-right", "description": "Baixo retorno, alto investimento" }
    ],
    "points": [
      { "channel": "Google Ads", "x": 18, "y": 82, "revenue": "R$ 24,82M", "recommendation": "Escalar", "tone": "green" },
      { "channel": "Meta Ads", "x": 35, "y": 66, "revenue": "R$ 13,14M", "recommendation": "Escalar", "tone": "green" },
      { "channel": "WhatsApp CRM", "x": 0.8, "y": 68, "revenue": "R$ 5,31M", "recommendation": "Investigar", "tone": "blue" },
      { "channel": "Email", "x": 0.4, "y": 61, "revenue": "R$ 2,11M", "recommendation": "Investigar", "tone": "blue" },
      { "channel": "Display", "x": 0.2, "y": 24, "revenue": "R$ 1,02M", "recommendation": "Reduzir", "tone": "red" },
      { "channel": "Organic Search", "x": 12, "y": 29, "revenue": "R$ 4,12M", "recommendation": "Defender", "tone": "orange" },
      { "channel": "Direct", "x": 60, "y": 32, "revenue": "R$ 2,21M", "recommendation": "Defender", "tone": "orange" }
    ],
    "helper": "Canais no quadrante Escalar geram alto retorno relativo e ja merecem mais investimento."
  },
  "opportunitiesAndRisks": {
    "title": "Oportunidades e riscos",
    "scaleOpportunities": [
      { "channel": "Google Ads", "impact": "+R$ 1,82M", "roasMarkov": "6,1x" },
      { "channel": "Meta Ads", "impact": "+R$ 1,12M", "roasMarkov": "4,8x" },
      { "channel": "WhatsApp CRM", "impact": "+R$ 0,44M", "roasMarkov": "8,3x" }
    ],
    "reductionRisks": [
      { "channel": "Organic Search", "impact": "-R$ 0,74M", "reason": "Queda de receita" },
      { "channel": "Direct", "impact": "-R$ 0,68M", "reason": "Queda de receita" }
    ],
    "technicalNote": "Nossos modelos indicam que e possivel escalar R$ 3,38M mantendo ROI estavel."
  },
  "channelsTable": {
    "title": "Tabela de canais",
    "controls": [
      { "id": "columns", "label": "Personalizar colunas", "icon": "SlidersHorizontal" },
      { "id": "search", "placeholder": "Buscar canal" }
    ],
    "columns": ["Canal", "Recomendacao", "Spend (R$)", "Receita atribuida (R$)", "ROAS Markov", "ROAS Shapley", "Consenso", "Papel", "Presenca", "Acao"],
    "rows": [
      {
        "channel": "Google Ads",
        "recommendation": "Escalar",
        "spend": "5,21M",
        "spendDelta": "+18,6%",
        "revenue": "24,82M",
        "revenueDelta": "+19,8%",
        "roasMarkov": "6,02x",
        "roasMarkovDelta": "+9,4%",
        "roasShapley": "6,31x",
        "roasShapleyDelta": "+10,1%",
        "consensus": "92%",
        "role": "Gerador de demanda",
        "presence": 5,
        "action": "open"
      },
      {
        "channel": "Meta Ads",
        "recommendation": "Escalar",
        "spend": "2,74M",
        "spendDelta": "+16,7%",
        "revenue": "13,14M",
        "revenueDelta": "+17,2%",
        "roasMarkov": "4,80x",
        "roasMarkovDelta": "+7,8%",
        "roasShapley": "5,21x",
        "roasShapleyDelta": "+8,9%",
        "consensus": "88%",
        "role": "Gerador de demanda",
        "presence": 4,
        "action": "open"
      },
      {
        "channel": "WhatsApp CRM",
        "recommendation": "Investigar",
        "spend": "0,64M",
        "spendDelta": "+11,3%",
        "revenue": "5,31M",
        "revenueDelta": "+14,5%",
        "roasMarkov": "8,32x",
        "roasMarkovDelta": "+12,3%",
        "roasShapley": "7,91x",
        "roasShapleyDelta": "+11,0%",
        "consensus": "76%",
        "role": "Fechador / CRM",
        "presence": 3,
        "action": "open"
      },
      {
        "channel": "Email",
        "recommendation": "Investigar",
        "spend": "0,28M",
        "spendDelta": "+8,5%",
        "revenue": "2,11M",
        "revenueDelta": "+9,9%",
        "roasMarkov": "7,54x",
        "roasMarkovDelta": "+6,4%",
        "roasShapley": "6,92x",
        "roasShapleyDelta": "+5,3%",
        "consensus": "68%",
        "role": "Nutricao / Retencao",
        "presence": 3,
        "action": "open"
      },
      {
        "channel": "Display",
        "recommendation": "Reduzir",
        "spend": "0,82M",
        "spendDelta": "-12,4%",
        "revenue": "1,02M",
        "revenueDelta": "-9,7%",
        "roasMarkov": "1,02x",
        "roasMarkovDelta": "-7,1%",
        "roasShapley": "0,87x",
        "roasShapleyDelta": "-6,3%",
        "consensus": "18%",
        "role": "Topo de funil",
        "presence": 2,
        "action": "open"
      },
      {
        "channel": "Organic Search",
        "recommendation": "Defender",
        "spend": "0,94M",
        "spendDelta": "+2,1%",
        "revenue": "4,12M",
        "revenueDelta": "+3,6%",
        "roasMarkov": "4,39x",
        "roasMarkovDelta": "-0,8%",
        "roasShapley": "4,21x",
        "roasShapleyDelta": "-1,2%",
        "consensus": "71%",
        "role": "Captura de demanda",
        "presence": 4,
        "action": "open"
      },
      {
        "channel": "Direct",
        "recommendation": "Defender",
        "spend": "0,41M",
        "spendDelta": "+1,3%",
        "revenue": "2,21M",
        "revenueDelta": "+1,8%",
        "roasMarkov": "5,39x",
        "roasMarkovDelta": "-1,6%",
        "roasShapley": "5,12x",
        "roasShapleyDelta": "-1,9%",
        "consensus": "66%",
        "role": "Fidelizacao",
        "presence": 3,
        "action": "open"
      }
    ],
    "pagination": "Exibindo 1-7 de 7 canais"
  },
  "selectedChannelDrawer": {
    "channel": "Google Ads",
    "recommendation": "Escalar",
    "tabs": ["Resumo", "Jornada", "Impactos", "Cenarios"],
    "metrics": [
      { "title": "Spend (R$)", "value": "5,21M", "delta": "+18,6%" },
      { "title": "Receita atribuida (R$)", "value": "24,82M", "delta": "+19,8%" },
      { "title": "ROAS Markov", "value": "6,02x", "delta": "+9,4%" }
    ],
    "recommendationCard": {
      "title": "Recomendacao",
      "badge": "Escalar",
      "description": "Aumentar investimento gradualmente. Alto retorno marginal e contribuicao incremental comprovada."
    },
    "rationale": [
      "ROAS Markov de 6,02x indica retorno incremental forte.",
      "92% de consenso entre Markov e Shapley (6,31x).",
      "Participacao na receita supera a participacao no investimento.",
      "Saturacao ainda distante."
    ],
    "journeyRole": {
      "label": "Gerador de demanda",
      "description": "Atrai novos usuarios e inicia a maioria das jornadas."
    },
    "transitions": {
      "before": [
        { "channel": "Organic Search", "value": "23%" },
        { "channel": "Direct", "value": "18%" },
        { "channel": "Display", "value": "12%" }
      ],
      "after": [
        { "channel": "WhatsApp CRM", "value": "42%" },
        { "channel": "Email", "value": "26%" },
        { "channel": "Direct", "value": "16%" }
      ]
    },
    "suggestedAction": {
      "title": "Acao sugerida",
      "description": "Aumentar investimento em +20% nas proximas 2 semanas, priorizando campanhas de Search e Performance Max.",
      "slider": {
        "min": "-20%",
        "current": "Atual",
        "selected": "+20%",
        "max": "+40%"
      },
      "estimatedImpact": {
        "revenue": "+R$ 4,6M",
        "roas": "5,6x - 6,4x"
      }
    },
    "actions": ["Ver canal 360", "Criar cenario"]
  }
}
```

## Componentes sugeridos

- `BudgetDecisionsPage`
- `BudgetDecisionHeader`
- `RecommendationSummaryCards`
- `AllocationMatrix`
- `OpportunitiesRisksPanel`
- `ChannelDecisionTable`
- `ChannelDetailsDrawer`
- `RecommendedActionSimulator`

## Instrucoes de implementacao

- Usar `BubbleMatrix` compartilhado para a matriz de alocacao, com escala logaritmica no eixo X se necessario.
- Implementar a tabela com `@tanstack/react-table`.
- Clique em uma linha/canal deve abrir `ChannelDetailsDrawer`.
- O drawer lateral deve ocupar cerca de 360-420px no desktop, com fechamento no `X` e `Esc`.
- Usar badges semanticas para recomendacao: `Escalar`, `Defender`, `Investigar`, `Reduzir`.
- O slider de acao sugerida pode usar Radix Slider ou componente existente.
- Os dados da tabela devem ser tipados e reutilizados no drawer.

## Criterios de aceite

- A tela mostra cards de resumo, matriz, painel de oportunidades/riscos, tabela e drawer de Google Ads.
- O canal selecionado no drawer corresponde a linha/bolha escolhida.
- A tabela suporta busca por canal e personalizacao de colunas, mesmo que inicialmente mockada.
- Todas as variacoes positivas/negativas aparecem com cores consistentes.

