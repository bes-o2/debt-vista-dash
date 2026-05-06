# Modelo de Endividamento CFO — Regras Financeiras V2

> Documento de referência para implementar e revisar a lógica financeira do `debt-vista-dash`.
> Foco: funcionamento do modelo de dívida, cronograma, CET e tratamento de taxas pós-fixadas.
> Data: 2026-05-05.

---

## 1. Objetivo

Este documento define como o modelo de endividamento deve funcionar na aplicação. Ele não é uma explicação da planilha Excel original nem um mapa célula-a-célula. A planilha serviu como referência conceitual para convenções financeiras, mas a fonte operacional da aplicação deve ser o cronograma persistido em `debt_installments` e a auditoria de taxa por parcela em `debt_installment_rate_refs`.

O modelo deve responder, para cada contrato:

- quanto a empresa recebeu no início do financiamento;
- quanto deve em cada período;
- quanto amortiza de principal;
- quanto paga de juros/encargos;
- qual parcela total vence em cada data;
- qual taxa efetiva foi usada em cada parcela;
- qual é o CET anual e mensal do contrato;
- como o contrato entra nas métricas consolidadas do CFO.

O princípio central é simples: **o cronograma calculado e persistido é a verdade financeira do dashboard**. Cálculos analíticos no front devem ser fallback temporário, não uma segunda fonte de verdade.

---

## 2. Convenções fundamentais

### Sinais

| Conceito | Convenção |
|---|---|
| Valor financiado bruto | Positivo |
| Desembolso líquido ao tomador | Positivo |
| IOF/TAC/custos iniciais | Negativos quando entram no fluxo |
| Amortização | Positiva na base de dados da aplicação; pode aparecer negativa em visão de fluxo |
| Juros/encargos | Positivos como componente de parcela; negativos em visão de cashflow |
| Parcela total | Positiva como obrigação; negativa em cashflow do tomador |
| Cashflow inicial para CET | Positivo |
| Cashflows de parcelas para CET | Negativos |

Na UI, valores de saída podem ser exibidos entre parênteses, mas internamente a aplicação deve evitar misturar semântica contábil com semântica de fluxo. Persistir componentes como positivos facilita agregação; montar cashflow negativo apenas na rotina de CET.

### Saldo devedor

O saldo devedor por parcela deve representar o **saldo de abertura do período**, isto é, o saldo imediatamente antes do pagamento daquela parcela.

Regra:

```text
saldoAbertura[1] = valorFinanciado
saldoAbertura[n] = saldoAbertura[n-1] - amortizacao[n-1]
saldoFechamento[n] = saldoAbertura[n] - amortizacao[n]
```

Implicação para a UI:

- Para “saldo atual”, se existe próxima parcela futura, usar o saldo de abertura dessa próxima parcela.
- Para séries mensais históricas, decidir explicitamente se o ponto do mês representa saldo antes ou depois do pagamento. O padrão recomendado para CFO é **saldo de fechamento do mês**, porque conversa melhor com balanço e endividamento líquido.

### Arredondamento

O modelo deve calcular com precisão interna e arredondar na persistência/apresentação:

- valores monetários: 2 casas decimais;
- taxas percentuais auditáveis: 4 a 6 casas decimais;
- CET exibido: 2 casas percentuais;
- comparações de quitação: tolerância de `0,01`.

Não arredondar a taxa antes de calcular juros, salvo quando a taxa persistida for a própria fonte auditável de uma simulação já fechada.

---

## 3. Dados mínimos do contrato

