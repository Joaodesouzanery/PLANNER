-- CFO v2 · Fase 5: vigia do teto do Simples (RBT12). Limite configurável (não hardcodar faixas).
alter table public.finance_settings add column if not exists rbt12_limit numeric;
alter table public.finance_settings add column if not exists rbt12_alert_pct numeric default 80;
