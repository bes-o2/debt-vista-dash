# Mapeamento de Campos - Debt Vista Dash

## 🎯 Objetivo
Documentar a correspondência entre os 3 níveis de representação de dívidas no projeto.

---

## 📊 As 3 Interfaces de Dívida

### 1. **DATABASE (Supabase `debts` table)**
*Fonte: `src/hooks/useDebts.tsx` - interface `Debt`*
- Nomes em **snake_case** conforme schema SQL
- Fonte de verdade da persistência

| Campo DB | Tipo | Descrição |
|----------|------|-----------|
| `id` | UUID | Identificador único |
| `company_id` | UUID | Empresa dona da dívida |
| `created_by` | UUID | Usuário criador |
| `title` | TEXT | Nome/banco da dívida |
| `description` | TEXT | Número do contrato |
| `financed_amount` | NUMERIC | Valor financiado |
| `first_due_date` | DATE | Data do 1º vencimento |
| `last_due_date` | DATE | Data do último vencimento |
| `calculation_table` | TEXT | 'SAC' \| 'PRICE' |
| `interest_base` | TEXT | Indexador: 'CDI', 'SELIC', 'IPCA', 'Pré-fixado' |
| `interest_rate` | NUMERIC | Taxa nominal (% ao ano ou mês) |
| `interest_type` | TEXT | 'monthly' \| 'annual' |
| `spread_rate` | NUMERIC | Spread adicional (%) |
| `indexer_start_date` | DATE | Data inicial para indexação |
| `iof_rate` | NUMERIC | Taxa de IOF (%) |
| `additional_fees` | NUMERIC | TAC ou taxas adicionais |
| `cet_monthly_rate` | NUMERIC | CET calculado (% ao mês) |
| `cet_annual_rate` | NUMERIC | CET calculado (% ao ano) |

**⚠️ FALTANDO**: Coluna `bank` (será adicionada)

---

### 2. **LEGACY FORMAT (Frontend)**
*Fonte: `src/hooks/useDebts.tsx` - interface `LegacyDebt`*
- Nomes em **camelCase** para compatibilidade com código antigo
- Gerado por `convertToLegacyFormat(debt: Debt): LegacyDebt`
- Usado pelos componentes de gráficos (DebtChart, DebtProfile, etc)

| Campo Legacy | Database | Conversão | Descrição |
|--------------|----------|-----------|-----------|
| `id` | `id` | 1:1 | Identificador |
| `financedAmount` | `financed_amount` | 1:1 | Valor financiado |
| `releaseDate` | *calculado* | `first_due_date - 1 mês` | **Data de contração** |
| `dueDate` | `last_due_date` | 1:1 | Data final |
| `calculationTable` | `calculation_table` | 1:1 | SAC \| PRICE |
| `indexer` | `interest_base` | 1:1 | CDI \| SELIC \| IPCA \| Pré-fixado |
| `interestRate` | `interest_rate` | 1:1 | Taxa nominal |
| `interestType` | `interest_type` | 1:1 | monthly \| annual |
| `spread_rate` | `spread_rate` | 1:1 | Spread |
| `iofAmount` | `iof_rate` | 1:1 | IOF |
| `tacAmount` | `additional_fees` | 1:1 | TAC/taxas |
| `bank` | *falta no DB* | `title` | **Nome do banco** |
| `contractNumber` | `description` | 1:1 | Número contrato |
| `cet_monthly_rate` | `cet_monthly_rate` | 1:1 | CET mês |
| `cet_annual_rate` | `cet_annual_rate` | 1:1 | CET ano |

**⚠️ BUGS ENCONTRADOS**:
1. Linha 231 em `useDebts.tsx`: `bank: debt.title || 'Banco do Brasil'` ← Deveria ser coluna separada
2. `releaseDate` é **calculado** (não vem do DB), mas componentes esperam esse campo

---

### 3. **EDGE FUNCTION PARAMETER**
*Fonte: `supabase/functions/calculate-amortization/index.ts`*
- Nomes em **camelCase**
- Esperado pelo `calculate-amortization` function