| Campo | Uso financeiro |
|---|---|
| Banco / contrato | Identificação e agrupamento por credor. |
| Valor financiado | Principal bruto usado no saldo e na amortização. |
| Data de liberação | Data inicial do fluxo e início econômico do primeiro período. |
| Primeiro vencimento | Data da primeira parcela. |
| Último vencimento | Limite do cronograma. |
| Sistema de amortização | `SAC` ou `PRICE`. |
| Indexador | Define pré-fixado ou pós-fixado e qual série econômica resolve a taxa. |
| Taxa contratual fixa | Taxa nominal cadastrada para contratos pré-fixados, ou componente fixo quando aplicável. |
| Spread | Prêmio fixo sobre o indexador em contratos pós-fixados. |
| IOF | Custo inicial que reduz o desembolso líquido e entra no CET. |
| TAC | Custo inicial que reduz o desembolso líquido e entra no CET. |
| Empresa | Escopo para RLS, projeções e cenários temporários. |

Campos derivados:

```text
numeroParcelas = diferença mensal entre primeiroVencimento e ultimoVencimento + 1
dataLiberacaoModelo = primeiroVencimento - 1 mês
valorLiquido = valorFinanciado - IOF - TAC
```

O uso de `primeiroVencimento - 1 mês` como data de liberação derivada é uma aproximação operacional do código atual. Se o cadastro armazenar `release_date` real, essa data deve prevalecer para CET e primeiro período.

---

## 4. Períodos do cronograma

Cada parcela precisa de um período econômico:

```text
periodStart[1] = dataLiberacao
periodEnd[1] = primeiroVencimento
periodStart[n] = vencimento[n-1]
periodEnd[n] = vencimento[n]
```

Para contratos pré-fixados, esse período serve principalmente para vencimento e CET. Para pós-fixados, ele é essencial: é o intervalo usado para resolver CDI/SELIC/IPCA, projeção e auditoria da taxa.

Campos por parcela:

| Campo | Definição |
|---|---|
| `installment_number` | Sequência 1..N. |
| `period_start` | Início do período de incidência da taxa. |
| `period_end` / `due_date` | Fim do período e vencimento da parcela. |
| `principal_balance` | Saldo de abertura. |
| `amortization` | Principal pago na parcela. |
| `interest_amount` | Juros/encargos do período. |
| `installment_amount` | `amortization + interest_amount`. |
| `indexer_rate` | Taxa do indexador resolvida para o período. |
| `effective_rate` | Taxa efetiva total do período, já com spread. |

---

## 5. Contratos pré-fixados

Um contrato é pré-fixado quando o indexador é vazio, `Pré-fixado`, `PRE_FIXADO` ou equivalente. Nesse caso, o cronograma não consulta `economic_indices` nem `company_index_projections`.

### Taxa efetiva mensal

Se a taxa cadastrada é mensal:

```text
taxaMensal = taxaContratual / 100
```

Se a taxa cadastrada é anual:

```text
taxaMensal = (1 + taxaContratual / 100)^(1/12) - 1
```

Se houver spread cadastrado em pré-fixado, a regra atual soma taxa e spread antes da conversão:

```text
taxaEstatica = taxaContratual + spread
```

Ponto de decisão: essa regra só é financeiramente segura se taxa e spread estiverem na mesma base. O cadastro deve deixar explícito se `spread_rate` é mensal ou anual. Para contratos pós-fixados, a recomendação é tratar spread como anual e converter para mensal/periodal.

---

## 6. SAC

No SAC, a amortização é constante, exceto no último período por ajuste de saldo residual:

```text
amortizacaoFixa = valorFinanciado / numeroParcelas

para cada parcela:
  juros = saldoAbertura * taxaEfetivaPeriodo
  amortizacao = min(amortizacaoFixa, saldoAbertura)
  parcela = amortizacao + juros
  saldoFechamento = saldoAbertura - amortizacao
```

Características:

- parcela tende a cair ao longo do tempo em contratos de taxa estável;
- juros são sempre calculados sobre saldo de abertura;
- o principal amortizado não depende da taxa;
- em pós-fixado, a variação de CDI/SELIC/IPCA altera os juros e a parcela, mas não a amortização.

