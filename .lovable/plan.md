

# Plano: Otimizações Completas — Finance, Calendar, Overview e Contatos/Comercial

## 1. Finance: Dividir em Sub-componentes + useQuery + Recorrência + Amortização

O arquivo `Finance.tsx` tem 870 linhas. Será dividido em 6 sub-componentes:

**Novos arquivos:**
- `src/components/ems/finance/FinanceDashboard.tsx` — KPI cards + gráficos (receita vs despesa, capital, pie charts)
- `src/components/ems/finance/FinanceOKRs.tsx` — Lista de OKRs + modal CRUD
- `src/components/ems/finance/FinanceTransactions.tsx` — Tabela filtrada + modal CRUD + campo de recorrência
- `src/components/ems/finance/FinanceProjections.tsx` — Projeções e capital acumulado
- `src/components/ems/finance/FinanceCalculator.tsx` — Calculadora de metas
- `src/components/ems/finance/FinanceSimulator.tsx` — Simulador de parcelas + novo gráfico de amortização (AreaChart mostrando saldo devedor ao longo das parcelas)
- `src/components/ems/finance/useFinanceData.ts` — Hook com `useQuery` para OKRs e transações + mutations com `useMutation`

**Recorrência de transações:**
- Adicionar campo `is_recurring` (boolean) e `recurrence_interval` (text: monthly/weekly/yearly) na tabela `financial_transactions` via migração
- No formulário de transação, toggle de "Transação recorrente" + seletor de frequência
- Badge visual na tabela indicando transações recorrentes

**Gráfico de amortização no simulador:**
- Adicionar um `AreaChart` mostrando a evolução do saldo devedor ao longo das parcelas selecionadas
- Eixo X: meses, Eixo Y: saldo restante (curva decrescente)

**`Finance.tsx` refatorado** ficará apenas com layout, tabs e imports dos sub-componentes (~80 linhas).

---

## 2. Calendar: Vistas Semanal/Diária + Timesheet + Drag-and-Drop

**Editar** `src/pages/ems/Calendar.tsx`:

- Migrar `useEffect`+`useState` para `useQuery` (3 queries: events, tasks, milestones) + query adicional para `time_entries`
- Adicionar tabs/toggle: **Mês | Semana | Dia**
- **Vista semanal:** Grid 7 colunas (dias da semana atual) com linhas por hora (8h-20h), exibindo eventos/tarefas posicionados por horário
- **Vista diária:** Timeline vertical com slots por hora, mostrando todos os itens do dia + horas do Timesheet
- **Integração Timesheet:** Na vista diária/semanal, mostrar badge com horas registradas por dia (dados de `time_entries`)
- **Drag-and-drop:** Usar `@hello-pangea/dnd` (já instalado) para mover eventos entre dias na vista mensal e semanal; ao soltar, atualiza `start_date` via `useMutation`

---

## 3. Overview: Migrar para useQuery

**Editar** `src/pages/ems/Overview.tsx`:

- Substituir o `fetchData()` monolítico (12+ queries em `useEffect`) por múltiplos `useQuery` hooks:
  - `["overview-pillars", companyId]` — strategic_pillars
  - `["overview-focus", companyId]` — monthly_focus
  - `["overview-projects", companyId]` — projects (count por status)
  - `["overview-finance", companyId]` — financial_transactions (totais + chart)
  - `["overview-contact-tasks", companyId]` — tasks com contact
  - `["overview-week-tasks", companyId]` — tasks da semana
  - `["overview-counts", companyId]` — counts de projetos/contatos
- Mutations para pillar CRUD e focus save com `queryClient.invalidateQueries`
- Remover todos os `useState` de dados, manter apenas os de UI (editingPillar, etc.)

---

## 4. Integração Contatos ↔ Comercial

**Editar** `src/pages/ems/Contacts.tsx`:
- Adicionar link "Ver no Comercial" no card do contato, navegando para `/ems/commercial` com query param `?contact=ID`
- Mostrar badge de temperatura/prioridade do `commercial_contact_meta` se existir (query join)

**Editar** `src/pages/ems/Commercial.tsx`:
- Na listagem de contatos, ler query param `?contact=ID` no mount para auto-selecionar o contato
- Adicionar link "Ver em Contatos" no detalhe do contato, navegando para `/ems/contacts`

---

## Migração de Banco

Uma migração para adicionar campos de recorrência:
```sql
ALTER TABLE financial_transactions 
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurrence_interval text DEFAULT null;
```

---

## Resumo de Alterações

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/ems/finance/useFinanceData.ts` |
| Criar | `src/components/ems/finance/FinanceDashboard.tsx` |
| Criar | `src/components/ems/finance/FinanceOKRs.tsx` |
| Criar | `src/components/ems/finance/FinanceTransactions.tsx` |
| Criar | `src/components/ems/finance/FinanceProjections.tsx` |
| Criar | `src/components/ems/finance/FinanceCalculator.tsx` |
| Criar | `src/components/ems/finance/FinanceSimulator.tsx` |
| Reescrever | `src/pages/ems/Finance.tsx` (870→~80 linhas) |
| Reescrever | `src/pages/ems/Calendar.tsx` (vistas + DnD + useQuery) |
| Editar | `src/pages/ems/Overview.tsx` (useQuery) |
| Editar | `src/pages/ems/Contacts.tsx` (link comercial + meta badge) |
| Editar | `src/pages/ems/Commercial.tsx` (auto-select + link contatos) |
| Migração | `financial_transactions` — campos `is_recurring`, `recurrence_interval` |

