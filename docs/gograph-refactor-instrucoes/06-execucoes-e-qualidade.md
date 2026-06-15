# Tela 06 - Execucoes & Qualidade

## Tarefa para IA

Refatorar a tela `Execucoes & Qualidade` para gerenciar execucoes de modelo, historico, confianca, alertas, comparacao e detalhes da execucao selecionada em painel lateral.

## JSON transcrito da tela

```json
{
  "screen": {
    "id": "executions-quality",
    "title": "Execucoes & Qualidade",
    "subtitle": "Gerencie execucoes do modelo e garanta confianca nas analises.",
    "route": "/execucoes-e-qualidade",
    "activeNav": "Execucoes & Qualidade"
  },
  "topBar": {
    "actions": [
      { "id": "newExecution", "label": "Nova execucao", "icon": "Plus", "variant": "primary" },
      { "id": "modelParameters", "label": "Parametros do modelo", "icon": "Settings", "variant": "secondary" },
      { "id": "export", "label": "Exportar", "icon": "Download", "variant": "secondary" }
    ]
  },
  "summaryMetrics": [
    {
      "id": "totalExecutions",
      "title": "Total de execucoes",
      "value": "87",
      "icon": "SlidersHorizontal",
      "tone": "blue",
      "delta": { "value": "+14", "label": "vs. mes anterior", "tone": "positive" }
    },
    {
      "id": "lastConfidence",
      "title": "Confianca da ultima execucao",
      "value": "92%",
      "badge": "Alta",
      "icon": "ShieldCheck",
      "tone": "green",
      "delta": { "value": "+6 p.p.", "label": "vs. execucao anterior", "tone": "positive" }
    },
    {
      "id": "averageRuntime",
      "title": "Runtime medio",
      "value": "2,6 h",
      "icon": "Clock",
      "tone": "blue",
      "delta": { "value": "-0,4 h", "label": "vs. mes anterior", "tone": "positive" }
    },
    {
      "id": "criticalAlerts",
      "title": "Alertas criticos",
      "value": "2",
      "icon": "TriangleAlert",
      "tone": "red",
      "subtitle": "Atencao necessaria"
    }
  ],
  "executionHistory": {
    "title": "Historico de execucoes",
    "controls": [
      { "id": "search", "placeholder": "Buscar execucao..." },
      { "id": "filter", "label": "Filtrar", "icon": "ListFilter" }
    ],
    "columns": ["Periodo", "Status", "Receita", "Conversao observada", "Conversao modelada", "Confianca", "Runtime", "Criado por", "Acoes"],
    "rows": [
      {
        "period": "01 Abr — 30 Abr 2026",
        "status": "Concluido",
        "statusTone": "green",
        "revenue": "R$ 24,8M",
        "observedConversion": "3,09%",
        "modeledConversion": "3,48%",
        "confidence": "92%",
        "confidenceBadge": "Alta",
        "runtime": "2h 18m",
        "createdBy": "Ana Martins",
        "createdAt": "30 Abr 2026, 08:24",
        "selected": true
      },
      {
        "period": "01 Mar — 31 Mar 2026",
        "status": "Em processamento",
        "statusTone": "blue",
        "revenue": "R$ 22,1M",
        "observedConversion": "2,98%",
        "modeledConversion": "3,31%",
        "confidence": "—",
        "runtime": "1h 07m (76%)",
        "createdBy": "Ana Martins",
        "createdAt": "Hoje, 09:11"
      },
      {
        "period": "01 Fev — 28 Fev 2026",
        "status": "Atencao",
        "statusTone": "orange",
        "revenue": "R$ 20,5M",
        "observedConversion": "2,71%",
        "modeledConversion": "3,12%",
        "confidence": "68%",
        "confidenceBadge": "Media",
        "runtime": "2h 41m",
        "createdBy": "Ana Martins",
        "createdAt": "01 Mar 2026, 08:16"
      },
      {
        "period": "01 Jan — 31 Jan 2026",
        "status": "Concluido",
        "statusTone": "green",
        "revenue": "R$ 18,7M",
        "observedConversion": "2,63%",
        "modeledConversion": "3,05%",
        "confidence": "88%",
        "confidenceBadge": "Alta",
        "runtime": "2h 07m",
        "createdBy": "Rodrigo Silva",
        "createdAt": "01 Fev 2026, 09:02"
      },
      {
        "period": "01 Dez 2025 — 31 Dez 2025",
        "status": "Concluido",
        "statusTone": "green",
        "revenue": "R$ 17,2M",
        "observedConversion": "2,50%",
        "modeledConversion": "2,94%",
        "confidence": "85%",
        "confidenceBadge": "Alta",
        "runtime": "1h 59m",
        "createdBy": "Rodrigo Silva",
        "createdAt": "01 Jan 2026, 08:45"
      }
    ],
    "pagination": {
      "summary": "Mostrando 1 a 5 de 87 execucoes",
      "pages": [1, 2, 3, "...", 18]
    }
  },
  "trustCenter": {
    "title": "Trust Center",
    "overallConfidence": {
      "value": "92%",
      "badge": "Alta",
      "delta": "+6 p.p. vs. execucao anterior"
    },
    "modelCalibration": [
      { "label": "Conversao modelada vs. observada", "value": "94%" },
      { "label": "Receita modelada vs. observada", "value": "91%" }
    ],
    "dataQuality": [
      { "label": "Qualidade dos dados", "value": "96%" },
      { "label": "Cobertura de eventos", "value": "98%" },
      { "label": "Match de usuarios", "value": "93%" },
      { "label": "Direct share (baseada em brand lift)", "value": "12%" },
      { "label": "Other share (organico + direto nao atribuido)", "value": "14%" },
      { "label": "Cobertura de investimento", "value": "97%" }
    ],
    "alerts": {
      "title": "Alertas criticos (2)",
      "items": [
        "Cobertura de investimento abaixo do ideal. 7% do investimento nao foi coberto pelos dados.",
        "Queda na calibracao de receita. Diferenca de 9 p.p. vs. execucao anterior."
      ],
      "action": "Ver todos os alertas"
    },
    "checks": {
      "title": "Checks de qualidade",
      "value": "8/8",
      "description": "Todos os checks passaram",
      "action": "Ver detalhes dos checks"
    }
  },
  "compareExecutions": {
    "title": "Comparar execucoes",
    "from": "01 Abr — 30 Abr 2026 (Atual)",
    "to": "01 Mar — 31 Mar 2026 (Anterior)",
    "variation": {
      "title": "Variacao de receita total",
      "value": "+ R$ 2,7M",
      "delta": "+12,2%"
    },
    "channelContributionChange": [
      { "channel": "Google Ads", "from": "1,27%", "to": "1,36%", "delta": "+0,09 p.p.", "tone": "green" },
      { "channel": "Meta Ads", "from": "0,92%", "to": "0,85%", "delta": "-0,07 p.p.", "tone": "red" },
      { "channel": "WhatsApp CRM", "from": "0,38%", "to": "0,45%", "delta": "+0,07 p.p.", "tone": "green" },
      { "channel": "Email", "from": "0,23%", "to": "0,21%", "delta": "-0,02 p.p.", "tone": "red" },
      { "channel": "Display", "from": "0,17%", "to": "0,16%", "delta": "-0,01 p.p.", "tone": "red" },
      { "channel": "Outros", "from": "0,51%", "to": "0,45%", "delta": "-0,06 p.p.", "tone": "red" }
    ],
    "legend": [
      { "label": "Aumentou", "tone": "green" },
      { "label": "Diminuiu", "tone": "red" },
      { "label": "Estavel", "tone": "gray" }
    ],
    "action": "Ver comparacao completa"
  },
  "executionDetailsPanel": {
    "title": "Detalhes da execucao",
    "period": "01 Abr — 30 Abr 2026",
    "status": "Concluido",
    "createdAt": "30 Abr 2026, 08:24",
    "createdBy": "Ana Martins",
    "tabs": ["Parametros", "Entradas", "Saidas", "Logs"],
    "activeTab": "Parametros",
    "modelParameters": [
      { "label": "Lookback (janela de analise)", "value": "90 dias" },
      { "label": "Decaimento (lambda - half-life)", "value": "30 dias" },
      { "label": "Amostras Shapley", "value": "100.000" },
      { "label": "Amostra nao-conversao", "value": "1.000.000" },
      { "label": "Janela de censura", "value": "7 dias" },
      { "label": "Granularidade", "value": "Diaria" },
      { "label": "Moeda", "value": "BRL" },
      { "label": "Modelo de atribuicao", "value": "Shapley Value" },
      { "label": "Versao do algoritmo", "value": "v2026.05.31.01" }
    ],
    "notes": {
      "title": "Notas",
      "value": "Execucao mensal padrao.",
      "action": "Editar"
    },
    "confidenceBox": {
      "title": "Confianca desta execucao: Alta",
      "description": "Modelo alinhado com os dados de alta qualidade. Recomendacoes com alto grau de confianca.",
      "action": "Ver detalhes tecnicos"
    },
    "actions": [
      { "id": "rerun", "label": "Reexecutar", "icon": "RefreshCw", "variant": "secondary" },
      { "id": "more", "label": "Mais", "icon": "Ellipsis", "variant": "icon" }
    ]
  }
}
```

