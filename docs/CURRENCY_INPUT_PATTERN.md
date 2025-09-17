# Padrão de Input de Moeda Brasileira (BRL)

## Visão Geral
Este documento define o padrão a ser seguido em todo o projeto para inputs de valores monetários em Real brasileiro (BRL).

## Problema Resolvido
- **Salto do cursor**: Formatação durante digitação move o cursor para o final
- **UX ruim em mobile**: Teclado padrão em vez de numérico
- **Inconsistência**: Diferentes implementações de input de moeda no projeto

## Solução Padrão

### Hook: `useBRLInput`
Localização: `src/hooks/useBRLInput.tsx`

**Características:**
- ✅ Não formata durante a digitação (preserva cursor)
- ✅ Formata apenas ao sair do campo (onBlur)
- ✅ Teclado numérico em dispositivos móveis
- ✅ Validação automática de valores
- ✅ Conversão entre string formatada e valor numérico

### Componente: `CurrencyInput`
Localização: `src/components/ui/currency-input.tsx`

**Características:**
- ✅ Baseado no hook `useBRLInput`
- ✅ Símbolo R$ opcional (esquerda ou direita)
- ✅ Compatível com design system
- ✅ Props padrão pré-configuradas

## Como Usar

### Opção 1: Hook direto
```tsx
import { useBRLInput, BRL_INPUT_PROPS } from "@/hooks/useBRLInput";

const { value, numericValue, handleChange, handleBlur, formatCurrency } = useBRLInput();

<Input
  {...BRL_INPUT_PROPS}
  value={value}
  onChange={handleChange}
  onBlur={handleBlur}
/>
```

### Opção 2: Componente pronto
```tsx
import { CurrencyInput } from "@/components/ui/currency-input";

<CurrencyInput 
  value={amount}
  onValueChange={(formatted, numeric) => setAmount(formatted)}
  showCurrencySymbol={true}
  placeholder="Digite o valor"
/>
```

## Props Padrão (BRL_INPUT_PROPS)
```tsx
{
  type: "text",
  inputMode: "decimal",    // Teclado numérico em mobile
  pattern: "[0-9.,]*",     // Aceita apenas números, vírgulas e pontos
  autoComplete: "off",     // Evita sugestões do navegador
  placeholder: "0,00"      // Placeholder padrão brasileiro
}
```

## Exemplos de Implementação

### ✅ CORRETO - NetDebtCard
```tsx
// Usando o hook padrão
const { value: cashBalance, numericValue: cashValue, handleChange, handleBlur } = useBRLInput();

<Input
  {...BRL_INPUT_PROPS}
  value={cashBalance}
  onChange={handleChange}
  onBlur={handleBlur}
/>
```

### ❌ INCORRETO - Formatação durante digitação
```tsx
// Evitar: causa salto do cursor
const handleChange = (e) => {
  const formatted = formatCurrency(e.target.value); // ❌ Não fazer
  setValue(formatted);
};
```

## Casos de Uso no Projeto
- ✅ Saldo de caixa (NetDebtCard)
- ✅ Valores de empréstimos/financiamentos
- ✅ Taxas e valores em formulários
- ✅ Campos de valor em análises financeiras
- ✅ Qualquer input que aceite valores monetários em BRL

## Benefícios
1. **UX Consistente**: Mesmo comportamento em toda a aplicação
2. **Mobile-First**: Teclado numérico automático
3. **Sem Bugs**: Cursor não salta durante digitação
4. **Reutilizável**: Hook e componente prontos para usar
5. **Manutenível**: Lógica centralizada em um local

## Manutenção
- Qualquer melhoria deve ser feita no hook `useBRLInput`
- Novos inputs de moeda devem seguir este padrão
- Reportar bugs ou melhorias através de issues no projeto