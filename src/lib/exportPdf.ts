// Helpers de exportação reutilizáveis (PDF via jsPDF/autoTable, imagens de
// gráficos via html2canvas e CSV). Imports dinâmicos para não pesar o bundle.

export interface PdfSection {
  heading?: string;
  head?: (string | number)[][];
  body: (string | number)[][];
}

export interface PdfImage {
  heading?: string;
  dataUrl: string;
  /** largura em mm (default: largura útil da página) */
  width?: number;
  /** altura em mm (default: 70) */
  height?: number;
}

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  filename: string;
  sections?: PdfSection[];
  images?: PdfImage[];
  orientation?: "portrait" | "landscape";
}

/** Captura um elemento (ex.: container de gráfico Recharts) como PNG dataURL. */
export const captureChart = async (el: HTMLElement | null): Promise<string | null> => {
  if (!el) return null;
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, { backgroundColor: "#0b0f17", scale: 2 });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("captureChart falhou", err);
    return null;
  }
};

/** Gera um PDF com imagens (opcionais) seguidas de seções de tabela. */
export const exportTablePdf = async ({
  title,
  subtitle,
  filename,
  sections = [],
  images = [],
  orientation = "portrait",
}: ExportPdfOptions) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.text(title, 14, 18);
  let y = 26;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 24);
    doc.setTextColor(0);
    y = 32;
  }

  for (const img of images) {
    const w = img.width ?? pageW - 28;
    const h = img.height ?? 70;
    if (img.heading) {
      if (y > pageH - 24) { doc.addPage(); y = 18; }
      doc.setFontSize(12);
      doc.text(img.heading, 14, y);
      y += 4;
    }
    if (y + h > pageH - 12) { doc.addPage(); y = 18; }
    doc.addImage(img.dataUrl, "PNG", 14, y, w, h);
    y += h + 6;
  }

  for (const s of sections) {
    if (s.heading) {
      if (y > pageH - 24) { doc.addPage(); y = 18; }
      doc.setFontSize(12);
      doc.text(s.heading, 14, y);
      y += 3;
    }
    autoTable(doc, {
      startY: y,
      head: s.head?.map((r) => r.map(String)),
      body: s.body.map((r) => r.map(String)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${total}`, pageW - 30, pageH - 8);
  }
  doc.setTextColor(0);
  doc.save(filename);
};

/** Exporta linhas como CSV (UTF-8 com BOM, compatível com Excel pt-BR). */
export const exportCsv = (
  filename: string,
  headers: (string | number)[],
  rows: (string | number)[][],
) => {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
