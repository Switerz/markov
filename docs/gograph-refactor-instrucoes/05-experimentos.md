# Tela 05 - Experimentos

## Tarefa para IA

Refatorar a tela `Experimentos` para simular cenarios, comparar baseline versus cenario, visualizar redistribuicao de atribuicao e gerar aprendizados/planos de teste.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "experiments",
    "title": "Experimentos",
    "subtitle": "Simule cenarios, compare impactos e valide hipoteses antes de executar.",
    "route": "/experimentos",
    "activeNav": "Experimentos"
  },
  "topBar": {
    "executionContext": {
      "label": "Contexto de execucao",
      "value": "01 Mai — 31 Mai 2026",
      "icon": "Calendar"
    },
    "actions": [
      { "id": "newScenario", "label": "Novo cenario", "icon": "Plus", "variant": "primary" },
      { "id": "saveExperiment", "label": "Salvar experimento", "icon": "Save", "variant": "secondary" },
      { "id": "more", "label": "Mais opcoes", "icon": "EllipsisVertical", "variant": "icon" }
    ]
  },
  "scenarioBuilder": {
    "title": "Construcao do cenario",
    "subtitle": "Defina a acao e os parametros do cenario.",
    "actionTypes": [
      { "id": "removeChannel", "label": "Remover canal", "icon": "Trash2", "active": true },
      { "id": "reducePresence", "label": "Reduzir presenca", "icon": "Activity" },
      { "id": "redistributeBudget", "label": "Redistribuir budget", "icon": "ChartNoAxesCombined" },
      { "id": "compareModels", "label": "Comparar modelos", "icon": "GitCompare" }
    ],
    "fields": [
      { "id": "channel", "label": "Canal / Tatica", "type": "select", "value": "Display", "icon": "Monitor" },
      { "id": "action", "label": "Acao", "type": "select", "value": "Remover canal" },
      { "id": "intensity", "label": "Intensidade", "type": "slider", "value": 100, "marks": ["0%", "50%", "100%"] },
      { "id": "period", "label": "Periodo de simulacao", "type": "dateRange", "value": "01 Mai — 31 Mai 2026 (periodo inteiro)", "icon": "Calendar" },
      { "id": "advancedOptions", "label": "Opcoes avancadas", "type": "accordion" }
    ],
    "primaryAction": {
      "label": "Aplicar cenario",
      "icon": "Play"
    }
  },
  "baselineVsScenario": {
    "title": "Baseline vs Cenario",
    "legend": [
      { "label": "Baseline", "tone": "blue" },
      { "label": "Cenario", "tone": "green" }
    ],
    "baseline": {
      "title": "Baseline (atual)",
      "period": "01 Mai — 31 Mai 2026",
      "metrics": [
        { "label": "Probabilidade de conversao", "value": "3,48%" },
        { "label": "Receita atribuida", "value": "R$ 24,8M" },
        { "label": "Investimento total", "value": "R$ 4,12M" },
        { "label": "ROAS atribuido", "value": "6,02x" },
        { "label": "Impacto estimado", "value": "—" }
      ]
    },
    "scenario": {
      "title": "Cenario: Sem Display",
      "period": "01 Mai — 31 Mai 2026",
      "metrics": [
        { "label": "Probabilidade de conversao", "value": "3,10%", "delta": "-0,38pp", "tone": "red" },
        { "label": "Receita atribuida", "value": "R$ 22,1M", "delta": "-10,9%", "tone": "red" },
        { "label": "Investimento total", "value": "R$ 3,50M", "delta": "-15,1%", "tone": "red" },
        { "label": "ROAS atribuido", "value": "6,31x", "delta": "+0,29x", "tone": "green" },
        { "label": "Impacto estimado", "value": "-R$ 2,72M", "delta": "-10,9%", "tone": "red" }
      ]
    },
    "delta": {
      "title": "Delta (Cenario vs Baseline)",
      "metrics": [
        { "label": "Probabilidade de conversao", "value": "-0,38pp", "tone": "red" },
        { "label": "Receita atribuida", "value": "-R$ 2,72M", "delta": "-10,9%", "tone": "red" },
        { "label": "Investimento total", "value": "-R$ 0,62M", "delta": "-15,1%", "tone": "red" },
        { "label": "ROAS atribuido", "value": "+0,29x", "delta": "+4,8%", "tone": "green" },
        { "label": "Impacto estimado", "value": "-R$ 2,72M", "delta": "-10,9%", "tone": "red" }
      ]
    }
  },
  "redistributionChart": {
    "title": "Redistribuicao da atribuicao",
    "subtitle": "Variacao da receita atribuida por canal/tatica (R$)",
    "control": "Canal (agregado)",
    "waterfall": [
      { "label": "Baseline", "value": 24.8, "display": "24,8M", "type": "start" },
      { "label": "Display (removido)", "value": -2.72, "display": "-2,72M", "type": "negative" },
      { "label": "Meta Ads", "value": 1.05, "display": "+1,05M", "type": "positive" },
      { "label": "Google Ads", "value": 0.68, "display": "+0,68M", "type": "positive" },
      { "label": "Email", "value": 0.54, "display": "+0,54M", "type": "positive" },
      { "label": "WhatsApp CRM", "value": 0.28, "display": "+0,28M", "type": "positive" },
      { "label": "Influencers", "value": 0.0, "display": "", "type": "bridge" },
      { "label": "Cenario", "value": 22.1, "display": "22,1M", "type": "end" }
    ],
    "note": "A remocao de Display reduz a receita atribuida em R$ 2,72M (-10,9%). O impacto e parcialmente compensado por Meta Ads e Google Ads."
  },
  "scenarioInsights": {
    "title": "Insights do cenario",
    "hypothesis": "Display apresenta baixa eficiencia marginal e sua remocao pode manter ROAS estavel realocando valor para canais com maior propensao de conversao.",
    "mainLearnings": [
      "A remocao de Display reduz a receita atribuida em 10,9%.",
      "Meta Ads e Google Ads compensam 63% da perda de receita.",
      "ROAS melhora +0,29x, indicando maior eficiencia do investimento."
    ],
    "riskBox": {
      "title": "Risco & Observacoes",
      "items": [
        "Display contribui para alcance incremental e construcao de demanda.",
        "A remocao pode impactar volume futuro nao capturado neste periodo."
      ]
    },
    "nextRecommendedTest": {
      "title": "Proximo teste recomendado",
      "description": "Executar um teste incremental de geo-holdout removendo Display em 10% das regioes por 2-3 semanas para validar o impacto causal.",
      "estimatedImpact": {
        "revenue": "-R$ 2,7M",
        "roas": "+0,29x",
        "confidence": "Alta"
      }
    },
    "actions": [
      { "id": "createIncrementalTestPlan", "label": "Criar plano de teste incremental", "icon": "FlaskConical", "variant": "primary" },
      { "id": "saveDraft", "label": "Salvar rascunho do cenario", "icon": "Bookmark", "variant": "secondary" }
    ]
  },
  "scenarioComparisonTable": {
    "title": "Comparacao de cenarios",
    "columns": ["Cenario", "Prob. de conversao", "Receita atribuida", "Investimento total", "ROAS atribuido", "Impacto estimado", "Acoes"],
    "rows": [
      { "scenario": "Baseline (atual)", "description": "Periodo inteiro", "conversionProbability": "3,48%", "revenue": "R$ 24,8M", "investment": "R$ 4,12M", "roas": "6,02x", "impact": "—", "tone": "blue" },
      { "scenario": "Sem Display", "description": "Remover canal", "conversionProbability": "3,10%", "conversionDelta": "-0,38pp", "revenue": "R$ 22,1M", "revenueDelta": "-10,9%", "investment": "R$ 3,50M", "investmentDelta": "-15,1%", "roas": "6,31x", "roasDelta": "+0,29x", "impact": "-R$ 2,72M", "impactDelta": "-10,9%", "tone": "red" },
      { "scenario": "Sem Influencers", "description": "Remover canal", "conversionProbability": "3,33%", "conversionDelta": "-0,15pp", "revenue": "R$ 23,5M", "revenueDelta": "-5,2%", "investment": "R$ 3,63M", "investmentDelta": "-11,9%", "roas": "6,47x", "roasDelta": "+0,45x", "impact": "-R$ 1,29M", "impactDelta": "-5,2%", "tone": "purple" },
      { "scenario": "Menos 10% Meta Ads", "description": "Reduzir presenca", "conversionProbability": "3,31%", "conversionDelta": "-0,17pp", "revenue": "R$ 23,9M", "revenueDelta": "-3,5%", "investment": "R$ 3,71M", "investmentDelta": "-10,0%", "roas": "6,44x", "roasDelta": "+0,42x", "impact": "-R$ 0,90M", "impactDelta": "-3,5%", "tone": "orange" }
    ],
    "action": "Ver todos os cenarios (7)"
  }
}
```

## Componentes sugeridos

- `ExperimentsPage`
- `ScenarioBuilderForm`
- `BaselineScenarioComparison`
- `MetricComparisonColumn`
- `AttributionRedistributionWaterfall`
- `ScenarioInsightsPanel`
- `ScenarioComparisonTable`

## Instrucoes de implementacao

- `ScenarioBuilderForm` deve ser controlado por `react-hook-form` e validado com `zod`.
- Separar calculo/simulacao de cenario em hook `useScenarioSimulation`.
- Usar `WaterfallChart` compartilhado para a redistribuicao de atribuicao.
- A tabela de comparacao deve usar `DataTable`.
- O painel de insights deve ser uma coluna lateral fixa no desktop e virar bloco empilhado no mobile.
- `Aplicar cenario` deve alterar o estado da comparacao e atualizar grafico/tabela.
- Criar tipos `Scenario`, `ScenarioMetric`, `ScenarioActionType`, `ScenarioSimulationResult`.

## Criterios de aceite

- A tela mostra construtor, comparacao baseline/cenario/delta, waterfall e painel de insights.
- O estado ativo e `Cenario: Sem Display`.
- Valores negativos aparecem em vermelho; ganhos de eficiencia aparecem em verde.
- A tabela final mostra baseline e pelo menos tres cenarios.
- O formulario nao mistura regras de negocio com JSX visual.

