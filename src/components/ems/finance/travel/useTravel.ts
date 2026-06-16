import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

export interface TravelProfile {
  id?: string;
  monthly_salary: number;
  variable_income: number;
  other_income: number;
  housing: number;
  food: number;
  transport: number;
  subscriptions: number;
  debts: number;
}

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  profile: string;
  is_international: boolean;
  exchange_rate: number | null;
  emergency_pct: number;
  notes: string | null;
  status: string;
  company_id: string | null;
}

export interface TripCategory {
  id: string;
  trip_id: string;
  key: string;
  label: string;
  amount: number;
  is_per_person: boolean;
  multiply_by_nights: boolean;
  limit_pct: number | null;
  sort_order: number;
}

const emptyProfile: TravelProfile = {
  monthly_salary: 0, variable_income: 0, other_income: 0,
  housing: 0, food: 0, transport: 0, subscriptions: 0, debts: 0,
};

export const useTravelProfile = () => {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  const query = useQuery({
    queryKey: ["travel-profile", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("finance_travel_profile" as any).select("*").limit(1);
      if (companyId) q = q.eq("company_id", companyId);
      else q = q.is("company_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data?.[0] as TravelProfile) || emptyProfile;
    },
  });

  const save = useMutation({
    mutationFn: async (p: TravelProfile) => {
      const payload: any = { ...p, company_id: companyId };
      if (p.id) {
        const { error } = await supabase.from("finance_travel_profile" as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_travel_profile" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-profile"] });
      toast({ title: "Perfil salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return { profile: query.data || emptyProfile, isLoading: query.isLoading, save };
};

export const useTrips = () => {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  const trips = useQuery({
    queryKey: ["trips", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("finance_trips" as any).select("*").order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Trip[];
    },
  });

  const create = useMutation({
    mutationFn: async (t: Partial<Trip>) => {
      const { data, error } = await supabase.from("finance_trips" as any).insert({ ...t, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast({ title: "Viagem criada" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Trip> & { id: string }) => {
      const { error } = await supabase.from("finance_trips" as any).update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_trips" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast({ title: "Viagem removida" }); },
  });

  return { trips: trips.data || [], isLoading: trips.isLoading, create, update, remove };
};

export const useTripCategories = (tripId: string | null) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["trip-categories", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_trip_categories" as any).select("*").eq("trip_id", tripId!).order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as TripCategory[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (c: Partial<TripCategory>) => {
      if (c.id) {
        const { error } = await supabase.from("finance_trip_categories" as any).update(c as any).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_trip_categories" as any).insert(c as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-categories", tripId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_trip_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-categories", tripId] }),
  });

  return { categories: query.data || [], isLoading: query.isLoading, upsert, remove };
};

export const seedDefaultCategories = async (tripId: string) => {
  const defaults = [
    { key: "transport", label: "Transporte (passagens, translado)", amount: 0, is_per_person: true, multiply_by_nights: false, sort_order: 0 },
    { key: "lodging", label: "Hospedagem", amount: 0, is_per_person: false, multiply_by_nights: true, sort_order: 1 },
    { key: "food", label: "Alimentação", amount: 0, is_per_person: true, multiply_by_nights: true, sort_order: 2 },
    { key: "extras", label: "Extras (passeios, compras)", amount: 0, is_per_person: false, multiply_by_nights: false, sort_order: 3 },
  ];
  await supabase.from("finance_trip_categories" as any).insert(defaults.map(d => ({ ...d, trip_id: tripId })) as any);
};
