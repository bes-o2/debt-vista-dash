#!/usr/bin/env python3
"""
Extrai campos de contratos de dívida a partir de PDFs usando OpenAI.

Uso:
    python extract.py contrato1.pdf [contrato2.pdf ...]

Saída:
    contracts_extracted.json  — array de DebtInput + scores de confiança brutos
    Relatório impresso no terminal

Variáveis de ambiente:
    OPENAI_API_KEY   — obrigatório
    OPENAI_MODEL     — opcional, padrão: gpt-4.1-mini
"""

import sys
import json
import os
import io
from pathlib import Path

# Força UTF-8 no stdout/stderr (necessário no Windows com terminais cp1252)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    from openai import OpenAI
    import pypdf
except ImportError:
    print("Dependências ausentes. Instale:")
    print("  pip install openai pypdf")
    sys.exit(1)


_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "contracts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "bank":                     {"type": "string"},
                    "title":                    {"type": "string"},
                    "contract_number":          {"type": "string"},
                    "financed_amount_brl":      {"type": "number"},
                    "first_due_date":           {"type": "string"},
                    "last_due_date":            {"type": "string"},
                    "calculation_table":        {"type": "string", "enum": ["SAC", "PRICE"]},
                    "interest_base":            {"type": "string"},
                    "interest_rate_annual_pct": {"type": "number"},
                    "spread_rate_annual_pct":   {"type": ["number", "null"]},
                    "iof_total_brl":            {"type": ["number", "null"]},
                    "tac_brl":                  {"type": ["number", "null"]},
                    "confidence": {
                        "type": "object",
                        "properties": {
                            "bank":              {"type": "string", "enum": ["high", "medium", "low"]},
                            "financed_amount":   {"type": "string", "enum": ["high", "medium", "low"]},
                            "dates":             {"type": "string", "enum": ["high", "medium", "low"]},
                            "calculation_table": {"type": "string", "enum": ["high", "medium", "low"]},
                            "interest_rate":     {"type": "string", "enum": ["high", "medium", "low"]},
                            "indexer":           {"type": "string", "enum": ["high", "medium", "low"]},
                            "fees":              {"type": "string", "enum": ["high", "medium", "low"]},
                        },
                        "required": ["bank", "financed_amount", "dates", "calculation_table", "interest_rate", "indexer", "fees"],
                        "additionalProperties": False,
                    },
                    "notes": {"type": "string"},
                },
                "required": [
                    "bank", "title", "contract_number",
                    "financed_amount_brl", "first_due_date", "last_due_date",
                    "calculation_table", "interest_base",
                    "interest_rate_annual_pct", "spread_rate_annual_pct",
                    "iof_total_brl", "tac_brl",
                    "confidence", "notes",
                ],
                "additionalProperties": False,
            }
        }
    },
    "required": ["contracts"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = """Você é um especialista em análise de contratos de crédito corporativo brasileiro.
Extraia as informações financeiras dos contratos fornecidos com precisão.

Regras de extração:
- calculation_table: "SAC" se amortização constante/parcelas decrescentes, "PRICE" se parcelas iguais. \
Se não explícito, infira pelo comportamento das parcelas ou use "PRICE".
- interest_base: indexador principal (CDI, SELIC, IPCA, PRE, TJLP, TR). Se taxa fixa, use "PRE".
- Para pós-fixado (ex: CDI + 2% a.a.): interest_base="CDI", spread_rate_annual_pct=2.0, interest_rate_annual_pct=0.
- Para pré-fixado (ex: 14,5% a.a.): interest_base="PRE", interest_rate_annual_pct=14.5, spread_rate_annual_pct=null.
- Valores monetários em reais (float), não em centavos.
- first_due_date: data da PRIMEIRA parcela (formato YYYY-MM-DD).
- last_due_date: data do ÚLTIMO vencimento (formato YYYY-MM-DD).
- Confidence: "high"=dado explícito, "medium"=inferido com alta certeza, "low"=ausente ou ambíguo.
- notes: liste APENAS campos inferidos ou ausentes/ambíguos. String vazia se tudo estiver claro."""


def _extract_text(pdf_path: str) -> str:
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n--- PÁGINA ---\n\n".join(pages)


def _to_debt_input(c: dict) -> dict:
    return {
        "bank":             c.get("bank"),
        "title":            c.get("title"),
        "description":      c.get("contract_number"),
        "financed_amount":  int(round(c["financed_amount_brl"] * 100)),
        "first_due_date":   c["first_due_date"],
        "last_due_date":    c["last_due_date"],
        "calculation_table": c["calculation_table"],
        "interest_base":    c["interest_base"],
        "interest_rate":    round(c["interest_rate_annual_pct"] / 100, 6),
        "interest_type":    "annual",
        "spread_rate":      round(c["spread_rate_annual_pct"] / 100, 6) if c.get("spread_rate_annual_pct") else None,
        "iof_rate":         int(round(c["iof_total_brl"] * 100)) if c.get("iof_total_brl") else None,
        "additional_fees":  int(round(c["tac_brl"] * 100)) if c.get("tac_brl") else None,
    }


def _print_report(contracts: list[dict]):
    icons = {"high": "✅", "medium": "⚠️ ", "low": "❌"}
    print(f"\n{'='*62}")
    print(f"  RELATÓRIO DE EXTRAÇÃO — {len(contracts)} contrato(s)")
    print(f"{'='*62}\n")

    for i, c in enumerate(contracts, 1):
        conf = c.get("confidence", {})
        print(f"Contrato {i}: {c.get('bank', '?')} — {c.get('contract_number') or 'sem nº'}")

        def row(label, value, key):
            icon = icons.get(conf.get(key, "low"), "?")
            print(f"  {label:<16} {str(value):<28} {icon} {conf.get(key, '?')}")

        row("Valor:",      f"R$ {c.get('financed_amount_brl', 0):>16,.2f}", "financed_amount")
        row("1ª parcela:", c.get("first_due_date", "?"), "dates")
        row("Vencimento:", c.get("last_due_date", "?"),  "dates")
        row("Tabela:",     c.get("calculation_table", "?"), "calculation_table")
        row("Indexador:",  c.get("interest_base", "?"), "indexer")
        row("Taxa juros:", f"{c.get('interest_rate_annual_pct', '?')}% a.a.", "interest_rate")

        if c.get("spread_rate_annual_pct"):
            print(f"  {'Spread:':<16} {c['spread_rate_annual_pct']}% a.a.")

        iof = c.get("iof_total_brl")
        tac = c.get("tac_brl")
        if iof or tac:
            row("IOF/TAC:", f"IOF R${iof or 0:,.0f} | TAC R${tac or 0:,.0f}", "fees")

        if c.get("notes"):
            print(f"  ⚠️  Notas: {c['notes']}")
        print()


def run(pdf_paths: list[str], model: str):
    client = OpenAI()

    content_parts = []
    for path in pdf_paths:
        text = _extract_text(path)
        name = Path(path).name
        if not text.strip():
            print(f"⚠️  {name}: PDF baseado em imagem — texto não extraível. Ignorando.")
            continue
        content_parts.append(f"=== ARQUIVO: {name} ===\n\n{text}")
        print(f"✓  {name}: {len(text):,} chars extraídos")

    if not content_parts:
        print("\nNenhum texto extraído. Verifique se os PDFs são digitais (não escaneados).")
        sys.exit(1)

    combined = "\n\n".join(content_parts)
    if len(combined) > 120_000:
        print(f"⚠️  Texto truncado ({len(combined):,} → 120.000 chars).")
        combined = combined[:120_000]

    print(f"\nEnviando para {model}...")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": combined},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "debt_contracts",
                "strict": True,
                "schema": _EXTRACTION_SCHEMA,
            },
        },
    )

    contracts = json.loads(response.choices[0].message.content)["contracts"]
    _print_report(contracts)

    out = {"contracts": [_to_debt_input(c) for c in contracts], "_raw": contracts}
    Path("contracts_extracted.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    u = response.usage
    print(f"✅ {len(contracts)} contrato(s) salvo(s) em: contracts_extracted.json")
    print(f"   Tokens: {u.prompt_tokens} in / {u.completion_tokens} out\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    pdf_paths = sys.argv[1:]
    missing = [p for p in pdf_paths if not Path(p).exists()]
    if missing:
        for p in missing:
            print(f"❌ Arquivo não encontrado: {p}")
        sys.exit(1)

    run(pdf_paths, os.getenv("OPENAI_MODEL", "gpt-4.1-mini"))


if __name__ == "__main__":
    main()
