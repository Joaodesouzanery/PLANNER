import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  FunnelStage,
  PlaybookData,
  SalesStackItem,
  KpisData,
  CommissionData,
} from "@/hooks/useCompanyCommercialStructure";

interface ExportData {
  companyName: string;
  funnel: FunnelStage[];
  b2g: PlaybookData;
  b2b: PlaybookData;
  stack: SalesStackItem[];
  kpis: KpisData;
  commission: CommissionData;
}

export function exportCommercialStructurePdf(data: ExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addTitle = (text: string, size = 16) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.text(text, 14, y);
    y += size * 0.6;
  };

  const addSubtitle = (text: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(text, 14, y);
    y += 8;
  };

  const addText = (text: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5;
  };

  const addSpacer = (h = 6) => { y += h; };

  // ─── Header ───
  addTitle(`Estrutura Comercial — ${data.companyName}`, 18);
  addText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`);
  addSpacer(4);

  // ─── Funil ───
  addTitle("Funil de Vendas");
  autoTable(doc, {
    startY: y,
    head: [["#", "Etapa", "Responsável", "Descrição", "B2G", "B2B"]],
    body: data.funnel.map((s) => [
      String(s.step), s.title, s.responsible,
      s.desc.substring(0, 80), s.b2g.substring(0, 60), s.b2b.substring(0, 60),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── Playbook B2G ───
  addTitle("Playbook B2G");
  addSubtitle("Mensagem Central");
  addText(`Título: ${data.b2g.message.title}`);
  addText(`Foco: ${data.b2g.message.focus}`);
  addText(`Linguagem: ${data.b2g.message.language}`);
  addSpacer();
  addSubtitle("Stakeholders");
  (data.b2g.prospecting.stakeholders || []).forEach((s) => addText(`• ${s}`));
  addSubtitle("Canais");
  data.b2g.prospecting.channels.forEach((c) => addText(`• ${c}`));
  addSubtitle("Qualificação Adicional");
  data.b2g.prospecting.extra.forEach((e) => addText(`• ${e}`));
  addSubtitle("Abordagem de Vendas");
  data.b2g.sales.forEach((s) => addText(`• ${s}`));
  addSpacer();

  // ─── Playbook B2B ───
  if (y > 200) { doc.addPage(); y = 20; }
  addTitle("Playbook B2B");
  addSubtitle("Mensagem Central");
  addText(`Título: ${data.b2b.message.title}`);
  addText(`Foco: ${data.b2b.message.focus}`);
  addText(`Linguagem: ${data.b2b.message.language}`);
  addSpacer();
  addSubtitle("Contas-Alvo");
  (data.b2b.prospecting.accounts || []).forEach((s) => addText(`• ${s}`));
  addSubtitle("Canais");
  data.b2b.prospecting.channels.forEach((c) => addText(`• ${c}`));
  addSubtitle("Qualificação Adicional");
  data.b2b.prospecting.extra.forEach((e) => addText(`• ${e}`));
  addSubtitle("Abordagem de Vendas");
  data.b2b.sales.forEach((s) => addText(`• ${s}`));
  addSpacer();

  // ─── Sales Stack ───
  if (y > 220) { doc.addPage(); y = 20; }
  addTitle("Sales Stack");
  autoTable(doc, {
    startY: y,
    head: [["Ferramenta", "Descrição", "Exemplos"]],
    body: data.stack.map((t) => [t.title, t.desc, t.examples]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 92, 246] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── KPIs ───
  if (y > 220) { doc.addPage(); y = 20; }
  addTitle("KPIs por Papel");
  const kpiRows: string[][] = [];
  data.kpis.bdr.forEach((k) => kpiRows.push(["SDR/BDR", k]));
  data.kpis.ae.forEach((k) => kpiRows.push(["AE", k]));
  data.kpis.csm.forEach((k) => kpiRows.push(["CSM", k]));
  autoTable(doc, {
    startY: y,
    head: [["Papel", "KPI"]],
    body: kpiRows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── Comissão ───
  if (y > 220) { doc.addPage(); y = 20; }
  addTitle("Modelo de Comissionamento");
  data.commission.roles.forEach((r) => {
    addSubtitle(`${r.role} (Base: ${r.base} | Variável: ${r.variable})`);
    r.items.forEach((item) => addText(`• ${item}`));
    addSpacer(3);
  });
  addSubtitle("Considerações");
  data.commission.considerations.forEach((c) => addText(`• ${c}`));

  doc.save(`estrutura-comercial-${data.companyName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
