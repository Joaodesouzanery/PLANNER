import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RoutineClientView } from "@/hooks/useRotinas";

const dateBR = (iso: string) => format(new Date(`${iso}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });

const invoiceLine = (view: RoutineClientView): string | null => {
  const { client, daysUntilInvoice } = view;
  if (!client.invoice_day || daysUntilInvoice === null) return null;
  const quando = daysUntilInvoice === 0 ? "é hoje" : daysUntilInvoice === 1 ? "é amanhã" : `faltam ${daysUntilInvoice} dias`;
  return `Nota Fiscal: dia ${client.invoice_day} de cada mês (${quando}).`;
};

const priorityLabel: Record<string, string> = { urgent: "urgente", high: "alta", medium: "média", low: "baixa" };

/** Relatorio interno do dia para um cliente (template deterministico, sem IA). */
export const buildDailyReport = (view: RoutineClientView): string => {
  const { client, conferencias, tarefas, doneItemIds, doneTodayTasks, openTasks } = view;
  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  const lines: string[] = [];

  lines.push(`Relatório diário — ${client.name}`);
  lines.push(today);
  lines.push("");

  const checklistDone = [...conferencias, ...tarefas].filter((i) => doneItemIds.has(i.id));
  const checklistPending = [...conferencias, ...tarefas].filter((i) => !doneItemIds.has(i.id));

  lines.push("Conferências e tarefas do dia:");
  if (checklistDone.length) checklistDone.forEach((i) => lines.push(`  [x] ${i.title}`));
  if (checklistPending.length) checklistPending.forEach((i) => lines.push(`  [ ] ${i.title}`));
  if (!checklistDone.length && !checklistPending.length) lines.push("  (nenhum item configurado)");
  lines.push("");

  lines.push("Concluído hoje:");
  if (doneTodayTasks.length) doneTodayTasks.forEach((t) => lines.push(`  - ${t.title}`));
  else lines.push("  (sem tarefas concluídas hoje)");
  lines.push("");

  lines.push("Pendências em aberto:");
  if (openTasks.length) {
    openTasks.forEach((t) => {
      const venc = t.due_date ? ` — vence ${dateBR(t.due_date)}` : "";
      const prio = priorityLabel[t.priority] ? ` (prioridade ${priorityLabel[t.priority]})` : "";
      lines.push(`  - ${t.title}${prio}${venc}`);
    });
  } else {
    lines.push("  (nenhuma pendência em aberto)");
  }
  lines.push("");

  lines.push("Próximas etapas:");
  if (openTasks.length) openTasks.slice(0, 3).forEach((t) => lines.push(`  - ${t.title}`));
  else lines.push("  - Definir próximos passos.");

  const nf = invoiceLine(view);
  if (nf) {
    lines.push("");
    lines.push(nf);
  }

  return lines.join("\n");
};

/** Mensagem cordial pronta para enviar ao cliente (para se resguardar). */
export const buildClientMessage = (view: RoutineClientView): string => {
  const { client, doneTodayTasks, openTasks } = view;
  const lines: string[] = [];

  lines.push(`Olá! Passando o status de hoje referente à ${client.name}.`);
  lines.push("");

  if (doneTodayTasks.length) {
    lines.push("Concluído hoje:");
    doneTodayTasks.forEach((t) => lines.push(`• ${t.title}`));
    lines.push("");
  }

  if (openTasks.length) {
    lines.push("Próximas etapas:");
    openTasks.slice(0, 4).forEach((t) => {
      const venc = t.due_date ? ` (até ${dateBR(t.due_date)})` : "";
      lines.push(`• ${t.title}${venc}`);
    });
    lines.push("");
  }

  const nf = invoiceLine(view);
  if (nf) {
    lines.push(`Lembrete — ${nf}`);
    lines.push("");
  }

  lines.push("Qualquer dúvida, estou à disposição. Obrigado!");

  return lines.join("\n");
};
