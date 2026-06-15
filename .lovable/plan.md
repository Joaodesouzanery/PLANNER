## Objetivo
Tornar o módulo Finanças totalmente coerente (mesma fonte de dados em todas as abas), corrigir erros de salvamento e adicionar uma calculadora de meta de economia avançada em "Planejamento → Novo Previsto".

---

## 1. Unificação dos dados (fonte única)

Hoje cada aba lê parcialmente o estado. Vou centralizar tudo no hook `useFinanceData` + `useFinanceWorkspace`, expondo um único snapshot consumido por:

- Dashboard, Fluxo Futuro, OKRs, Transações, Planejamento, Projeções, Metas, Previstos
- Sub-painéis Horizonte / Contas / Cartões / Linha do tempo (dentro de Fluxo Futuro)

Regras de unificação:
- **Transações** continuam sendo a tabela base (`financial_transactions`).
- **Fluxo Futuro / Linha do tempo / Horizonte**: derivados da mesma lista (transações reais + parcelas salvas + recorrências expandidas + previstos não pagos).
- **Cartões**: somatório das transações com `finance_account_id` cujo `kind = 'credit'` + `finance_card_invoices` para fechamento.
- **Contas**: saldo = saldo inicial (`finance_accounts.opening_balance`) + transações liquidadas da conta.
- **Previstos / Metas / OKRs**: leem `financial_transactions` para calcular progresso real.

Vou refatorar para que cada aba receba `data` via o hook e nada seja recalculado isolado.

---

## 2. Filtro de período no Dashboard

Adicionar `DateRangeFilter` (já existe em `src/components/ems/DateRangeFilter.tsx`) no topo do `FinanceDashboard`:

- Seletor de intervalo (com presets: Este mês, Últimos 3 meses, Ano, Personalizado).
- Botão "Limpar filtro" → volta ao default (mês atual).
- Aplica o filtro a: entradas, saídas, saldo, gráficos e cards comparativos.
- O mesmo filtro impacta apenas o Dashboard (não muda outras abas, para evitar confusão).

---

## 3. Correção de erros ao salvar

Vou auditar e corrigir:

- `finance_entities`, `finance_accounts`, `finance_transfers`, `finance_card_invoices` — garantir que `user_id` é setado pelo trigger `set_user_id_on_insert` e que `company_id` é opcional.
- `financial_transactions` — confirmar que `finance_account_id`, `due_date`, `status` aceitam null e que o insert do form envia os campos certos.
- `finance_monthly_plans` / `finance_plan_items` / `finance_saved_installments` — validar RLS e GRANTs (alguns podem estar sem `service_role`).
- `planning_goals` — garantir que o novo tipo "Meta de Economia" salva.

Vou rodar o linter de segurança após a migration de ajuste.

---

## 4. Meta de Economia avançada (Planejamento → Novo Previsto)

Nova opção no modal "Novo Previsto" com cálculos:

**Inputs:**
- Nome do objetivo (ex.: "Notebook novo")
- Preço-alvo (R$)
- Renda mensal atual (R$) — pré-preenchida com salário detectado
- Renda mensal hipotética (R$, opcional)
- Custos fixos mensais (R$) — pré-preenchidos pela soma de despesas recorrentes
- % da sobra que vai para a meta (slider 0–100)
- Data desejada (opcional)

**Outputs calculados em tempo real:**
- Sobra mensal = renda − custos fixos
- Economia mensal = sobra × %
- Meses até atingir = preço / economia mensal
- Data prevista de compra
- Comparativo "E se eu ganhasse X?" → recalcula meses e mostra delta
- Simulação de parcelas: "Se pago Y em N parcelas hoje e passo a ganhar Z, quantas parcelas a mais consigo cobrir por mês?"

**Persistência:**
- Salva em `planning_goals` com `category = 'savings'` e payload em coluna `metadata jsonb` (já existe) contendo todos os inputs/outputs.
- Aparece como card especial em "Previstos" com barra de progresso baseada em transações reais marcadas com a tag da meta.

---

## Detalhes técnicos

- Migration (se necessário): adicionar coluna `metadata jsonb` em `planning_goals` se ainda não existir; revisar GRANTs e policies das tabelas finance_*.
- Refactor: `useFinanceData` passa a expor `getFilteredSnapshot({ from, to })`.
- Componentes novos: `SavingsGoalForm.tsx` dentro de `src/components/ems/planning/`.
- Reuso: `DateRangeFilter`, `Slider`, `Input`, `Select` do design system.

---

## Fora do escopo
- Mudar UI das outras abas além de adicionar o filtro no Dashboard.
- Importação automática de extratos bancários.