| Param Edge Func | Legacy | DB | Descrição |
|-----------------|--------|----|----|
| `debtId` | `id` | `id` | ✅ |
| `financedAmount` | `financedAmount` | `financed_amount` | ✅ |
| `firstDueDate` | `releaseDate` | *calculado* | ⚠️ VER ABAIXO |
| `lastDueDate` | `dueDate` | `last_due_date` | ✅ |
| `calculationTable` | `calculationTable` | `calculation_table` | ✅ |
| `interestRate` | `interestRate` | `interest_rate` | ✅ |
| `interestType` | `interestType` | `interest_type` | ✅ |
| `indexer` | `indexer` | `interest_base` | ✅ |
| `spreadRate` | `spread_rate` | `spread_rate` | ✅ |
| `iofAmount` | `iofAmount` | `iof_rate` | ✅ |
| `tacAmount` | `tacAmount` | `additional_fees` | ✅ |
| `indexerStartDate` | *(não mapeado)* | `indexer_start_date` | ⚠️ FALTA |
| `reprogrammingRules` | *(não mapeado)* | `reprogramming_rules` | ⚠️ FALTA |

---

## 🔴 BUGS CRÍTICOS ENCONTRADOS

### Bug #1: firstDueDate da Edge Function
**Localização**: `useDebtInstallments.tsx:76`

```typescript
// ❌ ERRADO - Tenta acessar debt.first_due_date em um LegacyDebt
firstDueDate: debt.first_due_date,
```

**Problema**: 
- `debt` é `LegacyDebt` (camelCase)
- `LegacyDebt` não tem `first_due_date`, tem `releaseDate`
- Retorna `undefined`

**Solução**:
- A Edge Function espera `firstDueDate` = data de contração (não vencimento)
- `LegacyDebt.releaseDate` = data de contração ✅
- Usar `debt.releaseDate`

### Bug #2: Campo `bank` faltando no schema
**Localização**: `useDebts.tsx:231`

```typescript
bank: debt.title || 'Banco do Brasil',
```

**Problema**:
- `title` é um campo genérico, não deve guardar banco
- Dificulta filtros e análises por banco
- Gráficos usam `bank` para colorir e agrupar

**Solução**:
- Adicionar coluna `bank TEXT` à tabela `debts`
- Atualizar `convertToLegacyFormat` para mapear corretamente
- Atualizar forms para ter campo `bank` separado

### Bug #3: Campo `spread_rate` acesso inconsistente
**Localização**: `useDebtInstallments.tsx:82`

```typescript
// Interface local tem mix de camelCase + snake_case
interface Debt {
  spread_rate?: number;  // ❌ Deveria ser spreadRate
}

// Depois acessa assim:
spreadRate: debt.spread_rate || 0,  // ❌ Acessa snake_case em camelCase interface
```

**Solução**:
- Padronizar a interface local de `useDebtInstallments` para camelCase
- Ou importar e usar `LegacyDebt` em vez de definir local

---

## ✅ FIXES NECESSÁRIOS (em ordem)

1. **`useDebtInstallments.tsx` linha 76**: Trocar `debt.first_due_date` → `debt.releaseDate`
2. **`useDebtInstallments.tsx` interface**: Padronizar para camelCase ou usar `LegacyDebt`
3. **Schema Supabase**: Adicionar coluna `bank TEXT`
4. **`useDebts.tsx` convertToLegacyFormat**: Atualizar mapeamento de bank
5. **`DebtForm`**: Adicionar campo `bank` ao formulário

---

## 📝 Nota de Manutenção
Ao adicionar novos campos a `debts`:
1. Adicionar ao schema SQL (snake_case)
2. Atualizar interface `Debt` em `useDebts.tsx`
3. Atualizar `convertToLegacyFormat` para mapear (se necessário em camelCase)
4. Se usar em Edge Function, mapear no `body` do `invoke()`
