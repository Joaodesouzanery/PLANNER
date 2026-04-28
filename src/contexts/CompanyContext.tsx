import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  color: string | null;
  description: string | null;
  relationship_stage?: string | null;
  relationship_priority?: string | null;
  relationship_health?: string | null;
  relationship_next_action_date?: string | null;
  relationship_notes?: string | null;
  user_id: string | null;
  created_at: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompanyId: string; // "all" or uuid
  setSelectedCompanyId: (id: string) => void;
  selectedCompany: Company | null;
  isLoading: boolean;
  refetchCompanies: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = "ems-selected-company";

export const CompanyProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "all";
  });

  const queryClient = useQueryClient();

  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  const setSelectedCompanyId = (id: string) => {
    setSelectedCompanyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || null;

  // If selected company no longer exists, reset to "all"
  useEffect(() => {
    if (selectedCompanyId !== "all" && companies.length > 0 && !selectedCompany) {
      setSelectedCompanyId("all");
    }
  }, [companies, selectedCompanyId, selectedCompany]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        setSelectedCompanyId,
        selectedCompany,
        isLoading,
        refetchCompanies: refetch,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
};

// Helper: builds a Supabase query filter for company_id
export const applyCompanyFilter = (query: any, selectedCompanyId: string) => {
  if (selectedCompanyId !== "all") {
    return query.eq("company_id", selectedCompanyId);
  }
  return query;
};
