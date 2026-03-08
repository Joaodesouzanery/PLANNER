ALTER TABLE public.financial_transactions 
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurrence_interval text DEFAULT null;