Para CFO, SAC é o sistema mais previsível em termos de redução de dívida, mas não necessariamente de parcela quando a taxa é variável.

---

## 7. PRICE

### PRICE pré-fixado

Em contrato PRICE pré-fixado, a parcela é constante:

```text
PMT = valorFinanciado * (taxaMensal * (1 + taxaMensal)^N) / ((1 + taxaMensal)^N - 1)

para cada parcela:
  juros = saldoAbertura * taxaMensal
  amortizacao = PMT - juros
  saldoFechamento = saldoAbertura - amortizacao
```

Se `taxaMensal = 0`:

```text
PMT = valorFinanciado / N
```

### PRICE pós-fixado

PRICE pós-fixado não deve ser tratado como “parcela constante”. Como a taxa muda por período, a aplicação deve recalcular a parcela usando o saldo de abertura, a taxa efetiva resolvida para aquele período e o prazo remanescente:

```text
nRestante = numeroParcelas - parcelaAtual + 1

PMT[parcelaAtual] =
  saldoAbertura * (taxaEfetiva * (1 + taxaEfetiva)^nRestante)
  / ((1 + taxaEfetiva)^nRestante - 1)

juros = saldoAbertura * taxaEfetiva
amortizacao = max(PMT - juros, 0)
```

Se a taxa efetiva for zero:

```text
PMT = saldoAbertura / nRestante
```

Isso é uma convenção de “re-PRICE”: a parcela é recalculada a cada período para quitar o saldo no prazo restante com a taxa atual/projetada. É a regra recomendada para o `debt-vista-dash`, porque evita uma falsa promessa de parcela fixa em contrato pós-fixado.

Na última parcela:

```text
amortizacao = saldoAbertura
parcela = amortizacao + juros
```

---

## 8. Modelo de taxas pós-fixadas

### Identificação

Um contrato é pós-fixado quando possui indexador econômico diferente de pré-fixado. Normalização recomendada:

| Entrada possível | Indexador canônico |
|---|---|
| `CDI`, `DI`, textos contendo `CDI` ou `DI` | `CDI` |
| textos contendo `SELIC` | `SELIC` |
| textos contendo `IPCA` | `IPCA` |

Qualquer indexador não mapeado deve falhar de forma explícita ou ser tratado como contrato com apenas spread, mas nunca silenciosamente como pré-fixado.

### Taxa efetiva do período

A taxa efetiva usada na parcela deve ser:

```text
taxaEfetivaPeriodo = taxaIndexadorPeriodo + spreadPeriodo
```

Onde:

- `taxaIndexadorPeriodo` vem do BCB, da projeção base ou de cenário temporário;
- `spreadPeriodo` é o spread convertido para a mesma periodicidade do período;
- o resultado é usado diretamente em `juros = saldoAbertura * taxaEfetivaPeriodo`.

O código atual converte spread anual para mensal assim:

```text
spreadMensal = (1 + spreadAnual / 100)^(1/12) - 1
taxaEfetivaMensalPercentual = taxaIndexadorMensalPercentual + spreadMensalPercentual
```

Recomendação: manter spread como taxa anual no cadastro e converter de forma explícita. Se o produto decidir aceitar spread mensal, criar campo/base separado; não inferir pela mesma coluna.

### Fontes de taxa

| Situação do período | Fonte | `source` auditável |
|---|---|---|
| Período totalmente realizado | `economic_indices` | `bcb_realizado` |
| Período futuro | `company_index_projections` | `projecao_base` |
| Período misto, cruza hoje | projeção base | `projecao_base` |
| Simulação temporária aplicada | override em memória | `cenario_temporario` |

Regra deliberadamente conservadora: período misto usa projeção base inteira. Uma alternativa mais precisa seria quebrar em trecho realizado + trecho projetado, mas isso aumenta complexidade e precisa de validação de produto.

---

## 9. CDI e SELIC

