

# Plano: Autenticação + Otimizações

## 1. Autenticação (Login/Cadastro)

Criar uma tela de login em `/ems/login` e proteger todas as rotas `/ems/*` com um `ProtectedRoute` que exige usuário autenticado (sem exigir role admin -- qualquer usuário autenticado acessa o EMS).

**Arquivos:**
- **Criar** `src/pages/ems/Login.tsx` — tela de login/cadastro com email+senha, visual consistente com o tema EMS
- **Criar** `src/components/ems/ProtectedEMSRoute.tsx` — wrapper que redireciona para `/ems/login` se não autenticado
- **Editar** `src/App.tsx` — envolver rotas EMS com `AuthProvider` e `ProtectedEMSRoute`, adicionar rota `/ems/login`
- **Editar** `src/components/ems/AppSidebar.tsx` — adicionar botão de logout no rodapé do sidebar

## 2. Otimizações Recomendadas

### 2a. Performance: React Query em vez de useEffect+useState
O `Executive.tsx` e `Overview.tsx` usam `useEffect` manual com `supabase.from()` e `useState` para loading/data. Migrar para `useQuery` do TanStack (como já é feito no `Timesheet.tsx`) para cache automático, deduplicação e revalidação.

### 2b. Componente de filtro de período reutilizável
Vários módulos (Executive, Projects, Timesheet, Reports) implementam o mesmo padrão de filtro por data (`dateFrom`/`dateTo` + inputs). Extrair para um componente `DateRangeFilter`.

### 2c. Sidebar: indicador de usuário logado
Mostrar avatar/email do usuário logado no rodapé do sidebar, junto ao botão de logout.

### 2d. Loading states consistentes
Padronizar os estados de carregamento com Skeleton components em vez de texto simples ou spinners inconsistentes.

---

## Resumo de Alterações

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/ems/Login.tsx` |
| Criar | `src/components/ems/ProtectedEMSRoute.tsx` |
| Criar | `src/components/ems/DateRangeFilter.tsx` |
| Editar | `src/App.tsx` — AuthProvider + ProtectedEMSRoute + rota login |
| Editar | `src/components/ems/AppSidebar.tsx` — logout + user info |
| Editar | `src/pages/ems/Executive.tsx` — migrar para useQuery |
| Editar | `src/pages/ems/Overview.tsx` — migrar para useQuery |

Nenhuma migração de banco necessária — a tabela `user_roles` e auth já existem. O auto-confirm de email será habilitado para facilitar o fluxo (cadastrou, já pode logar).

