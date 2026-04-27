# /import-contracts — Importação de contratos via IA

Extrai campos de contratos de dívida a partir de PDFs e gera `contracts_extracted.json` pronto para importar no dashboard.

## Pré-requisitos (primeira vez)

```bash
pip install openai pypdf
```

Variável de ambiente obrigatória (adicione ao seu shell ou `.env` local):

```bash
export OPENAI_API_KEY="sk-..."
```

Opcional — sobrescreve o modelo (padrão: `gpt-4.1-mini`):

```bash
export OPENAI_MODEL="gpt-4.1-mini"
```

## Como executar

Quando o usuário invocar `/import-contracts`, os argumentos são os caminhos dos PDFs. Execute:

```
python .claude/skills/import-contracts/extract.py <args>
```

Exemplo: `/import-contracts contratos/itau_jan.pdf contratos/bradesco_fev.pdf`
→ roda `python .claude/skills/import-contracts/extract.py contratos/itau_jan.pdf contratos/bradesco_fev.pdf`

## O que fazer após rodar o script

1. Leia o relatório de confiança impresso no terminal
2. Avise o usuário sobre campos com confiança **low** — esses precisam de revisão manual
3. Informe que `contracts_extracted.json` foi salvo na raiz do projeto
4. Se o usuário quiser revisar o JSON, leia e exiba os contratos extraídos de forma legível

## Limitações que o usuário deve saber

- PDFs baseados em **imagem/scan** não funcionam — o texto não é extraível via `pypdf`
- Campos com confiança `low` foram inferidos ou estão ausentes no documento
- `calculation_table` (SAC vs PRICE) raramente está explícito — revisar sempre
