# GoGraph — Documentação Técnica
### Sistema de Atribuição Multi-Touch da GoCase

---

## Sumário

1. [Contexto e Problema](#1-contexto-e-problema)
2. [Visão Geral da Solução](#2-visão-geral-da-solução)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Fontes de Dados](#4-fontes-de-dados)
5. [Classificação de Canais](#5-classificação-de-canais)
6. [Modelos de Atribuição](#6-modelos-de-atribuição)
7. [Pipeline de Execução](#7-pipeline-de-execução)
8. [Interface Web — GoGraph UI](#8-interface-web--gograph-ui)
9. [Configuração e Parâmetros](#9-configuração-e-parâmetros)
10. [Métricas Geradas](#10-métricas-geradas)
11. [Estrutura de Código](#11-estrutura-de-código)
12. [Limitações Conhecidas](#12-limitações-conhecidas)

---

## 1. Contexto e Problema

### 1.1 O Cenário

A GoCase é um e-commerce brasileiro de acessórios de celular que investe mensalmente em mais de 15 canais de marketing: Google Ads (Search, Shopping, PMax), Meta (Facebook/Instagram), TikTok, Display/Retargeting, Email, WhatsApp CRM, SMS, Organic Search, Direct, entre outros.

Até a criação do GoGraph, **toda decisão de alocação de verba era baseada em atribuição por Last Click**: o último canal tocado antes de uma compra recebia 100% do crédito pela conversão. As plataformas de anúncio (Google Ads, Meta Ads Manager) reforçavam esse viés ao reportarem seus próprios números com metodologias proprietárias e muitas vezes infladas.

### 1.2 O Problema

A atribuição por Last Click produz distorções sistemáticas:

| Canal | Papel real | Impacto do Last Click |
|---|---|---|
| Paid Meta Ads | Introduz o cliente à marca (topo de funil) | Subvalorizado — raramente é o último toque |
| Organic Search | Recaptura intenção de compra | Supervalorizado — frequentemente último toque |
| Email / WhatsApp | Reativa clientes que já conhecem a marca | Neutro a supervalorizado dependendo do fluxo |
| Display / Retargeting | Mantém o cliente no funil (meio de jornada) | Invisível ao Last Click |

O time de mídia tomava decisões de corte e escala baseadas em dados enviesados. **Não havia como responder com dados próprios à pergunta mais básica do marketing: qual canal realmente gerou a venda?**

### 1.3 A Oportunidade

A GoCase usa o **Plausible Analytics** para rastrear sessões no site, incluindo parâmetros UTM completos e um identificador cross-sessão (`user_pseudo_id`). Esse dado permite reconstruir a jornada completa de cada usuário — desde a primeira visita até a compra — sem depender de pixels de terceiros. A oportunidade era transformar esses dados brutos em atribuição probabilística de qualidade institucional.

---

## 2. Visão Geral da Solução

O **GoGraph** é um sistema interno de atribuição multi-touch que:

1. **Extrai** automaticamente as jornadas de usuários do ClickHouse (via API Metabase)
2. **Classifica** cada sessão em um dos 19 estados de canal mapeados
3. **Calcula** quatro modelos de atribuição complementares: Markov Chain, Shapley Values, PFC e Funnel Stage Markov
4. **Calcula ROAS** cruzando receita atribuída com spend real de cada canal
5. **Persiste** os resultados em banco local (SQLite) para comparação histórica
6. **Exibe** tudo em uma interface web interativa com 10 abas de análise

A solução é **100% baseada em dados próprios**, sem dependência de pixel do Google ou Meta. Roda sob demanda com dois parâmetros: data de início e data de fim.

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FONTES DE DADOS                          │
│                                                                 │
│  ClickHouse (DB 70)              PostgreSQL — Data Mart (DB 63) │
│  ├── plausible_events_db         ├── raw.gogroup_google_ads      │
│  │   .sessions_v2                ├── raw.gogroup_meta_segments   │
│  └── analytics                  └── raw.insider_journey_channels │
│      .purchases_dedup_lm_v2                                     │
└───────────────────┬─────────────────────────────────────────────┘
                    │  REST API (Metabase /api/dataset)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PIPELINE PYTHON                            │
│                                                                 │
│  extract.py          → SQL nativo via Metabase API              │
│  attribution_service → Markov Chain + Removal Effect            │
│  pfc_service         → Position-Frequency-Causal                │
│  funnel_markov_service → Funnel Stage Markov                    │
│  roas_service        → ROAS por canal                           │
│  loop_service        → Diagnóstico de auto-loops                │
│  sequential_service  → Sequential Effects (bigrams)             │
│  model_service       → Orquestrador principal                   │
└───────────────────┬─────────────────────────────────────────────┘
                    │  SQLAlchemy (SQLite)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND REST                               │
│                      FastAPI + Uvicorn                          │
│                                                                 │
│  POST /api/model-runs/         → executa novo model run         │
│  GET  /api/model-runs/         → lista runs históricos          │
│  GET  /api/model-runs/{id}     → resultado completo de um run   │
└───────────────────┬─────────────────────────────────────────────┘
                    │  HTTP (localhost)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND WEB                               │
│                      React + TypeScript + Vite                  │
│                                                                 │
│  10 abas: Overview, Canais, Grafo, Insights, Touchpoints,       │
│  Diagnósticos, Oportunidades, Sessões, Sandbox, Qualidade       │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Técnica

| Camada | Tecnologia |
|---|---|
| Extração de dados | Python 3.11 + requests + pandas |
| Algoritmos de atribuição | Python (networkx, numpy, scipy) |
| Backend API | FastAPI + SQLAlchemy + SQLite |
| Frontend | React 18 + TypeScript + Vite |
| Visualização de grafo | React Flow |
| Infra de dados | ClickHouse (Plausible) + PostgreSQL (Data Mart) |
| Gateway de dados | Metabase API REST |
| Rastreamento de eventos | Plausible Analytics |
| CRM | Insider (SMS / WhatsApp) |

---

## 4. Fontes de Dados

### 4.1 Sessões de Usuário — ClickHouse DB 70

**Tabela:** `plausible_events_db.sessions_v2`

Cada linha representa uma sessão de um usuário no site. Campos utilizados:

| Campo | Uso |
|---|---|
| `entry_meta.value[indexOf(entry_meta.key, 'user_pseudo_id')]` | Identificador cross-sessão (cookie Plausible) |
| `utm_medium`, `utm_source`, `utm_campaign` | Classificação do canal de origem |
| `acquisition_channel` | Fallback quando UTM está ausente |
| `start`, `duration`, `pageviews`, `events` | Métricas de qualidade de sessão |
| `is_bounce` | Indicador de sessão de baixa qualidade |
| `pathname` | URL de entrada (usada para enriquecer o estágio de funil) |

### 4.2 Compras — ClickHouse DB 70

**Tabela:** `analytics.purchases_dedup_lm_v2`

Compras deduplificadas por transação. Campos utilizados:

| Campo | Uso |
|---|---|
| `user_pseudo_id` | Chave de junção com sessões |
| `transaction_id` | Identificador único da compra |
| `revenue` | Valor da transação em BRL |
| `created_at` | Timestamp da compra (âncora do lookback) |

### 4.3 Investimento (Spend) — PostgreSQL DB 63

| Tabela | Canal | Granularidade |
|---|---|---|
| `raw.gogroup_google_ads` | Google Ads por tipo de campanha | Diária por `campaign_type` |
| `raw.gogroup_meta_segments_clientes` | Meta Ads (Facebook/Instagram) | Diária agregado |
| `raw.insider_journey_channels` | SMS e WhatsApp via Insider | Volume de envios (custo estimado) |

### 4.4 Identidade do Usuário

O sistema usa `user_pseudo_id` (cookie de sessão do Plausible) como identificador cross-sessão. Esse campo está presente tanto em `sessions_v2` quanto em `purchases_dedup_lm_v2`, permitindo juntar a jornada completa do usuário desde o primeiro toque até a conversão.

**Janela de lookback:** configurável (padrão: 30 dias). Uma compra em março pode incluir sessões de fevereiro na jornada.

---

## 5. Classificação de Canais

Cada sessão é mapeada para um dos **19 estados Markov** via lógica SQL aplicada no momento da extração. A classificação usa `utm_medium + utm_source + utm_campaign` com fallback para `acquisition_channel`.

| Estado | Critério de Classificação |
|---|---|
| **Paid Meta Ads** | `utm_medium` IN (paid_social, paid) + source = facebook/instagram/meta |
| **TikTok Ads** | `utm_medium` = paid_social + source = tiktok |
| **Google Ads / Search** | `utm_medium` = cpc + source = google + campanha prefixo `_s_` |
| **Google Ads / Search / Inst** | Search + "inst" no nome da campanha |
| **Google Ads / Shopping** | `utm_medium` = cpc + campanha prefixo `shopping-` |
| **Google Ads / Shopping / Inst** | Shopping + "inst" |
| **Google Ads / PMax** | `utm_medium` = cpc + campanha prefixo `pmax-` |
| **Google Ads / Other** | CPC Google não classificado acima |
| **Display / Retargeting** | Source = criteo, rtbhouse |
| **Email** | Source = klarna, newsletter, `utm_medium` = email |
| **WhatsApp CRM** | `utm_medium` = whatsapp + source relacionado a CRM |
| **SMS** | `utm_medium` = sms |
| **Organic Social / Instagram** | `acquisition_channel` = Organic Social + referrer Instagram |
| **Organic Social / Facebook** | `acquisition_channel` = Organic Social + referrer Facebook |
| **Organic Search** | `acquisition_channel` = Organic Search |
| **Direct** | `acquisition_channel` = Direct |
| **Clube GoCase** | `utm_medium` = clube_gocase |
| **Referral** | `acquisition_channel` = Referral |
| **Other** | Qualquer sessão que não se encaixe nos anteriores |

Além desses 19, o modelo trabalha com 3 estados especiais internos: `(start)`, `Conversion` e `Non-Conversion`.

---

## 6. Modelos de Atribuição

### 6.1 Markov Chain — Removal Effect

**Fundamento:** Cadeia de Markov de primeira ordem sobre o grafo de jornadas.

**Funcionamento:**

1. Todas as jornadas de usuários (sessões ordenadas cronologicamente) são convertidas em pares de transição `(canal_origem → canal_destino)`.
2. Uma **matriz de transição estocástica** é construída: `P(ir para B | estou em A)`.
3. O modelo calcula `P(Conversão | start)` — a probabilidade de conversão partindo do estado inicial.
4. Para cada canal C, calcula o **Removal Effect**: remove todos os nós e arestas de C do grafo e recalcula `P(Conversão | start)`. A queda percentual é o removal effect bruto de C.
5. Os removal effects são normalizados entre todos os canais → **peso Markov** (soma = 100%).

**Decaimento temporal:** Cada transição recebe peso `exp(−λ × dias_antes_da_conversão)`. Com `λ = 0,05`, uma sessão 14 dias antes da compra vale ~50% de uma sessão no dia da compra. Isso reduz o impacto de sessões muito antigas na atribuição.

**Por que é robusto:** Captura canais que funcionam como "ponte" — mesmo não sendo o último toque, sua remoção interrompe os caminhos que levam à conversão.

### 6.2 Shapley Values — Teoria dos Jogos

**Fundamento:** Conceito da teoria cooperativa de jogos (Lloyd Shapley, 1953) adaptado para atribuição de marketing.

**Funcionamento:**

1. Para cada subconjunto possível de canais, calcula `P(Conversão | usuário viu exatamente esses canais)`.
2. O valor Shapley de um canal é sua **contribuição marginal média**, calculada sobre todas as ordens possíveis de adição ao conjunto.
3. Implementado via **Monte Carlo**: N permutações aleatórias (padrão: 5.000 amostras).

**Diferença do Markov:** Shapley considera contribuições conjuntas — o valor de um canal depende de quais outros canais estão presentes na jornada. Em geral produz distribuições mais "suaves", menos sensíveis a canais pivô.

### 6.3 PFC — Position-Frequency-Causal

**Fundamento:** Modelo híbrido proprietário que combina três dimensões de contribuição.

**Funcionamento:**

1. Para cada path que converte, classifica cada toque como `first` (primeiro), `middle` (meio) ou `last` (último).
2. Calcula frequências relativas de cada canal em cada posição, ponderadas pela taxa de conversão do path.
3. Multiplica pelo peso causal do canal (derivado do Markov).

**Uso diagnóstico:** O `pfc_delta_pp` mostra quantos pontos percentuais o PFC difere do Markov. Canais com delta positivo grande aparecem muito em posições de meio de jornada e podem estar sub-atribuídos pelo Markov puro.

### 6.4 Funnel Stage Markov — Modelo Primário

**Fundamento:** Extensão do Markov onde cada estado é um par `(canal, estágio_de_funil)`.

**Estágios de funil** (detectados por eventos do Plausible):

| Estágio | Eventos que o definem |
|---|---|
| **Low Intent** | Sessão sem evento relevante (apenas pageview) |
| **Product Interest** | Visualização de produto, busca no site |
| **Cart Intent** | Adição ao carrinho, wishlist |
| **Checkout** | Início de checkout |
| **Purchase** | Compra efetivada |

**Por que é o modelo primário:** O Markov puro sofre de "Low Intent Drag" — canais com muitas sessões de baixa qualidade recebem crédito inflado apenas pelo volume de transições. O Funnel Stage Markov elimina esse viés: um clique em Meta que gerou "Product Interest" recebe crédito diferente de um que apenas ricocheteou. O `low_intent_drag_score` mede esse fenômeno: `peso_low_intent / peso_total_do_canal`.

---

## 7. Pipeline de Execução

A execução completa do modelo segue esta sequência ordenada:

```
ETAPA 1 — Extração de Transições
├── get_converting_transitions()
│   └── SQL ClickHouse: sessões dos compradores, ordenadas por tempo,
│       dentro do lookback configurado. Aplica decaimento temporal.
└── get_nonconverting_transitions()
    └── SQL ClickHouse: 1% dos não-compradores (amostragem via cityHash64).
        Aplica right-censorship se CENSORSHIP_DAYS > 0.

ETAPA 2 — Auto-calibração
└── calibrate_nonconv_scale()
    Ajusta NON_CONV_SCALE para que P(Conversão|start) do modelo
    corresponda à taxa de conversão observada real (n_compradores / n_total).

ETAPA 3 — Matriz de Transição
└── build_transition_matrix()
    Constrói P[from][to] normalizada por linha.

ETAPA 4 — Markov Chain Attribution
└── compute_markov_attribution()
    Removal effect por canal via matriz estocástica.

ETAPA 5 — Shapley Values
└── compute_shapley_attribution()
    Monte Carlo com SHAPLEY_SAMPLES permutações.

ETAPA 6 — ROAS
└── compute_roas()
    Join com spend real por canal/data.

ETAPA 7 — PFC Attribution
└── compute_pfc_attribution()
    Posição × frequência × peso Markov.

ETAPA 8 — Funnel Stage Markov
├── get_funnel_enriched_paths()
│   SQL ClickHouse: paths com estágio de funil por sessão
│   (via tabela de eventos do Plausible).
└── run_funnel_markov()
    Markov nos estados compostos (canal × estágio).

ETAPA 9 — Diagnósticos
├── compute_loop_diagnostics()
│   Canais com auto-loop; taxa de conversão dentro vs fora de loops.
└── compute_sequential_effects()
    Bigrams de canais com lift elevado (P(Conversão | A → B) vs baseline).

ETAPA 10 — Qualidade de Sessão
└── get_session_quality()
    Duração, pageviews, bounce rate por canal (conversores vs não-conversores).

ETAPA 11 — Persistência
└── save_model_run()
    Serializa resultado completo em SQLite via SQLAlchemy.
    Disponível para consulta retroativa na UI.
```

### 7.1 Amostragem de Não-Conversores

Para equilibrar o volume de não-compradores (muito maior) com compradores, o sistema amostra apenas **1% dos não-conversores**, selecionados de forma determinística por `cityHash64(user_pseudo_id) % 100 = 0`. A auto-calibração de `NON_CONV_SCALE` garante que essa amostragem não distorça a probabilidade de conversão calculada pelo modelo.

### 7.2 Right-Censorship

Usuários cuja última sessão cai dentro de `CENSORSHIP_DAYS` dias antes do fim da janela de análise são excluídos das transições de não-conversão — pois ainda podem comprar. Isso elimina um viés pessimista nos canais de reengajamento tardio.

---

## 8. Interface Web — GoGraph UI

A interface é uma SPA (Single Page Application) React que consome a API FastAPI local. Possui 10 abas funcionais:

### Overview
KPIs consolidados do model run: receita total atribuída, spend total, ROAS médio, taxa de conversão observada vs. simulada. Gráfico de barras horizontal com top 8 canais por peso Markov.

### Canais
Tabela completa com atribuição por canal:
- Colunas: Markov %, Shapley %, PFC %, Invest. %, Spend, ROAS (Markov/Shapley/First Click/Last Click)
- Gráfico de barras: Markov vs. Shapley para top 8 canais
- Toggle **Raw vs Funnel**: compara o modelo Markov puro com o Funnel Stage Markov

### Grafo
Visualização interativa do grafo de transições Markov. Nós = canais (tamanho proporcional ao peso Markov), arestas = probabilidade de transição (espessura = volume de transições). Navegável com zoom e pan.

### Insights
Alertas automáticos gerados pelo sistema: canais com ROAS anômalo, divergência alta entre Markov e Shapley, canais com removal effect acima do esperado, problemas de cobertura de dados.

### Pontos de Contato (Touchpoints)
Por canal: distribuição de posição na jornada (1º toque / meio / último) para jornadas conversoras e não-conversoras. Pills visuais coloridas mostram a proporção de forma intuitiva.

### Diagnósticos do Modelo
- **Loop Diagnostics**: canais onde o usuário retorna ao mesmo canal múltiplas vezes; taxa de conversão dentro vs. fora de loops de auto-reforço
- **Funnel Stage Attribution**: heatmap de peso Markov por `(canal × estágio de funil)`; exibe `low_intent_drag_score` por canal
- **Funnel Validation**: para cada canal, % do peso atribuído que vem de sessões de baixa intenção vs. intenção qualificada
- **Sequential Effects**: pares `(A → B)` com maior lift de conversão

### Oportunidades (ConversionView)
5 análises focadas em decisões de investimento:
1. **Simulador de Impacto**: slider de variação na taxa de conversão → receita incremental estimada
2. **Last Click vs Multi-Touch**: diferença de atribuição canal a canal entre os modelos
3. **Top 15 Lift de Conversão**: paths com maior lift, coloridos por presença de canal CRM
4. **Efeito do CRM por Posição**: lift de Email, WhatsApp e SMS como 1º toque / meio / último toque
5. **Score de Oportunidade CRM**: `score = lift × √(cobertura%)` — prioriza canais CRM com impacto real e volume relevante

### Qualidade de Sessão (SessionQualityView)
Métricas de engajamento das sessões por canal, independentemente da atribuição:
- **Score de Engajamento** = `duração × pageviews × eventos × (1 − bounce_rate)`
- **Mapa de Posicionamento (Scatter)**: Eixo X = duração média (log), Eixo Y = peso Markov. Quatro quadrantes: Estrelas / Volume sem Qualidade / Potencial Oculto / Baixa Prioridade
- **Duração conversores vs. não-conversores**: canais onde a diferença é grande indicam seleção positiva de usuários com alta intenção de compra

### Caminhos (Path Intelligence)
Top 500 paths de jornada, com taxa de conversão, receita gerada e probabilidade histórica. Filtrável por canal presente. Base de dados para o Sandbox.

### Sandbox
Editor visual interativo de jornadas: adiciona canais como nós, conecta com arestas, calcula probabilidade de conversão e lift vs. baseline do modelo. Permite salvar e nomear cenários para comparação.

### Qualidade de Dados
Checklist automático de integridade: cobertura de compras com `user_pseudo_id`, volume mínimo de transições por canal, consistência do spend reportado, taxa de conversão vs. baseline esperado do setor.

---

## 9. Configuração e Parâmetros

Todas as variáveis são configuradas via arquivo `.env` na raiz do projeto:

| Variável | Padrão | Descrição |
|---|---|---|
| `METABASE_URL` | — | URL da instância Metabase (ex: `https://metabase.empresa.com`) |
| `METABASE_API_KEY` | — | API Key de serviço do Metabase |
| `DATABASE_URL` | `sqlite:///gograph.db` | String de conexão SQLite para persistência local |
| `DB_PLAUSIBLE` | `70` | ID do banco ClickHouse no Metabase |
| `DB_DATAMART` | `63` | ID do banco PostgreSQL no Metabase |
| `START_DATE` | `2026-03-01` | Início da janela de análise |
| `END_DATE` | `2026-03-31` | Fim da janela de análise |
| `LOOKBACK_DAYS` | `30` | Dias de lookback para construção de jornadas |
| `NON_CONV_SAMPLE_PCT` | `1` | % de não-conversores a amostrar (1–100) |
| `NON_CONV_SCALE` | `null` | Fator de escala (null = auto-calibração) |
| `DECAY_LAMBDA` | `0.05` | Lambda do decaimento temporal exponencial |
| `SHAPLEY_SAMPLES` | `5000` | Amostras Monte Carlo para Shapley |
| `CENSORSHIP_DAYS` | `0` | Dias de right-censorship (0 = desligado) |
| `MODEL_BATCH_MODE` | `auto` | Modo de batching para janelas longas |
| `MODEL_BATCH_DAYS` | `35` | Tamanho dos batches em dias |

### 9.1 Como Executar

**Backend (API):**
```bash
cd gograph/backend
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd gograph/frontend
npm install
npm run dev
```

**Pipeline standalone (sem UI):**
```bash
python -m gograph.backend.app.services.model_service
```

---

## 10. Métricas Geradas

### 10.1 Atribuição por Canal

| Métrica | Descrição |
|---|---|
| `markov_weight` | % do crédito total atribuído pelo modelo Markov |
| `shapley_weight` | % do crédito pelo modelo Shapley Values |
| `pfc_weight` | % do crédito pelo modelo PFC |
| `removal_effect` | Queda em P(Conversão) ao remover o canal (bruto) |
| `markov_revenue` | Receita total × markov_weight |
| `shapley_revenue` | Receita total × shapley_weight |
| `markov_shapley_delta_pp` | Diferença em pp entre Markov e Shapley |

### 10.2 ROAS

| Métrica | Descrição |
|---|---|
| `roas_markov` | markov_revenue / spend |
| `roas_shapley` | shapley_revenue / spend |
| `roas_first_click` | Receita do primeiro toque / spend |
| `roas_last_click` | Receita do último toque / spend |
| `invest_pct` | % do spend total que este canal representa |

### 10.3 Diagnóstico de Canal

| Métrica | Descrição |
|---|---|
| `presence_converting` | % das jornadas conversoras em que o canal aparece |
| `presence_nonconverting` | % das jornadas não-conversoras em que o canal aparece |
| `first_touch_share` | % dos toques que são primeiro toque |
| `middle_touch_share` | % dos toques que são meio de jornada |
| `last_touch_share` | % dos toques que são último toque |
| `low_intent_drag_score` | peso_low_intent / peso_total do canal no Funnel Markov |
| `channel_role` | Iniciador / Finalizador / Assistente / Amplificador CRM |

### 10.4 Papel do Canal (channel_role)

| Papel | Critério de Classificação |
|---|---|
| **Iniciador** | `first_touch_share` dominante em jornadas conversoras |
| **Finalizador** | `last_touch_share` dominante |
| **Assistente** | Alta presença em meio de jornada sem ser primeiro ou último |
| **Amplificador CRM** | Canal CRM com alta presença + lift de conversão elevado |

---

## 11. Estrutura de Código

```
markov/
├── config.py                          # Parâmetros globais (via .env)
├── extract.py                         # SQL e extração de dados (Metabase API)
├── gograph/
│   ├── backend/
│   │   └── app/
│   │       ├── main.py               # Entry point FastAPI
│   │       ├── api/
│   │       │   └── model_runs.py     # Rotas REST /api/model-runs
│   │       ├── core/
│   │       │   └── event_mapping.py  # Mapeamento de eventos → estágio de funil
│   │       ├── db/
│   │       │   └── models.py         # Modelos SQLAlchemy (SQLite)
│   │       ├── schemas/
│   │       │   └── model_run.py      # Pydantic schemas de request/response
│   │       └── services/
│   │           ├── model_service.py          # Orquestrador principal
│   │           ├── extraction_service.py     # Wraps extract.py
│   │           ├── attribution_service.py    # Markov + Shapley
│   │           ├── pfc_service.py            # PFC Attribution
│   │           ├── funnel_markov_service.py  # Funnel Stage Markov
│   │           ├── roas_service.py           # ROAS + diagnósticos
│   │           ├── loop_service.py           # Diagnóstico de loops
│   │           ├── sequential_service.py     # Sequential Effects
│   │           ├── path_service.py           # Top paths (Path Intelligence)
│   │           ├── insight_service.py        # Alertas automáticos
│   │           ├── sandbox_service.py        # Simulação de jornadas
│   │           ├── journey_graph_service.py  # Dados do grafo interativo
│   │           └── persistence_service.py    # Salvar/ler model runs
│   └── frontend/
│       └── src/
│           ├── App.tsx               # Componente raiz + roteamento de abas
│           ├── api.ts                # Cliente HTTP (fetch → FastAPI)
│           ├── SandboxView.tsx       # Sandbox visual de jornadas
│           ├── ConversionView.tsx    # Aba Oportunidades
│           └── SessionQualityView.tsx# Aba Qualidade de Sessão
├── tests/
│   ├── test_model_service.py         # Testes de integração do pipeline
│   └── test_persistence_service.py   # Testes de persistência SQLite
└── PROJETO.md                        # Documentação de produto (GoGraph)
```

---

## 12. Limitações Conhecidas

| Limitação | Impacto | Mitigação |
|---|---|---|
| **Identidade por cookie** | Não funciona entre dispositivos ou após limpeza de cache | Inerente à arquitetura Plausible; aceito como trade-off de privacidade |
| **Meta Ads não segmentado** | Sem split FB vs. IG no spend; todo Meta é agrupado | O modelo distingue `Organic Social / Instagram` e `Organic Social / Facebook`; spend segmentado é item de backlog |
| **Email spend estimado** | Custo fixo de R$ 145k/mês (não vem de dado real por envio) | Marcado como estimativa na UI; ROAS de Email deve ser lido com ressalva |
| **TikTok spend estimado** | R$ 30k/mês prorated (sem API de spend TikTok) | Idem |
| **Variância em canais raros** | Amostragem de 1% de não-conversores pode subrepresentar canais pequenos | Aumentar `NON_CONV_SAMPLE_PCT` reduz variância ao custo de queries mais lentas |
| **Funnel model requer eventos** | Se o Plausible não registrar eventos customizados, cai para Raw Markov | Requer configuração correta do Plausible no site |
| **purchases_dedup_lm_v2** | Se a pipeline Airflow falhar, a tabela fica vazia e o modelo falha com erro explícito | Monitoramento de Airflow é pré-requisito operacional |

---

*Documento gerado em junho de 2026 — GoCase Analytics / Time de Growth*
