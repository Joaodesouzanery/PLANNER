import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const DAY = 1000 * 60 * 60 * 24;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayStr = () => iso(new Date());
const daysAgo = (n: number) => iso(new Date(Date.now() - n * DAY));
const daysAhead = (n: number) => iso(new Date(Date.now() + n * DAY));
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export type HealthStatus = "green" | "yellow" | "red";

export interface HealthDimension {
  key: "financial" | "risk" | "governance" | "compliance";
  label: string;
  score: number;
  status: HealthStatus;
  reason: string;
}

const statusFor = (score: number): HealthStatus => (score >= 75 ? "green" : score >= 50 ? "yellow" : "red");

/** Wrapper que degrada para [] caso a tabela ainda nao exista (migration nao aplicada). */
const safeSelect = async (build: () => any): Promise<any[]> => {
  try {
    const { data, error } = await build();
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
};

export function useBoardHealth() {
  const { selectedCompanyId } = useCompany();
  const hasCompanyFilter = selectedCompanyId !== "all";
  const persistedRef = useRef<string | null>(null);
  const companyFilter = (q: any) => (hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q);

  const { data: transactions = [], isLoading: l1 } = useQuery({
    queryKey: ["health-transactions", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("financial_transactions").select("amount,type,date").gte("date", daysAgo(120)),
    )),
  });

  const { data: risks = [], isLoading: l2 } = useQuery({
    queryKey: ["health-risks", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("board_risks").select("score,status,review_date").neq("status", "closed"),
    )),
  });

  const { data: occurrences = [], isLoading: l3 } = useQuery({
    queryKey: ["health-occurrences", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("board_obligation_occurrences").select("due_date,status").eq("status", "pending").lte("due_date", daysAhead(20)),
    )),
  });

  const { data: docs = [], isLoading: l4 } = useQuery({
    queryKey: ["health-docs", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("attachments").select("expires_at").not("expires_at", "is", null).lte("expires_at", daysAhead(15)),
    )),
  });

  const { data: govItems = [], isLoading: l5 } = useQuery({
    queryKey: ["health-governance", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("governance_items").select("priority,status").in("priority", ["high", "critical"]),
    )),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["health-reviews", selectedCompanyId],
    staleTime: 1000 * 60 * 5,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("review_cycles").select("period_start").order("period_start", { ascending: false }).limit(1),
    )),
  });

  const { data: backups = [] } = useQuery({
    queryKey: ["health-backups", selectedCompanyId],
    staleTime: 1000 * 60 * 5,
    queryFn: () => safeSelect(() => companyFilter(
      (supabase as any).from("board_backup_logs").select("backup_date").eq("status", "success").order("backup_date", { ascending: false }).limit(1),
    )),
  });

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const result = useMemo(() => {
    const today = todayStr();
    const sum = (rows: any[], pred: (r: any) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + Number(r.amount || 0), 0);
    const net = (fromDays: number, toDays = 0) => {
      const from = daysAgo(fromDays);
      const to = daysAgo(toDays);
      const inRange = (transactions as any[]).filter((t) => t.date >= from && t.date <= to);
      return sum(inRange, (t) => t.type === "income") - sum(inRange, (t) => t.type === "expense");
    };

    // FINANCEIRO
    const net30 = net(30);
    const net90 = net(90);
    const netPrev30 = net(60, 30);
    let financial = 100;
    if (net90 < 0) financial -= 25;
    if (net30 < 0) financial -= 25;
    if (net30 < netPrev30) financial -= 10;
    financial = clamp(financial);

    // RISCO
    const openRisks = risks as any[];
    const sumScore = openRisks.reduce((s, r) => s + Number(r.score || 0), 0);
    const criticalUnreviewed = openRisks.filter((r) => Number(r.score) >= 16 && (!r.review_date || r.review_date < today)).length;
    const risk = clamp(100 - sumScore * 1.5 - criticalUnreviewed * 5);

    // COMPLIANCE
    const occ = occurrences as any[];
    const overdueObl = occ.filter((o) => o.due_date < today).length;
    const upcomingObl = occ.filter((o) => o.due_date >= today).length;
    const expiredDocs = (docs as any[]).filter((d) => d.expires_at < today).length;
    const compliance = clamp(100 - Math.min(60, overdueObl * 15) - Math.min(15, upcomingObl * 3) - Math.min(30, expiredDocs * 10));

    // GOVERNANCA
    const criticalGov = (govItems as any[]).filter((g) => !["done", "archived"].includes(g.status)).length;
    const lastReview = (reviews as any[])[0]?.period_start;
    const daysSinceReview = lastReview ? Math.floor((Date.now() - new Date(`${lastReview}T12:00:00`).getTime()) / DAY) : 999;
    const lastBackup = (backups as any[])[0]?.backup_date;
    const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(`${lastBackup}T12:00:00`).getTime()) / DAY) : 999;
    let governance = 100;
    governance -= Math.min(25, criticalGov * 5);
    if (daysSinceReview > 35) governance -= 20;
    if (daysSinceBackup > 30) governance -= 40;
    else if (daysSinceBackup > 7) governance -= 20;
    governance = clamp(governance);

    const overall = clamp(financial * 0.3 + risk * 0.25 + compliance * 0.25 + governance * 0.2);

    const dimensions: HealthDimension[] = [
      { key: "financial", label: "Financeiro", score: financial, status: statusFor(financial), reason: `Caixa 30d ${net30 >= 0 ? "+" : ""}${net30.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` },
      { key: "risk", label: "Risco", score: risk, status: statusFor(risk), reason: `${openRisks.length} riscos abertos · ${criticalUnreviewed} críticos s/ revisão` },
      { key: "governance", label: "Governança", score: governance, status: statusFor(governance), reason: `${criticalGov} pendências · backup há ${daysSinceBackup > 900 ? "—" : `${daysSinceBackup}d`}` },
      { key: "compliance", label: "Compliance", score: compliance, status: statusFor(compliance), reason: `${overdueObl} obrigações atrasadas · ${expiredDocs} docs vencidos` },
    ];

    const inputs = { net30, net90, openRisks: openRisks.length, criticalUnreviewed, overdueObl, upcomingObl, expiredDocs, criticalGov, daysSinceReview, daysSinceBackup };

    return { overall, status: statusFor(overall), dimensions, inputs };
  }, [transactions, risks, occurrences, docs, govItems, reviews, backups]);

  // Persiste 1 snapshot/dia (upsert manual para tratar company_id null).
  useEffect(() => {
    if (isLoading) return;
    const snapshotDate = todayStr();
    const key = `${selectedCompanyId}:${snapshotDate}:${result.overall}`;
    if (persistedRef.current === key) return;
    persistedRef.current = key;
    const companyId = hasCompanyFilter ? selectedCompanyId : null;
    const dims = Object.fromEntries(result.dimensions.map((d) => [d.key, d.score]));
    const payload = {
      company_id: companyId,
      snapshot_date: snapshotDate,
      overall_score: result.overall,
      financial_score: dims.financial,
      risk_score: dims.risk,
      governance_score: dims.governance,
      compliance_score: dims.compliance,
      overall_status: result.status,
      inputs: result.inputs,
    };
    (async () => {
      try {
        let existingQ = (supabase as any).from("board_health_snapshots").select("id").eq("snapshot_date", snapshotDate);
        existingQ = companyId ? existingQ.eq("company_id", companyId) : existingQ.is("company_id", null);
        const { data: existing } = await existingQ.limit(1);
        const table = (supabase as any).from("board_health_snapshots");
        if (existing && existing[0]?.id) await table.update(payload).eq("id", existing[0].id);
        else await table.insert(payload);
      } catch {
        /* degrada silenciosamente se a tabela ainda nao existir */
      }
    })();
  }, [isLoading, result, selectedCompanyId, hasCompanyFilter]);

  return { ...result, isLoading };
}
