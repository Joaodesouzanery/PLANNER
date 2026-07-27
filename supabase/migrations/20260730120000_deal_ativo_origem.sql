-- CRM · Loop de decisão: liga o deal ao ATIVO que o originou (ativo_de_origem do spec). Soft (sem FK,
-- degrada se o ativo for removido). Fecha o loop do painel de Ativos: qual ativo virou deal/ganho.
-- close_reason (motivo de perda) já existe (20260713130000_crm_deals.sql); aqui só a origem do ativo.

alter table public.project_opportunities add column if not exists ativo_origem_id uuid;
create index if not exists idx_project_opportunities_ativo_origem on public.project_opportunities (ativo_origem_id);
