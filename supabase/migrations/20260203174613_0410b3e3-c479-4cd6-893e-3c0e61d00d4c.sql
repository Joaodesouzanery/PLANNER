-- Add client column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client TEXT;

-- Remove user_id constraint since we're removing authentication
-- Update RLS policies to allow all operations without authentication

-- Drop existing RLS policies for projects
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Create new open policies for projects
CREATE POLICY "Allow all operations on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for kanban_columns
DROP POLICY IF EXISTS "Users can create their own columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Users can view their own columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Users can update their own columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Users can delete their own columns" ON public.kanban_columns;

-- Create new open policies for kanban_columns
CREATE POLICY "Allow all operations on kanban_columns" ON public.kanban_columns FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for execution_records
DROP POLICY IF EXISTS "Users can create their own records" ON public.execution_records;
DROP POLICY IF EXISTS "Users can view their own records" ON public.execution_records;
DROP POLICY IF EXISTS "Users can update their own records" ON public.execution_records;
DROP POLICY IF EXISTS "Users can delete their own records" ON public.execution_records;

-- Create new open policies for execution_records
CREATE POLICY "Allow all operations on execution_records" ON public.execution_records FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for strategic_pillars
DROP POLICY IF EXISTS "Users can create their own pillars" ON public.strategic_pillars;
DROP POLICY IF EXISTS "Users can view their own pillars" ON public.strategic_pillars;
DROP POLICY IF EXISTS "Users can update their own pillars" ON public.strategic_pillars;
DROP POLICY IF EXISTS "Users can delete their own pillars" ON public.strategic_pillars;

-- Create new open policies for strategic_pillars
CREATE POLICY "Allow all operations on strategic_pillars" ON public.strategic_pillars FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for monthly_focus
DROP POLICY IF EXISTS "Users can create their own focus" ON public.monthly_focus;
DROP POLICY IF EXISTS "Users can view their own focus" ON public.monthly_focus;
DROP POLICY IF EXISTS "Users can update their own focus" ON public.monthly_focus;
DROP POLICY IF EXISTS "Users can delete their own focus" ON public.monthly_focus;

-- Create new open policies for monthly_focus
CREATE POLICY "Allow all operations on monthly_focus" ON public.monthly_focus FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for okrs
DROP POLICY IF EXISTS "Users can create their own okrs" ON public.okrs;
DROP POLICY IF EXISTS "Users can view their own okrs" ON public.okrs;
DROP POLICY IF EXISTS "Users can update their own okrs" ON public.okrs;
DROP POLICY IF EXISTS "Users can delete their own okrs" ON public.okrs;

-- Create new open policies for okrs
CREATE POLICY "Allow all operations on okrs" ON public.okrs FOR ALL USING (true) WITH CHECK (true);

-- Drop existing RLS policies for financial_transactions
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.financial_transactions;

-- Create new open policies for financial_transactions
CREATE POLICY "Allow all operations on financial_transactions" ON public.financial_transactions FOR ALL USING (true) WITH CHECK (true);