CDI e SELIC devem ser tratados como taxas diárias quando o período já tem histórico realizado.

Para um período `periodStart..periodEnd`, buscar os registros diários em `economic_indices`:

```text
taxaAcumulada = produto(1 + taxaDiaria[i] / 100) - 1
taxaIndexadorPeriodo = taxaAcumulada
```

Em percentual:

```text
indexerRatePercent = (produto(1 + dailyRatePercent[i] / 100) - 1) * 100
```

Se não houver registros no período:

```text
usar ultimo valor histórico disponível convertido para equivalente mensal
```

Esse fallback deve ser auditável, porque muda a natureza da taxa:

- ideal: `source = projecao_base` se usou projeção;
- aceitável em fallback técnico: manter `source_reference_date` do último dado e indicar no UI que foi usado último valor disponível.

Para projeções futuras de CDI/SELIC:

```text
taxaIndexadorPeriodo = company_index_projections.projected_rate
```

Premissa atual: `projected_rate` já está em equivalente mensal.

---

## 10. IPCA

IPCA é mensal. Para período realizado:

```text
mesReferencia = mês de periodStart
taxaIndexadorPeriodo = IPCA do mesReferencia
```

Se não houver IPCA para o mês:

```text
usar ultimo valor histórico disponível
```

Para período futuro:

```text
taxaIndexadorPeriodo = company_index_projections.projected_rate
```

Ponto de atenção: IPCA normalmente tem defasagem de divulgação. A aplicação deve ser clara sobre qual mês de referência foi usado e não assumir que o mês corrente já tem IPCA realizado.

---

## 11. Projeção base por empresa

A projeção base existe porque o CFO precisa ver parcelas futuras de contratos pós-fixados. Ela deve ser simples, auditável e específica por empresa:

```text
company_index_projections:
  company_id
  index_type
  projected_rate
  rate_type
  reference_date
  source_reference_date
  source
```

Regra V1:

- buscar o último valor real disponível no BCB;
- gravar esse valor como projeção base da empresa;
- usar o mesmo valor para parcelas futuras até que a projeção seja atualizada;
- não criar curva forward sofisticada sem demanda explícita.

Isso evita que o dashboard quebre quando há parcelas futuras e mantém rastreabilidade. A projeção não é uma previsão macroeconômica; é uma premissa operacional.

---

## 12. Cenários temporários

Cenários temporários servem para análise de sensibilidade sem alterar a base da empresa.

Modelo:

```text
override:
  indexType: CDI | SELIC | IPCA
  adjustmentPp: número em pontos percentuais
```

Aplicação:

```text
taxaIndexadorPeriodo = taxaIndexadorPeriodoBase + adjustmentPp
source = "cenario_temporario"
scenario_label = "Temporário"
```

O sistema deve permitir aplicar override:

- apenas para períodos futuros; ou
- para todos os períodos do recálculo/simulação.

A opção recomendada para uso executivo é aplicar apenas para futuro, porque histórico realizado não deve mudar. Para stress test puro, a UI pode oferecer modo “aplicar a todos os períodos”, mas precisa rotular claramente como simulação.

Não salvar cenários nomeados na V1. Salvar apenas a auditoria das parcelas geradas quando o usuário decide recalcular com aquele cenário, se essa for uma ação persistente.

---

## 13. Auditoria de taxa por parcela

Toda parcela pós-fixada deve ter uma linha em `debt_installment_rate_refs`.

Campos mínimos:

| Campo | O que prova |
|---|---|
| `company_id` | Empresa dona da premissa e da dívida. |
| `debt_id` | Contrato. |
| `installment_number` | Parcela auditada. |
| `index_type` | CDI, SELIC ou IPCA. |
| `period_start` | Início do período de taxa. |
| `period_end` | Fim do período de taxa. |
| `rate` | Taxa do indexador usada, antes do spread. |
| `rate_type` | `daily_accumulated`, `monthly` ou `projected`. |
| `source` | `bcb_realizado`, `projecao_base` ou `cenario_temporario`. |
| `scenario_label` | `Base` ou `Temporário`. |
| `source_reference_date` | Data do dado real/projeção que originou a taxa. |

