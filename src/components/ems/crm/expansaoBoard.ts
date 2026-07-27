// Board de expansão (land & expand) — derivado, sem tabela nova. Puro/testável.
// Para um produto: cada conta LANDED (≥1 módulo de aquisição ganho) vira um pipeline de upsell dos
// módulos ainda abertos. Ordena por prova disponível (nº de módulos ativos — conta com resultado
// medido no módulo A é a mais fácil de expandir para o B).

export interface ExpansaoDeal { customer_id: string | null; modulo_id: string | null; status_outcome: string | null }
export interface ExpansaoModulo { id: string; name: string; tipo: "aquisicao" | "retencao" }
export interface ExpansaoCliente { id: string; nome: string }

export interface ExpansaoRow {
  cliente: ExpansaoCliente;
  ativos: { id: string; name: string }[]; // módulos de aquisição já ganhos (a prova)
  abertos: { id: string; name: string }[]; // módulos de aquisição ainda não ganhos (o upsell)
  provaScore: number; // = ativos.length
}

export const computeExpansao = (
  clientes: ExpansaoCliente[],
  deals: ExpansaoDeal[],
  modulos: ExpansaoModulo[],
): ExpansaoRow[] => {
  const aquisicao = modulos.filter((m) => m.tipo === "aquisicao");
  if (aquisicao.length === 0) return [];

  // customer_id → set de módulos GANHOS
  const wonByCustomer = new Map<string, Set<string>>();
  for (const d of deals) {
    if (d.status_outcome === "won" && d.customer_id && d.modulo_id) {
      const set = wonByCustomer.get(d.customer_id) ?? new Set<string>();
      set.add(d.modulo_id);
      wonByCustomer.set(d.customer_id, set);
    }
  }

  const rows: ExpansaoRow[] = [];
  for (const c of clientes) {
    const won = wonByCustomer.get(c.id);
    if (!won || won.size === 0) continue;
    const ativos = aquisicao.filter((m) => won.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
    if (ativos.length === 0) continue; // só ganhou módulo de retenção → ainda não é conta landed
    const abertos = aquisicao.filter((m) => !won.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
    rows.push({ cliente: c, ativos, abertos, provaScore: ativos.length });
  }

  // Mais prova primeiro; empate → mais módulos abertos (mais upsell na mesa).
  return rows.sort((a, b) => b.provaScore - a.provaScore || b.abertos.length - a.abertos.length);
};
