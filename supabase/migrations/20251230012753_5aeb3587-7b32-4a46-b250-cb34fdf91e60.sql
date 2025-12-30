-- Create projects table for Kanban
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  column_order INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id)
);

-- Create kanban columns table
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create execution records table (Knowledge Base)
CREATE TABLE public.execution_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  result_obtained TEXT NOT NULL,
  lessons_learned TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create strategic pillars table
CREATE TABLE public.strategic_pillars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'target',
  color TEXT DEFAULT 'primary',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create monthly focus table
CREATE TABLE public.monthly_focus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create OKRs/KPIs table
CREATE TABLE public.okrs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC NOT NULL DEFAULT 100,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT '%',
  period TEXT DEFAULT 'quarterly',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create financial transactions table
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for kanban_columns
CREATE POLICY "Users can view their own columns" ON public.kanban_columns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own columns" ON public.kanban_columns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own columns" ON public.kanban_columns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own columns" ON public.kanban_columns FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for execution_records
CREATE POLICY "Users can view their own records" ON public.execution_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own records" ON public.execution_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own records" ON public.execution_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own records" ON public.execution_records FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for strategic_pillars
CREATE POLICY "Users can view their own pillars" ON public.strategic_pillars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pillars" ON public.strategic_pillars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pillars" ON public.strategic_pillars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pillars" ON public.strategic_pillars FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for monthly_focus
CREATE POLICY "Users can view their own focus" ON public.monthly_focus FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus" ON public.monthly_focus FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus" ON public.monthly_focus FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus" ON public.monthly_focus FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for okrs
CREATE POLICY "Users can view their own okrs" ON public.okrs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own okrs" ON public.okrs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own okrs" ON public.okrs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own okrs" ON public.okrs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for financial_transactions
CREATE POLICY "Users can view their own transactions" ON public.financial_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own transactions" ON public.financial_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON public.financial_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON public.financial_transactions FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_okrs_updated_at BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();