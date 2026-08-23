-- Bloco CAIXA da planilha: saldo − reserva já separada − provisionado = CAIXA LIVRE.
--
-- `reserva_separada` e `provisionado` são declarados na aba Config da planilha e não dão para
-- derivar do razão: a reserva pode estar na mesma conta corrente (o app só conseguia inferi-la
-- pelo saldo de contas savings/investment) e o provisionado é dinheiro que já tem dono
-- (viagem, objetivo) mas ainda não saiu. Sem eles, "quanto posso gastar" fica superestimado.
-- Aditiva e idempotente. null = não declarado (o app cai no saldo das contas de reserva).

alter table public.finance_settings
  add column if not exists reserva_separada numeric,
  add column if not exists provisionado numeric;

comment on column public.finance_settings.reserva_separada is
  'Reserva de emergência já separada, declarada na Config da planilha. null = inferir pelas contas savings/investment.';
comment on column public.finance_settings.provisionado is
  'Dinheiro que já tem destino (viagem, objetivos) e não conta como caixa livre.';
