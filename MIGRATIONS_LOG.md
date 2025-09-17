# 📋 LOG DE MIGRAÇÕES PENDENTES

**Projeto:** Análise de Endividamento  
**Supabase Project ID:** zujkmyfwfhjkixlymgiv  
**Última Atualização:** 2025-01-17  

---

## 🚨 MIGRAÇÕES PENDENTES

### **MIGRAÇÃO #1: Sistema de Taxas Econômicas**
**Data da Solicitação:** 2025-01-17  
**Status:** ❌ Pendente - Erro de autenticação no banco (`28P01: password authentication failed for user "postgres"`)  
**Prioridade:** 🔴 Alta  

**Descrição:**
Sistema para buscar, armazenar e gerenciar taxas econômicas (CDI, SELIC, IPCA) do Banco Central do Brasil, incluindo projeções manuais.

**SQL Necessário:**
```sql
-- Create table for storing economic indices history
CREATE TABLE public.economic_indices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL CHECK (index_type IN ('CDI', 'SELIC', 'IPCA')),
  date DATE NOT NULL,
  value DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, date)
);

-- Create table for storing manual projections
CREATE TABLE public.index_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL CHECK (index_type IN ('CDI', 'SELIC', 'IPCA')),
  year INTEGER NOT NULL,
  projected_value DECIMAL(10,6) NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, year)
);

-- Enable Row Level Security
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;

-- Create policies for economic_indices (public read, admin write)
CREATE POLICY "Economic indices are viewable by everyone" 
ON public.economic_indices 
FOR SELECT 
USING (true);

CREATE POLICY "Economic indices can be inserted by authenticated users" 
ON public.economic_indices 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Economic indices can be updated by authenticated users" 
ON public.economic_indices 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create policies for index_projections (user-specific)
CREATE POLICY "Users can view their own projections" 
ON public.index_projections 
FOR SELECT 
USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Users can create their own projections" 
ON public.index_projections 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own projections" 
ON public.index_projections 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own projections" 
ON public.index_projections 
FOR DELETE 
USING (created_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_economic_indices_type_date ON public.economic_indices(index_type, date DESC);
CREATE INDEX idx_index_projections_type_year ON public.index_projections(index_type, year);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_economic_indices_updated_at
BEFORE UPDATE ON public.economic_indices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_index_projections_updated_at
BEFORE UPDATE ON public.index_projections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

**Funcionalidades Dependentes:**
- ✅ Edge Function `fetch-bcb-rates` (criada - `supabase/functions/fetch-bcb-rates/index.ts`)
- ✅ Hook `useEconomicIndices` (criado com dados temporários - `src/hooks/useEconomicIndices.tsx`)
- ✅ Componente `SettingsButton` (criado - `src/components/SettingsButton.tsx`)
- ✅ Componente `SettingsModal` (criado - `src/components/SettingsModal.tsx`)
- ✅ Configuração supabase/config.toml atualizada

**Impacto Atual:**
- ✅ Sistema funciona com dados hardcodados temporários
- ✅ Interface está pronta e funcional
- ❌ Botão "Atualizar Taxas" mostra aviso sobre migração pendente
- ❌ Projeções não são salvas permanentemente
- ❌ Datas são calculadas dinamicamente mas não refletem dados reais do BCB

**APIs Integradas:**
- BCB SGS API para CDI (Série 12)
- BCB SGS API para SELIC (Série 11)  
- BCB SGS API para IPCA (Série 433)

---

## 📝 MIGRAÇÕES FUTURAS IDENTIFICADAS

### **MIGRAÇÃO #2: Persistência de Contratos (Planejada)**
**Prioridade:** 🟡 Média  
**Descrição:** Mover dados de contratos do localStorage para banco de dados

**Tabelas Necessárias:**
```sql
-- Tabela de contratos de dívidas
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bank TEXT NOT NULL,
  contract_number TEXT,
  financed_amount DECIMAL(15,2) NOT NULL,
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL CHECK (calculation_table IN ('SAC', 'PRICE')),
  indexer TEXT CHECK (indexer IN ('CDI', 'SELIC', 'IPCA', 'TR', 'IGP-M')),
  interest_rate DECIMAL(10,6) NOT NULL,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('monthly', 'annual')),
  iof_amount DECIMAL(15,2) DEFAULT 0,
  tac_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### **MIGRAÇÃO #3: Cache de Amortização (Planejada)**
**Prioridade:** 🟢 Baixa  
**Descrição:** Armazenar tabelas de amortização calculadas para performance

**Tabela Necessária:**
```sql
-- Cache de parcelas calculadas
CREATE TABLE public.debt_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  installment_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  amortization_amount DECIMAL(15,2) NOT NULL,
  remaining_balance DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(debt_id, installment_number)
);
```

---

## 🔧 AJUSTES NECESSÁRIOS PÓS-MIGRAÇÃO #1

Quando a MIGRAÇÃO #1 for executada, estes arquivos precisam ser atualizados:

### **1. `src/hooks/useEconomicIndices.tsx`**
**Linhas a modificar:** 35-43, 69-71, 128-135

**Mudanças:**
- Remover dados hardcodados temporários
- Habilitar queries reais do Supabase
- Ativar mutations para salvar projeções
- Remover avisos sobre migração pendente

### **2. `src/integrations/supabase/types.ts`**
**Status:** Será atualizado automaticamente pelo Supabase após migração

---

## 🐛 PROBLEMAS IDENTIFICADOS

### **Erro de Autenticação do Banco**
**Erro:** `FATAL: 28P01: password authentication failed for user "postgres"`  
**Causa Provável:** 
- Senha do banco foi alterada/resetada
- Configurações de autenticação corrompidas
- Problema temporário no Supabase

**Soluções Sugeridas:**
1. Reset da senha do banco em Settings > Database
2. Verificar status do projeto no dashboard
3. Aguardar resolução de problemas temporários do Supabase

**Permissões Necessárias:**
- Owner ou Admin no projeto Supabase
- Acesso ao SQL Editor
- Permissões para executar migrações

---

## 📊 STATUS GERAL

**Total de Migrações:** 3  
**Pendentes:** 1 (bloqueada por permissões)  
**Planejadas:** 2  
**Edge Functions Criadas:** 2  
**Componentes Prontos:** 4  

**Última Verificação:** 2025-01-17 14:30  
**Próxima Ação:** Aguardar resolução de permissões do usuário

---

## 📞 CONTATOS/LINKS ÚTEIS

- **Dashboard Supabase:** https://supabase.com/dashboard/project/zujkmyfwfhjkixlymgiv
- **SQL Editor:** https://supabase.com/dashboard/project/zujkmyfwfhjkixlymgiv/sql/new
- **Configurações DB:** https://supabase.com/dashboard/project/zujkmyfwfhjkixlymgiv/settings/database
- **Edge Functions:** https://supabase.com/dashboard/project/zujkmyfwfhjkixlymgiv/functions