import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

type TableName = 
  | "projects" | "tasks" | "contacts" | "financial_transactions" 
  | "okrs" | "planning_milestones" | "planning_goals" | "calendar_events"
  | "time_entries" | "quick_notes" | "execution_records" | "roadmaps"
  | "strategic_pillars" | "monthly_focus" | "kanban_columns" | "org_chart_nodes"
  | "commercial_phases" | "commercial_items" | "attachments"
  | "onboarding_steps" | "onboarding_documents";

interface UseCompanyQueryOptions<T> {
  table: TableName;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Array<{ column: string; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "is" | "not"; value: any }>;
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  /** Extra query key segments for cache isolation */
  extraKeys?: any[];
}

/**
 * Centralized hook that wraps React Query + Supabase with automatic company_id filtering.
 * Eliminates the repetitive companyFilter pattern across all EMS pages.
 */
export function useCompanyQuery<T = any[]>({
  table,
  select = "*",
  orderBy,
  filters = [],
  enabled = true,
  refetchInterval,
  staleTime,
  extraKeys = [],
}: UseCompanyQueryOptions<T>) {
  const { selectedCompanyId } = useCompany();

  return useQuery({
    queryKey: [table, selectedCompanyId, ...extraKeys],
    queryFn: async () => {
      let query = supabase.from(table).select(select);

      // Automatic company filter
      if (selectedCompanyId !== "all") {
        query = query.eq("company_id", selectedCompanyId);
      }

      // Apply extra filters
      for (const f of filters) {
        if (f.operator === "is") {
          query = query.is(f.column, f.value);
        } else if (f.operator === "not") {
          query = query.not(f.column, "is", f.value);
        } else {
          query = (query as any)[f.operator](f.column, f.value);
        }
      }

      // Ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as T;
    },
    enabled,
    refetchInterval,
    staleTime,
  });
}
