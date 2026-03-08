

# Plano de Implementação — 4 Funcionalidades

## 1. Dashboard Executivo Consolidado
Nova página `/ems/executive` que cruza dados de todos os módulos numa visão 360°.

**O que inclui:**
- Cards KPI: Receita vs Despesa, Projetos (total/concluídos/atrasados), Tarefas pendentes, Contatos ativos, Progresso médio de OKRs
- Gráfico comparativo mês atual vs anterior (receita, despesas, projetos concluídos)
- Indicadores de tendência (setas verde/vermelha)
- Gráfico de pizza: projetos por status
- Barra de progresso: OKRs em risco (< 50% progresso com prazo próximo)
- Filtro por empresa e período
- Tudo responsivo para mobile

**Dados consultados:** `projects`, `tasks`, `financial_transactions`, `okrs`, `contacts`, `companies`

**Arquivos:**
- Criar `src/pages/ems/Executive.tsx`
- Adicionar rota em `src/App.tsx`
- Adicionar item no menu do sidebar em `src/components/ems/AppSidebar.tsx`

---

## 2. Gestão de Tempo (Timesheet)
Nova página `/ems/timesheet` para registrar horas trabalhadas por projeto/tarefa.

**Migração de banco — nova tabela `time_entries`:**
```text
id (uuid PK), user_id, company_id, project_id (nullable), task_id (nullable),
date (date), hours (numeric), description (text), created_at, updated_at
```
RLS: permitir todas as operações (consistente com as demais tabelas).

**O que inclui:**
- Formulário rápido: selecionar projeto/tarefa, data, horas, descrição
- Lista de registros do dia/semana com totais
- Resumo semanal com horas por projeto (gráfico de barras)
- Filtro por empresa e período
- Exportação CSV/PDF

**Arquivos:**
- Criar `src/pages/ems/Timesheet.tsx`
- Adicionar rota e menu no sidebar

---

## 3. Anexos e Documentos
Criar um bucket de storage e permitir upload de arquivos em projetos e tarefas.

**Migração de banco:**
- Criar bucket `attachments` (público para leitura)
- Criar tabela `attachments`:
```text
id (uuid PK), entity_type (text: 'project'|'task'|'contact'),
entity_id (uuid), file_name (text), file_url (text), file_size (bigint),
content_type (text), uploaded_by (uuid nullable), company_id (uuid nullable),
created_at
```
- RLS: permitir todas as operações

**O que inclui:**
- Componente reutilizável `AttachmentManager` que recebe `entityType` e `entityId`
- Upload com drag-and-drop ou botão
- Lista de arquivos com ícone por tipo, nome, tamanho e botão de download/excluir
- Preview inline para imagens e PDFs
- Integrar nas páginas de Projetos (modal de edição) e Tarefas (seção expandida)

**Arquivos:**
- Criar `src/components/ems/AttachmentManager.tsx`
- Editar `src/pages/ems/Projects.tsx` — adicionar seção de anexos no dialog de edição
- Editar `src/pages/ems/Tasks.tsx` — adicionar seção de anexos na área expandida da tarefa

---

## 4. Busca Global
Campo de busca no header/sidebar que pesquisa em todos os módulos.

**O que inclui:**
- Componente `GlobalSearch` usando `cmdk` (CommandDialog já disponível)
- Atalho `Ctrl+K` / `Cmd+K` para abrir
- Busca em: projetos (título), tarefas (título), contatos (nome/email), notas rápidas (conteúdo), eventos do calendário (título)
- Resultados agrupados por tipo com ícone e navegação ao clicar
- Debounce de 300ms nas queries

**Arquivos:**
- Criar `src/components/ems/GlobalSearch.tsx`
- Integrar no `EMSLayout.tsx` (desktop: no topo; mobile: no MobileHeader)

---

## Resumo de Alterações

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/ems/Executive.tsx` |
| Criar | `src/pages/ems/Timesheet.tsx` |
| Criar | `src/components/ems/AttachmentManager.tsx` |
| Criar | `src/components/ems/GlobalSearch.tsx` |
| Editar | `src/App.tsx` (2 rotas novas) |
| Editar | `src/components/ems/AppSidebar.tsx` (2 itens de menu) |
| Editar | `src/components/ems/EMSLayout.tsx` (GlobalSearch) |
| Editar | `src/pages/ems/Projects.tsx` (anexos) |
| Editar | `src/pages/ems/Tasks.tsx` (anexos) |
| Migração | Tabela `time_entries`, tabela `attachments`, bucket `attachments` |