## Componentes sugeridos

- `ExecutionsQualityPage`
- `ExecutionSummaryCards`
- `ExecutionHistoryTable`
- `TrustCenterPanel`
- `ExecutionComparisonPanel`
- `ExecutionDetailsPanel`
- `ModelParametersList`
- `QualityAlertsCard`

## Instrucoes de implementacao

- Usar layout com conteudo principal e painel lateral persistente de detalhes no desktop.
- A linha selecionada da tabela deve destacar borda/fundo azul e atualizar `ExecutionDetailsPanel`.
- Implementar tabs do painel lateral com Radix Tabs ou componente existente.
- Historico deve usar `DataTable` com busca, filtro e paginacao.
- `TrustCenterPanel` deve reutilizar `ProgressBar`, `Badge` e `AlertCard`.
- Comparacao de execucoes deve mostrar linhas com barras de antes/depois e delta colorido.
- Separar dados de execucao em `executions.mock.ts` e tipos em `executions.types.ts`.

## Criterios de aceite

- O topo contem titulo, subtitulo e tres acoes.
- Quatro cards de resumo aparecem antes da tabela.
- Painel lateral mostra detalhes da execucao selecionada e tabs.
- Trust Center e Comparar execucoes ficam abaixo da tabela.
- Alertas criticos aparecem em vermelho suave, checks aprovados em verde suave.