Essa tabela é essencial para explicar ao CFO por que uma parcela mudou. Sem ela, o dashboard mostra números corretos, mas não auditáveis.

---

## 14. IOF, TAC e CET

IOF e TAC são custos iniciais do financiamento. Eles não devem aumentar automaticamente a parcela, salvo se o contrato explicitamente financiar esses custos no principal.

Regra padrão:

```text
valorLiquidoRecebido = valorFinanciado - IOF - TAC
```

Cronograma:

- amortização e juros calculam sobre `valorFinanciado`;
- IOF/TAC entram no fluxo inicial do CET;
- parcelas futuras não recebem IOF/TAC novamente.

Cashflows para CET:

```text
cashflow[0] = valorLiquidoRecebido
data[0] = dataLiberacao

para cada parcela:
  cashflow[n] = -installment_amount[n]
  data[n] = due_date[n]
```

CET anual:

```text
cetAnual = XIRR(cashflows, datas)
cetMensal = (1 + cetAnual)^(1/12) - 1
```

Na aplicação, a função de IRR deve ser única ou produzir resultado idêntico no front e na Edge Function. Preferência: calcular e persistir na Edge Function, e o front apenas exibir.

---

## 15. Fluxo recomendado de cálculo

```text
calcularContrato(debt):
  normalizar datas
  determinar numeroParcelas
  determinar se contrato é preFixado ou posFixado
  saldo = valorFinanciado
  cashflows = [{ data: releaseDate, valor: valorFinanciado - IOF - TAC }]

  para parcela i de 1 até numeroParcelas:
    periodStart = i == 1 ? releaseDate : dueDate[i - 1]
    periodEnd = dueDate[i]

    se preFixado:
      taxaEfetiva = taxaEstaticaMensal
      rateRef = null

    se posFixado:
      rateRef = resolveIndexerRate(companyId, indexer, periodStart, periodEnd, spread)
      taxaEfetiva = rateRef.effectiveMonthlyRate / 100

    juros = saldo * taxaEfetiva

    se tabela == SAC:
      amortizacao = min(valorFinanciado / numeroParcelas, saldo)
      parcela = amortizacao + juros

    se tabela == PRICE e preFixado:
      parcela = PMT fixo calculado no inicio
      amortizacao = parcela - juros

    se tabela == PRICE e posFixado:
      nRestante = numeroParcelas - i + 1
      parcela = PMT(saldo, taxaEfetiva, nRestante)
      amortizacao = max(parcela - juros, 0)

    se ultima parcela ou amortizacao > saldo:
      amortizacao = saldo
      parcela = amortizacao + juros

    persistir parcela:
      principal_balance = saldo
      amortization = amortizacao
      interest_amount = juros
      total_amount = parcela
      effective_rate = taxaEfetiva

    se posFixado:
      persistir rateRef

    cashflows.push({ data: dueDate[i], valor: -parcela })
    saldo = saldo - amortizacao

    se saldo <= 0,01:
      parar

  calcular CET com cashflows
  persistir cet_monthly_rate e cet_annual_rate
```

---

## 16. Regras para métricas do dashboard

### Fonte de verdade

| Métrica | Fonte recomendada |
|---|---|
| Saldo atual | Próxima parcela futura em `debt_installments`. |
| PMT corrente | Próxima parcela futura em `debt_installments`. |
| Fluxo 30/90/180 dias | Soma de `installment_amount` por vencimento. |
| Juros futuros | Soma de `interest_amount` de parcelas futuras. |
| Curto/longo prazo | Soma de `amortization` por janela de vencimento. |
| CET do contrato | `debts.cet_*_rate`, calculado pela Edge Function. |
| Taxa usada em parcela pós-fixada | `debt_installment_rate_refs`. |

