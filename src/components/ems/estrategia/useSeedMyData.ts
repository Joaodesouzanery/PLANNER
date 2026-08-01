import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  SEED_CLIENTES, SEED_RECEITA, SEED_CUSTOS, SEED_DIVIDA_MENSAL, SEED_DIVIDAS, SEED_TETOS,
  SEED_SETTINGS, SEED_ACCOUNTS, SEED_NETWORTH_ASSETS, SEED_SINKING, SEED_ALIASES,
  buildSeedConfig, buildSeedEstrategia, quarterKey,
} from "./seedData";

// Regra-Mestre · "Carregar meus dados" (client-side, idempotente). Escreve nas tabelas de finanças/estratégia
// (fonte única) com dedup por chave natural — rodar 2× não duplica. Transações levam source_type='seed'
// pra permitir "Limpar dados carregados". Escopo consolidado (company_id null).
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};
const lc = (s: any) => String(s ?? "").toLowerCase();

export interface SeedSummary { criados: number; pulados: number; }

export const useSeedMyData = () => {
  const qc = useQueryClient();
  // Trava anti-duplo-clique: mesmo com dois cliques rápidos, só uma execução roda de fato.
  const running = useRef(false);

  // Status: quantas transações do seed existem (pra UI mostrar "carregado").
  const status = useQuery({
    queryKey: ["seed-status"],
    staleTime: 30_000,
    queryFn: async () => (await safe(() => db.from("financial_transactions").select("id").eq("source_type", "seed"))).length,
  });

  const run = useMutation({
    mutationFn: async (): Promise<SeedSummary> => {
      if (running.current) return { criados: 0, pulados: 0 };
      running.current = true;
      try {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonthNum = now.getMonth() + 1;
      const s: SeedSummary = { criados: 0, pulados: 0 };
      const bump = (created: boolean) => { created ? s.criados++ : s.pulados++; };

      // 1) config timeline (pró-labore / tax_rate datados). Dedup pela NOTE (estável): a vigência "de hoje"
      // tem effective_date variável, então dedup por data duplicaria a cada dia. Notas do seed são únicas.
      const cfgNotes = new Set((await safe(() => db.from("finance_config_timeline").select("note"))).map((r) => r.note).filter(Boolean));
      for (const c of buildSeedConfig(today)) {
        if (c.note && cfgNotes.has(c.note)) { bump(false); continue; }
        const { error } = await db.from("finance_config_timeline").insert({ key: c.key, value: c.value, effective_date: c.effective_date, note: c.note ?? null, company_id: null });
        if (!error && c.note) cfgNotes.add(c.note);
        bump(!error);
      }

      // 2) finance_settings — só cria se não existir (não sobrescreve config do usuário)
      const hasSettings = (await safe(() => db.from("finance_settings").select("id"))).length > 0;
      if (!hasSettings) { const { error } = await db.from("finance_settings").insert({ ...SEED_SETTINGS }); bump(!error); }
      else bump(false);

      // 3) clientes (dedup por nome)
      const cliByName = new Map<string, string>();
      for (const r of await safe(() => db.from("finance_clientes").select("id,nome"))) cliByName.set(lc(r.nome), r.id);
      for (const cl of SEED_CLIENTES) {
        if (cliByName.has(lc(cl.nome))) { bump(false); continue; }
        const { data, error } = await db.from("finance_clientes").insert({ nome: cl.nome, recorrente: cl.recorrente }).select("id").single();
        if (!error && data) cliByName.set(lc(cl.nome), data.id);
        bump(!error);
      }

      // 4) transações: receita + custos + dívida mensal — UPSERT de verdade (chave natural):
      //    a) descrição normalizada, b) apelido de lançamento legado (SEED_ALIASES),
      //    c) receita recorrente do MESMO cliente. Se achar, ATUALIZA (valor/categoria/recorrência)
      //    em vez de criar uma segunda linha — era daí que vinha a duplicação. Rodar 2× = mesmo resultado.
      const existing = await safe(() => db.from("financial_transactions").select("id,description,amount,type,cliente_id,is_recurring,source_type"));
      const byDesc = new Map<string, any>();
      for (const t of existing) if (!byDesc.has(lc(t.description))) byDesc.set(lc(t.description), t);
      const findMatch = (row: Record<string, any>) => {
        const key = lc(row.description);
        const direct = byDesc.get(key);
        if (direct) return direct;
        for (const alias of SEED_ALIASES[key] ?? []) {
          const hit = byDesc.get(alias);
          if (hit && hit.type === row.type) return hit;
        }
        if (row.type === "income" && row.cliente_id) {
          const hit = existing.find((t: any) => t.type === "income" && t.cliente_id === row.cliente_id && t.is_recurring);
          if (hit) return hit;
        }
        return null;
      };
      const upsertTx = async (row: Record<string, unknown>) => {
        const match = findMatch(row);
        if (match) {
          const { error } = await db.from("financial_transactions").update({
            amount: row.amount, category: row.category, is_recurring: true, recurrence_interval: "monthly",
            recurrence_end_date: row.recurrence_end_date ?? null, cliente_id: row.cliente_id ?? match.cliente_id ?? null,
          }).eq("id", match.id);
          if (!error) bump(false);
          return;
        }
        const { data, error } = await db.from("financial_transactions").insert(row).select("id,description,amount,type,cliente_id,is_recurring").single();
        if (!error && data) { existing.push(data); byDesc.set(lc(data.description), data); }
        bump(!error);
      };
      for (const r of SEED_RECEITA) await upsertTx({
        description: r.description, amount: r.amount, type: "income", category: "Receita — Cliente",
        date: today, due_date: today, status: "confirmed", is_recurring: true, recurrence_interval: "monthly",
        recurrence_end_date: r.endDate ?? null, cliente_id: cliByName.get(lc(r.cliente)) ?? null, company_id: null, source_type: "seed",
      });
      for (const c of SEED_CUSTOS) await upsertTx({
        description: c.description, amount: c.amount, type: "expense", category: c.category,
        date: today, due_date: today, status: "confirmed", is_recurring: true, recurrence_interval: "monthly",
        recurrence_end_date: c.endDate ?? null, company_id: null, source_type: "seed",
      });
      await upsertTx({
        description: SEED_DIVIDA_MENSAL.description, amount: SEED_DIVIDA_MENSAL.amount, type: "expense", category: SEED_DIVIDA_MENSAL.category,
        date: today, due_date: today, status: "confirmed", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, company_id: null, source_type: "seed",
      });

      // 5) patrimônio: entidade CPF → conta savings; ativos/dívidas (networth); reserva (sinking)
      let cpf = (await safe(() => db.from("finance_entities").select("id").eq("entity_type", "cpf").limit(1)))[0];
      if (!cpf) { const { data } = await db.from("finance_entities").insert({ entity_type: "cpf", name: "Pessoal", is_default: true }).select("id").single(); cpf = data; }
      const accSet = new Set((await safe(() => db.from("finance_accounts").select("name"))).map((a) => lc(a.name)));
      for (const a of SEED_ACCOUNTS) {
        if (accSet.has(lc(a.name))) { bump(false); continue; }
        const { error } = await db.from("finance_accounts").insert({ entity_id: cpf?.id, name: a.name, account_type: a.account_type, opening_balance: a.opening_balance, opening_balance_date: today, company_id: null });
        bump(!error);
      }
      const nwSet = new Set((await safe(() => db.from("finance_networth_items").select("label"))).map((n) => lc(n.label)));
      const insertNw = async (row: Record<string, unknown>) => {
        if (nwSet.has(lc(row.label))) { bump(false); return; }
        const { error } = await db.from("finance_networth_items").insert(row);
        if (!error) nwSet.add(lc(row.label));
        bump(!error);
      };
      for (const a of SEED_NETWORTH_ASSETS) await insertNw({ kind: "asset", label: a.label, category: a.category, value: a.value });
      for (const d of SEED_DIVIDAS) await insertNw({ kind: "liability", label: d.label, category: "divida", value: d.value });
      const sfSet = new Set((await safe(() => db.from("finance_sinking_funds").select("title"))).map((f) => lc(f.title)));
      for (const f of SEED_SINKING) {
        if (sfSet.has(lc(f.title))) { bump(false); continue; }
        const { error } = await db.from("finance_sinking_funds").insert({ title: f.title, target: f.target, monthly: f.monthly, balance: f.balance });
        bump(!error);
      }

      // 6) tetos (mês corrente)
      const budSet = new Set((await safe(() => db.from("finance_category_budgets").select("category").eq("year", curYear).eq("month", curMonthNum))).map((b) => lc(b.category)));
      for (const t of SEED_TETOS) {
        if (budSet.has(lc(t.category))) { bump(false); continue; }
        const { error } = await db.from("finance_category_budgets").insert({ category: t.category, year: curYear, month: curMonthNum, teto: t.teto });
        bump(!error);
      }

      // 7) estratégia (cascata BHAG → Objetivo → KR → Ação)
      const est = buildSeedEstrategia(curYear, quarterKey(today));
      const visoes = await safe(() => db.from("estrategia_visao").select("id,titulo"));
      let visId = visoes.find((v) => v.titulo === est.visao.titulo)?.id;
      if (!visId) {
        const { data } = await db.from("estrategia_visao").insert({ titulo: est.visao.titulo, horizonte: est.visao.horizonte, metrica_alvo: est.visao.metrica_alvo, valor_alvo: est.visao.valor_alvo, prazo: est.visao.prazo, company_id: null }).select("id").single();
        visId = data?.id; bump(!!visId);
      } else bump(false);
      if (visId) {
        const objByTit = new Map((await safe(() => db.from("estrategia_objetivo").select("id,titulo").eq("visao_id", visId))).map((o) => [o.titulo, o.id]));
        for (const o of est.objetivos) {
          let objId = objByTit.get(o.titulo);
          if (!objId) {
            const { data } = await db.from("estrategia_objetivo").insert({ visao_id: visId, ano: est.ano, titulo: o.titulo, tipo: o.tipo, metrica: o.metrica ?? null, alvo: o.alvo ?? null, company_id: null }).select("id").single();
            objId = data?.id; bump(!!objId);
          } else bump(false);
          if (!objId) continue;
          const krByDesc = new Map((await safe(() => db.from("estrategia_kr").select("id,descricao").eq("objetivo_id", objId))).map((k) => [k.descricao, k.id]));
          for (const kr of o.krs) {
            let krId = krByDesc.get(kr.descricao);
            if (!krId) {
              const { data } = await db.from("estrategia_kr").insert({ objetivo_id: objId, trimestre: kr.trimestre ?? null, descricao: kr.descricao, tipo: kr.tipo, company_id: null }).select("id").single();
              krId = data?.id; bump(!!krId);
            } else bump(false);
            if (!krId) continue;
            const acSet = new Set((await safe(() => db.from("estrategia_acao").select("descricao").eq("key_result_id", krId))).map((a) => a.descricao));
            for (const ac of kr.acoes) {
              if (acSet.has(ac.descricao)) { bump(false); continue; }
              const { error } = await db.from("estrategia_acao").insert({ key_result_id: krId, descricao: ac.descricao, status: "todo", company_id: null });
              bump(!error);
            }
          }
        }
      }

      return s;
    },
    onSuccess: (s) => { qc.invalidateQueries(); toast({ title: "Dados carregados", description: `${s.criados} criados · ${s.pulados} já existiam` }); },
    onError: (e: any) => toast({ title: "Erro ao carregar dados", description: e?.message, variant: "destructive" }),
  });

  // Limpar tudo que o seed cria (por chave natural). Reverte um preenchimento fresco.
  const clear = useMutation({
    mutationFn: async () => {
      await db.from("financial_transactions").delete().eq("source_type", "seed");
      // estratégia: objetivo.visao_id é ON DELETE SET NULL (não cascade), então apago os objetivos do seed
      // primeiro (que cascateiam em kr/ação) e depois a visão — senão sobram órfãos.
      const seedTitulo = buildSeedEstrategia(new Date().getFullYear(), "").visao.titulo;
      for (const v of (await safe(() => db.from("estrategia_visao").select("id,titulo"))).filter((v) => v.titulo === seedTitulo)) {
        await db.from("estrategia_objetivo").delete().eq("visao_id", v.id);
        await db.from("estrategia_visao").delete().eq("id", v.id);
      }
      // config datada do seed (pelas notas conhecidas)
      const seedNotes = buildSeedConfig("2000-01-01").map((c) => c.note).filter(Boolean);
      if (seedNotes.length) await db.from("finance_config_timeline").delete().in("note", seedNotes as string[]);
      // patrimônio, reserva, contas, clientes, tetos — por chave natural
      await db.from("finance_networth_items").delete().in("label", [...SEED_NETWORTH_ASSETS.map((a) => a.label), ...SEED_DIVIDAS.map((d) => d.label)]);
      await db.from("finance_sinking_funds").delete().in("title", SEED_SINKING.map((f) => f.title));
      await db.from("finance_accounts").delete().in("name", SEED_ACCOUNTS.map((a) => a.name));
      await db.from("finance_clientes").delete().in("nome", SEED_CLIENTES.map((c) => c.nome));
      const now = new Date();
      await db.from("finance_category_budgets").delete().eq("year", now.getFullYear()).eq("month", now.getMonth() + 1).in("category", SEED_TETOS.map((t) => t.category));
    },
    onSuccess: () => { qc.invalidateQueries(); toast({ title: "Dados carregados removidos" }); },
    onError: (e: any) => toast({ title: "Erro ao limpar", description: e?.message, variant: "destructive" }),
  });

  return { run, clear, loadedCount: status.data ?? 0, isLoading: status.isLoading };
};
