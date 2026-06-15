# GoGraph — Sistema de Atribuição Multi-Touch da GoCase

## O que é

O GoGraph é o sistema de atribuição de marketing da GoCase. Ele responde à pergunta central do time de mídia: **qual canal realmente gerou a venda?**

A abordagem padrão da indústria — Last Click — atribui 100% do crédito ao último canal tocado antes da compra. Isso distorce completamente o valor de canais que preparam o cliente (topo de funil) e de canais de reengajamento (CRM). O GoGraph substitui isso com modelos probabilísticos que dividem o crédito de forma justa entre todos os pontos de contato.

---

## Arquitetura de Dados

### Fontes

| Fonte | Banco | Uso |
|---|---|---|
| `plausible_events_db.sessions_v2` | ClickHouse (DB 70) | Sessões com UTM, duração, pageviews, bounce |
| `analytics.purchases_dedup_lm_v2` | ClickHouse (DB 70) | Compras deduplificadas com `user_pseudo_id` |
| `raw.gogroup_google_ads` | PostgreSQL (DB 63) | Investimento Google por tipo de campanha |
| `raw.gogroup_meta_segments_clientes` | PostgreSQL (DB 63) | Investimento Meta (Facebook/Instagram) |
| `raw.insider_journey_channels` | PostgreSQL (DB 63) | Envios SMS e WhatsApp via Insider |

### Identidade do Usuário

O sistema usa `user_pseudo_id` (cookie Plausible) como identificador cross-sessão. Cada sessão em `sessions_v2` carrega este ID em `entry_meta.value`. Compras em `purchases_dedup_lm_v2` também usam este campo, permitindo juntar a jornada completa do usuário até a conversão.

### Janela de Análise e Lookback

- **Janela de análise**: período de datas configurável (`START_DATE` / `END_DATE`)
- **Lookback**: quantos dias antes da compra considerar para a jornada (padrão: 60 dias). Uma compra em março pode ter sessões de janeiro incluídas.

---

## Classificação de Canais

Cada sessão é classificada em um dos **19 estados Markov** via `utm_medium + utm_source + utm_campaign`, com fallback para `acquisition_channel`:

| Estado | Critério |
|---|---|
| Paid Meta Ads | `utm_medium` = paid_social/paid + source = facebook/instagram/etc. |
| TikTok Ads | `utm_medium` = paid_social + source = tiktok |
| Google Ads / Search | `utm_medium` = cpc + source = google + campanha com prefixo `_s_` |
| Google Ads / Search / Inst | Igual, mas campanha contém "inst" (campanha institucional) |
| Google Ads / Shopping | Campanha com prefixo `shopping-` |
| Google Ads / Shopping / Inst | Shopping + "inst" |
| Google Ads / PMax | Campanha com prefixo `pmax-` |
| Google Ads / Other | CPC Google não classificado acima |
| Display / Retargeting | Criteo / RTBHouse |
| Email | Klarna, newsletters, automações de e-mail |
| WhatsApp CRM | Automações WhatsApp via Insider |
| SMS | Automações SMS via Insider |
| Organic Social / Instagram | Tráfego orgânico Instagram |
| Organic Social / Facebook | Tráfego orgânico Facebook |
| Organic Search | `acquisition_channel` = Organic Search |
| Direct | `acquisition_channel` = Direct |
| Clube GoCase | `utm_medium` = clube_gocase |
| Referral | Afiliados e parcerias |
| Other | Tudo que não se encaixa |

Além desses 19, o modelo tem 3 estados especiais: `(start)`, `Conversion` e `Non-Conversion`.

---

## Modelos de Atribuição

### 1. Markov Chain (Remoção de Efeito)

**O que é**: Modelo probabilístico baseado em cadeias de Markov de primeira ordem.

**Como funciona**:
1. Todas as jornadas de usuários (sessões ordenadas por tempo) são convertidas em **transições**: pares `(canal_A → canal_B)`.
2. Uma **matriz de transição** é construída: `P(ir para B | estou em A)`.
3. O modelo calcula `P(Conversão | start)` — a probabilidade de conversão partindo do início.
4. Para cada canal, calcula o **Removal Effect**: *"quanto cai a taxa de conversão se eu remover este canal completamente do grafo?"*
5. O `removal_effect` é normalizado entre todos os canais para dar o **peso Markov** (soma = 100%).

