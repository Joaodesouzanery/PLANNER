import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Phase, Item, Tracking, Contact, ContactMeta } from "./types";

export const useCommercialData = () => {
  const queryClient = useQueryClient();

  const { data: phases = [] } = useQuery({
    queryKey: ["commercial-phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commercial_phases").select("*").order("order_index");
      if (error) throw error;
      return data as Phase[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["commercial-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commercial_items").select("*").order("order_index");
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, name, email, phone, company, pipeline_stage, created_at").order("name");
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: allMeta = [] } = useQuery({
    queryKey: ["commercial-contact-meta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commercial_contact_meta").select("*");
      if (error) throw error;
      return data as ContactMeta[];
    },
  });

  const { data: allTracking = [] } = useQuery({
    queryKey: ["commercial-tracking-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_commercial_tracking").select("*");
      if (error) throw error;
      return data as Tracking[];
    },
  });

  const leafItems = useMemo(() => {
    const parentIds = new Set(items.filter(i => i.parent_item_id).map(i => i.parent_item_id));
    return items.filter(i => !parentIds.has(i.id));
  }, [items]);

  const getContactProgress = (contactId: string) => {
    const contactTracking = allTracking.filter(t => t.contact_id === contactId);
    const total = leafItems.length;
    if (total === 0) return 0;
    const completed = contactTracking.filter(t => t.status === "completed").length;
    return Math.round((completed / total) * 100);
  };

  const getPhaseItems = (phaseId: string) => {
    return items.filter(i => i.phase_id === phaseId && !i.parent_item_id).sort((a, b) => a.order_index - b.order_index);
  };

  const getChildItems = (parentId: string) => {
    return items.filter(i => i.parent_item_id === parentId).sort((a, b) => a.order_index - b.order_index);
  };

  const isLeafItem = (itemId: string) => leafItems.some(i => i.id === itemId);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["commercial-phases"] });
    queryClient.invalidateQueries({ queryKey: ["commercial-items"] });
    queryClient.invalidateQueries({ queryKey: ["commercial-tracking-all"] });
  };

  return {
    phases, items, contacts, allTracking, leafItems,
    getContactProgress, getPhaseItems, getChildItems, isLeafItem,
    invalidateAll, queryClient,
  };
};
