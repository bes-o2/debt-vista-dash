# Garantias em Dívidas

## Resumo

Esta feature adiciona o cadastro de garantias vinculadas a uma dívida.
Cada dívida pode ter zero, uma ou várias garantias.

## Modelagem

Tabela nova: `public.debt_guarantees`

Campos principais:
- `id`
- `debt_id`
- `company_id`
- `type`
- `value`
- `description`
- `created_at`
- `updated_at`

Regras:
- `debt_id` referencia `public.debts(id)` com `ON DELETE CASCADE`
- `company_id` referencia `public.companies(id)` com `ON DELETE CASCADE`
- `type` aceita: `imovel`, `veiculo`, `equipamento`, `fianca`, `aval`, `recebiveis`, `outros`
- `value` deve ser maior ou igual a zero

## Persistência

Arquivos principais:
- `src/hooks/useDebtGuarantees.tsx`
- `src/hooks/useDebts.tsx`
- `src/components/DebtForm.tsx`
- `src/pages/Index.tsx`

Fluxo:
1. Cria ou atualiza a dívida.
2. Faz replace-all das garantias da dívida.
3. Remove linhas vazias antes de salvar.
4. Salva apenas garantias com `value > 0`.

Tratamento de erro:
- Se a dívida salvar e as garantias falharem, o fluxo retorna erro explícito.
- Em criação nova, o `draftDebtId` evita recriar a dívida em uma tentativa de retry.

## Formulário

No `DebtForm`:
- seção dinâmica `Garantias`
- botão `Adicionar`
- seleção de tipo por linha
- campo monetário de valor
- descrição extra apenas para `outros`
- remoção individual por linha

No modo de edição:
- o formulário carrega as garantias existentes pela dívida

No modo de criação:
- as garantias ficam somente em estado local até o salvamento

## Tipos Supabase

O arquivo `src/integrations/supabase/types.ts` foi atualizado para refletir:
- a nova tabela `debt_guarantees`
- a coluna `bank` em `debts`

## Validação manual recomendada

- criar dívida sem garantias
- criar dívida com uma garantia
- criar dívida com múltiplas garantias
- editar garantias existentes
- remover todas as garantias e salvar
- excluir dívida e confirmar remoção em cascata
