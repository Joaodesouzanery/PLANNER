import { useEffect } from "react";
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

const nonNeg = (v: unknown) => Math.max(0, Number(v) || 0);

/** Sanea faixas/sinal de uma viagem antes de gravar (defesa em profundidade). */
const sanitizeTrip = (t: Partial<Trip>): Partial<Trip> => {
  const out: Partial<Trip> = { ...t };
  if (out.adults != null) out.adults = Math.max(1, Math.trunc(Number(out.adults) || 1));
  if (out.children != null) out.children = Math.max(0, Math.trunc(Number(out.children) || 0));
  if (out.emergency_pct != null) out.emergency_pct = Math.min(100, Math.max(0, Number(out.emergency_pct) || 0));
  if (out.exchange_rate != null) out.exchange_rate = Number(out.exchange_rate) > 0 ? Number(out.exchange_rate) : null;
  return out;
};

/** Sanea o perfil financeiro (nunca negativo). */
const sanitizeProfile = (p: TravelProfile): TravelProfile => ({
  ...p,
  monthly_salary: nonNeg(p.monthly_salary), variable_income: nonNeg(p.variable_income), other_income: nonNeg(p.other_income),
  housing: nonNeg(p.housing), food: nonNeg(p.food), transport: nonNeg(p.transport),
  subscriptions: nonNeg(p.subscriptions), debts: nonNeg(p.debts),
});

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
      return ((data?.[0] as unknown) as TravelProfile) || emptyProfile;
    },
  });

  const save = useMutation({
    mutationFn: async (raw: TravelProfile) => {
      const p = sanitizeProfile(raw);
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
      const { data, error } = await supabase.from("finance_trips" as any).insert({ ...sanitizeTrip(t), company_id: companyId } as any).select().single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast({ title: "Viagem criada" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Trip> & { id: string }) => {
      const { error } = await supabase.from("finance_trips" as any).update(sanitizeTrip(rest) as any).eq("id", id);
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

  useEffect(() => {
    const channel = supabase
      .channel(`travel-live-${selectedCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_trips" }, () => qc.invalidateQueries({ queryKey: ["trips"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_trip_categories" }, () => qc.invalidateQueries({ queryKey: ["trip-categories"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_travel_profile" }, () => qc.invalidateQueries({ queryKey: ["travel-profile"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, selectedCompanyId]);

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