**Por que é robusto**: Captura canais que funcionam como "ponte" na jornada — mesmo que não sejam o último toque, sua remoção interrompe o caminho até a conversão.

**Decay temporal**: Cada transição pode receber um peso `exp(-λ × dias_antes_da_conversão)`. Com `λ = 0.05`, uma sessão 14 dias antes vale ~50% de uma sessão no dia da compra.

**Amostragem de não-conversores**: Apenas 1% dos usuários que não compraram são amostrados (aleatório por `cityHash64`) para equilibrar o volume com conversores.

### 2. Shapley Values

**O que é**: Conceito da teoria dos jogos que distribui "crédito" de forma matematicamente justa.

**Como funciona**:
1. Para cada subconjunto possível de canais, calcula `P(Conversão | subconjunto)`.
2. O valor Shapley de um canal é sua contribuição marginal média, calculada sobre todas as ordens possíveis de coalização.
3. Implementado via Monte Carlo: `N` permutações aleatórias dos canais (padrão: 5.000).

**Diferença do Markov**: Shapley considera contribuições conjuntas entre canais, não apenas caminhos individuais. Em geral produz distribuições mais "suaves" que o Markov.

### 3. PFC — Position-Frequency-Causal

**O que é**: Modelo híbrido que combina posição na jornada com frequência de aparição e peso causal (Markov).

**Como funciona**:
1. Para cada path que converte, classifica cada toque como `first`, `middle` ou `last`.
2. Calcula frequências relativas de cada canal em cada posição.
3. Pondera pela probabilidade de conversão do path e pelo peso Markov do canal.
4. O resultado é uma atribuição que considera **onde** na jornada o canal aparece.

**Uso**: Complementa Markov e Shapley. O `pfc_delta_pp` mostra quantos pontos percentuais o PFC difere do Markov — canais com delta positivo grande são "sub-valorizados" pelo Markov por aparecerem muito em meio de jornada.

### 4. Funnel Stage Markov (Modelo Primário)

**O que é**: Extensão do Markov onde cada estado é um par `(canal, estágio_de_funil)`.

**Estágios de funil** (definidos por eventos do Plausible):
| Estágio | Eventos |
|---|---|
| Low Intent | Sessão sem evento relevante |
| Product Interest | Visualização de produto, busca |
| Cart Intent | Adição ao carrinho, wishlist |
| Checkout | Início de checkout |
| Purchase | Compra efetivada |

**Como funciona**: Em vez de `Paid Meta Ads → Email → Conversion`, o modelo vê `Paid Meta Ads / Low Intent → Email / Cart Intent → Conversion`. Isso distingue, por exemplo, um clique em Meta que gerou interesse de produto de um que apenas saltou.

**Por que é o modelo primário**: Elimina o "Low Intent Drag" — o fenômeno onde canais com muitas sessões de baixa qualidade recebem crédito inflacionado pelo Markov puro. O `low_intent_drag_score` mede isso: `peso_low_intent / peso_total_do_canal`.

---

## Métricas Principais

### Atribuição

| Métrica | Descrição |
|---|---|
| `markov_weight` | % do crédito atribuído pelo modelo Markov (removal effect normalizado) |
| `shapley_weight` | % do crédito pelo modelo Shapley values |
| `pfc_weight` | % do crédito pelo modelo PFC |
| `removal_effect` | Quanto cai a P(Conversão) ao remover o canal (bruto, não normalizado) |
| `markov_revenue` | Receita total × markov_weight |
| `shapley_revenue` | Receita total × shapley_weight |

### ROAS

| Métrica | Descrição |
|---|---|
| `roas_markov` | markov_revenue / spend |
| `roas_shapley` | shapley_revenue / spend |
| `roas_first_click` | Receita atribuída ao primeiro canal da jornada / spend |
| `roas_last_click` | Receita atribuída ao último canal / spend |
| `invest_pct` | % do spend total que este canal representa |

### Diagnóstico

| Métrica | Descrição |
|---|---|
| `presence_converting` | % das jornadas conversoras em que o canal aparece |
| `presence_nonconverting` | % das jornadas não-conversoras em que o canal aparece |
| `first_touch_share` | % dos toques deste canal que são primeiro toque |
| `middle_touch_share` | % dos toques que são meio de jornada |
| `last_touch_share` | % dos toques que são último toque (fechamento) |
| `markov_shapley_delta_pp` | Diferença em pontos percentuais entre Markov e Shapley |

