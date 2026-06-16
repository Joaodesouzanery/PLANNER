# Plano

## 1) Tarefas — aba "Semanais" + Prioridade drag-and-drop

**Schema (migration):**
- `tasks`: adicionar colunas
  - `is_weekly boolean default false`
  - `week_start date null` (segunda-feira da semana alvo)
  - `priority_order int default 0` (ordem manual dentro do escopo atual)
- Manter `project_id` existente (já é nullable) → permite finalizar a tarefa e depois atribuir projeto.

**UI (`src/pages/ems/Tasks.tsx`):**
- Nova aba/filtro **Semanais** ao lado das existentes. Mostra apenas tarefas com `is_weekly = true` da semana atual (com seletor de semana anterior/próxima).
- Botão "Nova tarefa semanal" → cria com `is_weekly=true`, `week_start=segunda da semana selecionada`, `project_id=null` opcional.
- **Drag-and-drop** com `@dnd-kit/core` + `@dnd-kit/sortable` (já leves) para reordenar por `priority_order`. Aplica nas listas: Semanais, Hoje, Backlog, e por status do Kanban. Persistência: update batch dos `priority_order` ao soltar.
- Em cada tarefa concluída sem projeto → aparece um seletor inline "Contabilizar em…" (combobox de projetos) que faz `update tasks set project_id = X`.

**Out of scope:** mudar visual do Kanban; criar nova entidade de "semana"; cron jobs.

---

## 2) Finanças → novo módulo **Viagem**

**Schema (migration):**
- `finance_travel_profile` (perfil financeiro reutilizável; 1 por usuário/empresa)
  - `monthly_salary, variable_income, other_income numeric`
  - `housing, food, transport, subscriptions, debts numeric`
  - (saldo disponível é calculado no client)
- `finance_trips`
  - `name, destination text`
  - `start_date, end_date date` (dias derivados)
  - `adults int, children int`
  - `profile text` (eco/standard/luxo)
  - `is_international bool`, `exchange_rate numeric null`
  - `emergency_pct numeric default 15`
  - `notes text`, `status text` (planning/saved/done)
- `finance_trip_categories`
  - `trip_id`, `key text` (transport/lodging/food/extras/<custom>)
  - `label text`, `amount numeric`, `is_per_person bool`, `multiply_by_nights bool`
  - `limit_pct numeric null` (limite % opcional sobre o total da viagem ou sobre renda mensal — flag em metadata)
  - `metadata jsonb`

GRANTs + RLS via `user_can_access(user_id, company_id)` + triggers `set_user_id_on_insert` e `update_updated_at_column`.

**UI:**
- Nova tab "Viagem" em `Finance.tsx`. Componentes em `src/components/ems/finance/travel/`:
  - `TravelProfileForm.tsx` — perfil financeiro com cards de resumo (Renda, Gastos, **Saldo disponível**).
  - `TripForm.tsx` — destino, datas (calcula `nights`), viajantes, perfil, nacional/internacional (toggle revela câmbio/visto/seguro).
  - `TripBudget.tsx` — categorias padrão + botão "+ categoria personalizada". Cada linha: valor, toggle "por pessoa", toggle "× noites", **campo % limite** opcional. Mostra alerta quando estourar.
  - `TripDashboard.tsx` — custo total, custo/pessoa, **meta mensal** (`total ÷ meses até start_date`), `% da renda comprometida`, **semáforo de viabilidade** (verde/amarelo/vermelho), barra de progresso de poupança, reserva de emergência 15% automática.
  - `TripScenarios.tsx` — comparativo 1 / 2 / 5 pessoas lado a lado, separando custos compartilhados (lodging, carro) de per-capita (passagens, alimentação).
- Lista "Viagens salvas" no topo (cards) com editar/duplicar/excluir.

**Cálculos (client):**
```
availableBalance = (salary + variable + other) - (housing+food+transport+subs+debts)
nights = differenceInDays(end, start)
monthsUntil = max(1, monthsBetween(today, start))
subtotal = Σ category amounts (com multiplicadores)
emergency = subtotal * emergency_pct/100
total = subtotal + emergency
totalBRL = isInternational ? total * exchange_rate : total
perPerson = totalBRL / (adults + children)
monthlyGoal = totalBRL / monthsUntil
committedPct = monthlyGoal / availableBalance
status = committedPct<=0.3 verde | <=0.6 amarelo | >0.6 vermelho
```

**Limites por categoria:** se `limit_pct` definido → comparar `amount / total` (ou `/ availableBalance`, toggle) e exibir badge "Acima do limite".

**Out of scope:** integração com APIs de câmbio em tempo real (campo manual); booking; conversão multi-moeda além de uma taxa.

---

## Detalhes técnicos
- Libs novas: `@dnd-kit/core`, `@dnd-kit/sortable` (Tarefas).
- Migrations: 1 para tasks, 1 para travel (cumprindo CREATE→GRANT→RLS→POLICY).
- Tudo respeita multi-tenant via `company_id` + `useCompanyQuery`.
- Sem mudanças nas demais abas do Finance.
