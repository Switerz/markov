# Markov + Shapley Multi-Touch Attribution

Pipeline Python para atribuição multitoque de canais de marketing usando:

- Cadeias de Markov com efeito de remoção.
- Shapley Values por Monte Carlo.
- ROAS por canal.
- Diagnóstico combinado para recomendações de budget.

O projeto lê jornadas de conversão e não conversão via Metabase, monta uma matriz
de transição com estados de canal e exporta um relatório Excel com atribuição,
ROAS, diagnóstico de presença e recomendações.

## Como Funciona

1. `extract.py` consulta o Metabase e extrai:
   - transições de jornadas convertidas;
   - transições de jornadas não convertidas;
   - taxa de conversão observada;
   - receita real;
   - spend de canais pagos.
2. `markov.py` monta a matriz de transição:
   - `(start)`;
   - canais como `Google Ads`, `Email`, `Direct`, `Organic Search`;
   - `Conversion`;
   - `Non-Conversion`.
3. O modelo Markov calcula o efeito de remoção por canal.
4. O modelo Shapley estima a contribuição marginal média por canal.
5. `roas.py` combina atribuição, spend, presença em jornadas e recomendação.
6. `run.py` gera um relatório para uma janela única.
7. `run_quarter.py` processa períodos maiores mês a mês e consolida o modelo.

## Instalação

Requer Python 3.10+.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

No PowerShell, configure as variáveis de ambiente:

```powershell
Copy-Item .env.example .env
notepad .env
```

Depois carregue as variáveis no terminal, ou use sua ferramenta preferida de
gerenciamento de ambiente.

Variáveis obrigatórias:

```text
METABASE_URL
METABASE_API_KEY
DB_PLAUSIBLE
DB_DATAMART
START_DATE
END_DATE
```

## Execução

Janela única:

```bash
python run.py
```

Período consolidado mês a mês:

```bash
python run_quarter.py
```

Os arquivos são gerados em `results/`.

## Outputs

O Excel final inclui:

- `Attribution & ROAS`: comparação Markov vs Shapley, spend, ROAS e recomendação.
- `Channel Diagnostics`: presença do canal em início, meio, fim e self-loops.
- `Shapley`: atribuição Shapley isolada.
- `Top Transitions`: transições convertidas mais frequentes.
- `Converting Transitions`: transições de conversão.
- `Non-Conv Transitions`: transições de não conversão.
- `Transition Matrix`: matriz Markov final.

## Leitura Das Recomendações

As recomendações combinam Markov, Shapley e presença:

- `Scale Up - Strong Consensus`: Markov e Shapley concordam.
- `Scale Up - Check Incrementality`: Markov alto, Shapley menor; pede teste.
- `Protect / Assist Channel`: Shapley valoriza o canal como assistente.
- `Scale Down - Weak Consensus`: baixo valor e baixo ROAS nos modelos.
- `Investigate High Presence Low Value`: canal aparece muito, mas gera pouco valor.
- `Non-Paid / Context Channel`: canal relevante, mas sem ação direta de budget.

## Segurança

Não publique credenciais reais. Use `.env` local e mantenha apenas
`.env.example` no repositório.

Se uma `METABASE_API_KEY` já foi commitada ou enviada ao GitHub, revogue e gere
uma nova chave antes de tornar o repositório público.

## Limitações Conhecidas

- A classificação de canais depende de `utm_medium`, `utm_source` e fallback de
  `acquisition_channel`.
- `utm_campaign` é ignorado por inconsistência de nomenclatura.
- Spend de Meta pode estar agregado em um único canal, dependendo da tabela de
  origem.
- `Direct` e `Other` são tratados como contexto/tracking, não como mídia
  acionável.
- O projeto ainda não inclui frontend, API ou histórico persistido dos modelos.