### Papel do Canal (channel_role)

| Papel | Critério |
|---|---|
| **Iniciador** | first_touch_share > 50% das jornadas conversoras |
| **Finalizador** | last_touch_share dominante |
| **Assistente** | Aparece muito no meio sem ser primeiro ou último |
| **Amplificador CRM** | Canal CRM com alta presença e lift de conversão |

---

## Conceitos-Chave

### Lift de Conversão

`Lift = taxa_de_conversão_do_path / taxa_base_do_modelo`

Um path com lift = 2.5 converte 2.5× mais que a média do modelo. Usado em:
- **Top 15 Lift** (aba Oportunidades): paths ordenados por lift, coloridos por presença de CRM
- **Score CRM**: `lift × √(cobertura%)` — favorece canais com lift alto E volume relevante

### Jornada de Conversão

Sequência ordenada de sessões de um mesmo `user_pseudo_id` até a compra, dentro do lookback. Exemplo:
```
(start) → Paid Meta Ads → Organic Search → Email → WhatsApp CRM → Conversion
```

### Right-Censorship

Usuários cuja última sessão é muito recente (dentro de `CENSORSHIP_DAYS` do fim da janela) são excluídos do modelo de não-conversão — pois ainda podem comprar. Valor 0 = desligado.

### Auto-calibração do NON_CONV_SCALE

O modelo amostra apenas 1% dos não-conversores. O `NON_CONV_SCALE` ajusta o peso dessas transições para que `P(Conversão | start)` do modelo bata com a taxa de conversão observada (`n_compradores / n_total_usuários`). Isso garante que a atribuição reflita a realidade econômica.

---

## Visualizações — Guia por Aba

### Overview

KPIs do model run: receita total, spend, modelo de conversão, taxa observada. Gráfico de barras com top 8 canais por Markov e ROAS lado a lado.

### Canais

Tabela com atribuição completa por canal:
- **Colunas**: Markov %, Shapley %, PFC %, Invest. %, Spend, ROAS (Markov/Shapley/First/Last Click)
- **Gráfico de barras**: top 8 canais Markov vs Shapley
- **Raw vs Funnel**: toggle para comparar o modelo puro (Raw) com o Funnel Stage

### Grafo

Visualização interativa do grafo de transições entre estados. Nós = canais, arestas = probabilidade de transição. Espessura da aresta = volume de transições.

### Insights

Alertas automáticos gerados pelo sistema: anomalias de ROAS, canais com remoção de efeito acima do esperado, problemas de dados.

### Pontos de Contato (Touchpoints)

Por canal: distribuição de posição (1º toque / meio / último) para jornadas conversoras e não-conversoras. Pills coloridas mostram a proporção visualmente.

### Papel do Canal (Diagnósticos)

Para cada canal: `RoleBadge` (papel) + mini-barra de posição + presença em conversoras vs não-conversoras + delta Markov-Shapley. Canais onde Markov >> Shapley são provavelmente "pivôs" de jornada; onde Shapley >> Markov são canais de valor marginal alto por coalizão.

### Qualidade de Dados

Checklist automático: cobertura de compras, volume de transições, consistência de spend, taxa de conversão vs baseline esperado.

### Caminhos (Path Intelligence)

Top 500 paths de jornada, com taxa de conversão, receita e probabilidade histórica. Base para o Sandbox.

### Diagnósticos do Modelo

- **Loop Diagnostics**: canais com auto-loop (usuário volta ao mesmo canal), taxa de conversão dentro vs fora de loops
- **Funnel Stage Attribution**: peso Markov por canal × estágio de funil. Revela o `low_intent_drag_score`
- **Funnel Validation**: para cada canal, % do peso que vem de sessões de baixa intenção vs intenção qualificada
- **Sequential Effects (Ordem-2)**: `P(Conversão | canal_anterior, canal_atual)` — pares de canais com lift elevado

### Oportunidades (ConversionView)

5 análises focadas em "vender" o projeto internamente:

