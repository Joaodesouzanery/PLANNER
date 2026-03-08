

## Plano: Sistema Multi-Empresa com Workspaces Independentes

### Conceito
Criar uma tabela `companies` que funcione como workspace. Todas as entidades (tarefas, projetos, contatos, finanças, etc.) serão vinculadas a uma empresa. Um seletor global no sidebar permite trocar de empresa rapidamente, e o Dashboard oferece visão consolidada ou filtrada.

### 1. Banco de Dados

**Nova tabela `companies`:**
- `id`, `name`, `logo_url`, `color` (cor de destaque), `description`, `user_id`, `created_at`

**Alterar tabelas existentes** — adicionar coluna `company_id (uuid, nullable, FK → companies.id)` em:
- `tasks`, `projects`, `contacts`, `financial_transactions`, `commercial_phases`, `commercial_items`, `contact_commercial_tracking`, `calendar_events`, `planning_goals`, `planning_milestones`, `okrs`, `quick_notes`, `onboarding_steps`, `org_chart_nodes`, `execution_records`, `roadmaps`, `strategic_pillars`, `monthly_focus`

Nullable para manter compatibilidade com dados existentes (itens sem empresa = visíveis em "Todas").

### 2. Contexto Global de Empresa

**Novo `src/contexts/CompanyContext.tsx`:**
- Estado: `selectedCompanyId: string | "all"`
- Persiste seleção no `localStorage`
- Provider no `App.tsx` envolvendo as rotas EMS
- Hook `useCompany()` retorna `{ companies, selectedCompanyId, setSelectedCompanyId, selectedCompany }`
- Carrega empresas do banco via React Query

### 3. Seletor de Empresa no Sidebar

**Modificar `AppSidebar.tsx`:**
- Adicionar um seletor dropdown logo abaixo do logo/header
- Mostra a empresa ativa com cor/ícone, opção "Todas as empresas" no topo
- Botão "+" para cadastrar nova empresa (abre dialog)

### 4. Filtro Automático nas Queries

**Modificar cada página/hook de dados** para filtrar por `company_id`:
- Quando `selectedCompanyId !== "all"`, adicionar `.eq("company_id", selectedCompanyId)` nas queries
- Quando `"all"`, não filtrar (visão consolidada)
- Páginas afetadas: Overview, Tasks, Projects, Contacts, Finance, Commercial, Calendar, Planning, Onboarding, OrgChart, RoadMap, QuickNotes, Reports

### 5. Atribuição de Empresa

**Nos formulários de criação** (tarefa, projeto, contato, transação, etc.):
- Auto-preencher `company_id` com a empresa selecionada
- Se "Todas" selecionada, mostrar dropdown para escolher empresa

### 6. Dashboard Consolidado vs Filtrado

**Overview (`Overview.tsx`):**
- Quando uma empresa está selecionada: KPIs, gráficos e listas filtrados por ela
- Quando "Todas": métricas agregadas com breakdown por empresa (mini-cards por empresa mostrando resumo)

### 7. Gestão de Empresas

**Nova página `src/pages/ems/Companies.tsx`:**
- CRUD de empresas (nome, logo, cor, descrição)
- Visão geral: quantidade de projetos, tarefas, contatos, receita por empresa
- Acessível via sidebar no grupo "Configuração"

**Nova rota** `/ems/companies` no `App.tsx`

### Resumo de Arquivos

| Ação | Arquivos |
|------|---------|
| Criar | `companies` table (migration), `CompanyContext.tsx`, `Companies.tsx` |
| Modificar | `App.tsx` (rota + provider), `AppSidebar.tsx` (seletor), todas as ~15 páginas EMS (filtro por company_id), formulários de criação |

### Ordem de Implementação
1. Migration: criar tabela + adicionar colunas
2. CompanyContext + Provider
3. Seletor no Sidebar
4. Página de Gestão de Empresas
5. Filtros nas queries (página por página)
6. Dashboard consolidado

