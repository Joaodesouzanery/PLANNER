export interface Phase {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  order_index: number;
}

export interface Item {
  id: string;
  phase_id: string;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
}

export interface Tracking {
  id: string;
  contact_id: string;
  item_id: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  pipeline_stage: string | null;
  created_at?: string;
}

export interface ContactMeta {
  id: string;
  contact_id: string;
  tags: string[];
  priority: string;
  temperature: string;
  next_action_date: string | null;
  next_action_description: string | null;
  last_contact_date: string | null;
}

export const statusConfig = {
  not_started: { label: "Não Iniciado", color: "text-muted-foreground", bg: "bg-muted/50", border: "border-muted" },
  in_progress: { label: "Em Andamento", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  completed: { label: "Concluído", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

export const phaseColors = [
  "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  "from-pink-500/20 to-pink-600/5 border-pink-500/30",
  "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  "from-orange-500/20 to-orange-600/5 border-orange-500/30",
];

export const phaseIconColors = [
  "text-blue-500",
  "text-purple-500",
  "text-amber-500",
  "text-emerald-500",
  "text-pink-500",
  "text-cyan-500",
  "text-orange-500",
];