1. **Simulador de Impacto**: slider de aumento na taxa de conversão → calcula receita incremental
2. **Last Click vs Multi-Touch**: gráfico horizontal mostrando diferença de atribuição entre modelos
3. **Top 15 Lift de Conversão**: paths com maior lift, coloridos por presença de CRM
4. **Efeito do CRM por Posição**: para cada canal CRM (Email, WhatsApp, SMS), lift quando aparece em 1º / meio / último toque
5. **Score de Oportunidade CRM**: ranking de canais CRM por `score = lift × √(cobertura%)` — prioriza canais com impacto real

### Sessões (Session Quality)

Dados de engajamento das sessões por canal, independentemente do modelo de atribuição:

**Score de Engajamento** = `duração × pageviews × eventos × (1 − bounce_rate)`

**Mapa de Posicionamento (Scatter)**: Eixo X = duração média (escala log), Eixo Y = peso Markov. Quatro quadrantes:
- **Estrelas** (alta atribuição + alto engajamento): investir mais
- **Volume sem Qualidade** (alta atribuição + baixo engajamento): investigar UX ou landing pages
- **Potencial Oculto** (baixa atribuição + alto engajamento): possível subvalorização pelo modelo
- **Baixa Prioridade** (baixa atribuição + baixo engajamento): reduzir ou otimizar

**Duração Conv vs Não-Conv**: Canais onde conversores ficam muito mais tempo indicam que o canal atrai usuários com intenção de compra alta (seleção positiva).

### Sandbox

Editor visual de jornadas: adiciona canais como nós, conecta com arestas, analisa probabilidade de conversão e lift vs baseline. Permite salvar e comparar cenários.

---

## Pipeline de Execução

```
1. extract_transition_counts()
   ├── get_converting_transitions()   — jornadas de compradores
   └── get_nonconverting_transitions() — 1% de não-compradores

2. calibrate_nonconv_scale()           — ajusta NON_CONV_SCALE para bater taxa observada

3. build_transition_matrix()           — matriz P[from][to]

4. compute_markov_attribution()        — removal effect por canal

5. compute_shapley_attribution()       — Monte Carlo Shapley

6. compute_roas()                      — join com spend

7. compute_pfc_attribution()           — posição × frequência × causal

8. get_funnel_enriched_paths()         — paths com estágio de funil por sessão
   └── run_funnel_markov()             — Markov nos estados compostos

9. compute_loop_diagnostics()          — análise de auto-loops

10. compute_sequential_effects()       — bigrams de canais com lift

11. get_session_quality()              — métricas de sessão do Plausible

12. save_model_run()                   — persiste tudo no SQLite
```

---

## Configuração

Variáveis de ambiente (`.env`):

| Variável | Padrão | Descrição |
|---|---|---|
| `START_DATE` | 2026-03-01 | Início da janela de análise |
| `END_DATE` | 2026-03-31 | Fim da janela |
| `LOOKBACK_DAYS` | 60 | Dias de lookback para jornadas |
| `NON_CONV_SAMPLE_PCT` | 1 | % de não-conversores a amostrar |
| `NON_CONV_SCALE` | auto | Fator de escala (null = auto-calibração) |
| `DECAY_LAMBDA` | 0.05 | Decaimento temporal das transições |
| `SHAPLEY_SAMPLES` | 5000 | Amostras Monte Carlo para Shapley |
| `CENSORSHIP_DAYS` | 0 | Dias de right-censorship |
| `DB_PLAUSIBLE` | 70 | ID do banco ClickHouse no Metabase |
| `DB_DATAMART` | 63 | ID do banco PostgreSQL no Metabase |

---

## Limitações Conhecidas

- **Identidade**: Usa cookie (`user_pseudo_id`) — não funciona entre dispositivos diferentes ou após limpeza de cookies.
- **Meta spend**: Não há split FB vs IG no spend. Todo Meta Ads é agrupado em `Paid Meta Ads`.
- **Email spend**: Custo fixo estimado (R$145k/mês). Não vem de dados reais de custo por envio.
- **TikTok spend**: Custo estimado (R$30k/mês prorated).
- **Amostragem de não-conversores**: 1% pode introduzir variância em canais raros. Aumentar `NON_CONV_SAMPLE_PCT` reduz isso ao custo de mais tempo de query.
- **Funnel model**: Requer `events_v2` populado. Se o Plausible não estiver rastreando eventos customizados, cai para Raw Channel Markov.
- **purchases_dedup_lm_v2**: Se a tabela de compras estiver vazia (Airflow falhando), o modelo falha com erro explícito.
