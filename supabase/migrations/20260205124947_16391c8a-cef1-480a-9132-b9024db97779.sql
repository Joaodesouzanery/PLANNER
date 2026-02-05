-- Planning Goals table
CREATE TABLE public.planning_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'strategic',
  start_date DATE,
  end_date DATE,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  parent_id UUID REFERENCES public.planning_goals(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID
);

-- Planning Milestones table
CREATE TABLE public.planning_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES public.planning_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization Chart nodes table
CREATE TABLE public.org_chart_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  department TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  parent_id UUID REFERENCES public.org_chart_nodes(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  color TEXT DEFAULT 'primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID
);

-- Enable RLS
ALTER TABLE public.planning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_chart_nodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for planning_goals
CREATE POLICY "Allow all operations on planning_goals" 
ON public.planning_goals 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- RLS Policies for planning_milestones
CREATE POLICY "Allow all operations on planning_milestones" 
ON public.planning_milestones 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- RLS Policies for org_chart_nodes
CREATE POLICY "Allow all operations on org_chart_nodes" 
ON public.org_chart_nodes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_planning_goals_updated_at
BEFORE UPDATE ON public.planning_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_chart_nodes_updated_at
BEFORE UPDATE ON public.org_chart_nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();