Fallbacks analíticos devem:

- usar exatamente as mesmas funções de cálculo do cronograma;
- incluir spread da mesma forma que o cronograma;
- ser rotulados como estimativa quando usados;
- não disputar com parcelas persistidas.

### Pós-fixado na UI

Qualquer KPI que dependa de parcelas futuras pós-fixadas deve poder explicar:

- qual projeção foi usada;
- desde quando ela vale;
- se há cenário temporário aplicado;
- qual parcela usa histórico real e qual usa projeção.

Exemplo de tooltip desejado:

```text
Contrato CDI + 2,00% a.a.
Parcelas até abr/2026 usam CDI realizado do BCB.
Parcelas futuras usam projeção base da empresa: CDI 0,95% a.m.,
originada do último dado real de 30/04/2026.
```

---

## 17. Pontos de decisão ainda importantes

| Tema | Decisão recomendada |
|---|---|
| Base do spread | Tratar spread como anual e converter explicitamente. |
| PRICE pós-fixado | Recalcular PMT por período com prazo remanescente. |
| Período misto realizado/futuro | Usar projeção base inteira na V1; avaliar split em versão futura. |
| Saldo exibido em séries mensais | Usar saldo de fechamento do mês para visualização gerencial. |
| CET | Edge Function calcula e persiste; front exibe e só recalcula sob ação explícita. |
| Projeção futura | Último valor real BCB por empresa, sem curva forward na V1. |
| Cenários | Temporários, sem nome/salvamento persistente na V1. |
| Fallback sem índice | Falhar com mensagem operacional, não substituir silenciosamente por zero. |

---

## 18. Critérios de aceite para implementação

1. Contrato pré-fixado SAC gera amortização constante e parcela decrescente.
2. Contrato pré-fixado PRICE gera parcela constante, salvo ajuste final de centavos.
3. Contrato CDI/SELIC realizado acumula taxas diárias do período.
4. Contrato IPCA realizado usa taxa mensal do mês de referência.
5. Parcela futura pós-fixada usa `company_index_projections`.
6. Cenário temporário altera a taxa do indexador e grava/retorna `source = cenario_temporario`.
7. Toda parcela pós-fixada tem registro auditável em `debt_installment_rate_refs`.
8. `effective_rate` da parcela bate com `indexer_rate + spreadPeriodo`.
9. SAC pós-fixado mantém principal constante e varia juros/parcela.
10. PRICE pós-fixado recalcula PMT por período usando saldo e prazo remanescente.
11. CET considera desembolso líquido inicial e parcelas negativas.
12. Dashboard não recalcula saldo/PMT por fórmula divergente quando há parcelas persistidas.
13. Fallback analítico é rotulado como estimativa.
14. Atualizar projeção base não altera histórico realizado.
15. Recalcular dívida substitui parcelas e auditoria antigas de forma consistente.

---

## 19. Fonte de verdade do modelo V2

As regras que devem guiar a aplicação são:

- `debt_installments` é a fonte de verdade para saldo, PMT, juros e amortização.
- `debt_installment_rate_refs` é a fonte de verdade para explicar taxas pós-fixadas por parcela.
- Contratos pré-fixados usam taxa estática convertida para mensal.
- Contratos pós-fixados resolvem taxa por período, não por data isolada.
- CDI/SELIC realizado é acumulado diariamente.
- IPCA realizado é mensal.
- Futuro usa projeção base por empresa.
- Cenários são temporários e auditáveis.
- SAC mantém amortização constante.
- PRICE pós-fixado recalcula parcela por período.
- IOF/TAC entram no desembolso líquido e no CET, não nas parcelas recorrentes por padrão.
- CET é TIR/XIRR dos fluxos datados, com cashflow inicial positivo e parcelas negativas.

