UPDATE public.financial_transactions
SET is_recurring = true, recurrence_interval = 'monthly', recurrence_end_date = NULL, category = 'Ferramentas'
WHERE id = '1d622a19-b422-49f0-99c1-9855279041a9';

UPDATE public.financial_transactions
SET is_recurring = true, recurrence_interval = 'monthly', recurrence_end_date = '2027-05-31', category = 'Ferramentas'
WHERE id = '58372e91-0c42-4f4f-82bf-05846d186d9e';
