# Plano de implementação (4 frentes em ordem)

## 1) Finanças — PDFs avançados, duplicar cenário e presets

**FinanceScenarios.tsx**
- Botão "Exportar A×B (PDF)" gera relatório com:
  - Cabeçalho com nomes dos cenários A e B + data
  - Gráfico de linhas/barras mês a mês (renderizado via `html2canvas` num container off-screen usando Recharts já presente)
  - Tabela mês a mês: Receita A, Despesa A, Saldo A, Receita B, Despesa B, Saldo B, Δ Saldo, Δ %
  - Breakdown das fontes (recorrente vs histórica) por cenário
  - Alertas (poucos meses de histórico, baseline zerado, etc.)
- Botão "Duplicar cenário" em cada card (clona linha em `finance_scenarios` com sufixo "(cópia)")
- Presets de janela histórica: dropdown com "Últimos 3 / 6 / 12 meses" salvo em `finance_scenarios.history_window` (já existe); botão "Salvar como preset" grava em `localStorage` (`finance_history_window_presets`) para reuso rápido

**FinanceProjections.tsx**
- Modo "seleção múltipla": checkbox em cada mês projetado
- Botão "Exportar selecionados (PDF)" gera um PDF único com:
  - Capa com índice e numeração de páginas
  - Uma página por mês com breakdown completo, fontes (histórica/recorrente/none), regras aplicadas e alertas
  - Rodapé com paginação `Página X de Y`

**Bibliotecas**: `jspdf`, `jspdf-autotable` (já instalados) + `html2canvas` (instalar)

## 2) Dashboard — widgets de Rotinas e sincronia com Finanças

**Overview.tsx (Dashboard)**
- Novo widget `RotinasResumoCard` (por cliente):
  - Cards compactos agrupados por `routine_clients`
  - Mostra: nome do cliente, % de tarefas concluídas hoje, contagem de tarefas críticas pendentes
  - Botão "Abrir no Conselho" → `/ems/board?tab=rotinas&client=<id>`
- Novo widget `RotinasCriticasList`:
  - Lista única das tarefas com `priority='high'` ou vencidas em todos os clientes
  - Clique navega para Conselho focando aquela rotina

**Fix de janela em Dashboard de Finanças**
- `FinanceDashboard.tsx`: o filtro de período atualmente só agrega `financial_transactions` realizadas. Quando o período inclui meses futuros, precisa somar também:
  - `finance_plan_items` planejados no intervalo
  - Renda recorrente ativa convertida para o intervalo (usando `projectionCalc`)
- Cards "Entradas/Saídas previstas" passam a popular para qualquer janela futura
- Realtime já existe em `useFinanceData`; estender a invalidação para refletir mudanças em `routine_*` no Dashboard

## 3) Finanças → Viagem (bug fixes) e auditoria Conselho

**FinanceTravel.tsx / useTravel.ts**
- Inputs numéricos atualmente usam `type="number"` com `valueAsNumber` quebrando digitação (parse de string vazia → NaN). Trocar para:
  - `type="text" inputMode="decimal"` com máscara aceitando vírgula/ponto
  - Estado local string, conversão só no submit
- Salvar: revisar mutation; garantir `user_id` via trigger (não enviar manualmente), validar campos obrigatórios e tratar erro com toast claro
- Conferir RLS de `finance_trips`, `finance_trip_categories`, `finance_travel_profile`

**Auditoria Conselho (BoardCouncil + sub-painéis)**
- Verificar todas as mutations (BoardCockpit, Decisions, Meetings, Risk, Stack, Obligations, Strategy, Rotinas) — invalidação de queries, tratamento de erro
- Confirmar persistência (sem optimistic update perdendo dados)
- Verificar console por warnings (`DialogContent` sem Description aparece nos logs — adicionar `aria-describedby`)

## 4) Tarefas Semanais — reforma do drag-and-drop

Substituir implementação atual de `@hello-pangea/dnd` na aba Semanais por `@dnd-kit/core + @dnd-kit/sortable`:
- **Latência**: virtualização leve, `useMemo` na lista, evitar re-render do board inteiro a cada drag
- **Drop zone**: usar `SortableContext` com `verticalListSortingStrategy` (mais preciso) e indicador visual de inserção
- **Persistência**: `onDragEnd` faz update otimista no cache do React Query e dispara batch update do `sort_order` em uma única chamada (RPC ou múltiplos updates em paralelo); rollback em caso de erro
- **Touch/mobile**: configurar `PointerSensor` + `TouchSensor` com `activationConstraint` (delay 150ms, tolerance 5px) para long-press funcionar

---

## Detalhes técnicos

**Migrations necessárias**
- Nenhuma nova tabela; `finance_scenarios.history_window` já existe
- Possível: `ALTER TABLE routine_tasks` para garantir `sort_order` indexado (já tem `idx_routine_tasks_client_status`, adicionar `sort_order`)

**Novas dependências**
- `html2canvas` (PDF do gráfico A×B)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (substituir hello-pangea/dnd nas Semanais)

**Arquivos a editar/criar**
- `src/components/ems/finance/FinanceScenarios.tsx` (export PDF A×B, duplicar, presets)
- `src/components/ems/finance/FinanceProjections.tsx` (seleção múltipla + PDF multi-mês)
- `src/components/ems/finance/FinanceDashboard.tsx` (incluir planejados+recorrentes na janela)
- `src/components/ems/finance/travel/FinanceTravel.tsx` + `useTravel.ts` (inputs e save)
- `src/pages/ems/Overview.tsx` + novos `src/components/ems/dashboard/RotinasResumoCard.tsx` e `RotinasCriticasList.tsx`
- `src/pages/ems/Tasks.tsx` + novo `src/components/ems/tasks/WeeklySortableList.tsx` (dnd-kit)
- Auditoria leve (sem mudança funcional grande) nos painéis de Conselho

**Validação ao final de cada frente**
- Frente 1: gerar PDFs de teste, abrir manualmente
- Frente 2: navegar Dashboard, conferir widgets e período futuro
- Frente 3: criar/editar viagem, salvar; criar item em cada painel do Conselho
- Frente 4: arrastar 10+ itens, recarregar e conferir ordem; testar no viewport mobile
