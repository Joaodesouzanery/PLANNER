// Rotina semanal por canal — tipos + template. Puro (sem React/Supabase).

export interface RotinaBloco {
  id?: string;
  weekday: number; // 1=Seg .. 7=Dom
  canal: string | null;
  titulo: string;
  modulo_id: string | null;
  order_index: number;
  done_week: string | null; // 2ª-feira (yyyy-MM-dd) em que foi marcado feito
}

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo",
};

export const CANAL_SUGGESTIONS = [
  "Posts", "Grupos LinkedIn", "Vagas LinkedIn", "Contatos recebidos", "E-mail + LinkedIn",
  "Respostas", "Follow-up", "Scraping", "Fechamento", "Retenção", "Revisão",
];

// A semana dos docs (Seg=abrir/topo · Ter–Qui=motor de contato · Sex=fechar e aprender).
const D = (weekday: number, canal: string, titulo: string): Omit<RotinaBloco, "order_index" | "done_week"> => ({ weekday, canal, titulo, modulo_id: null });

export const DEFAULT_ROTINA: RotinaBloco[] = [
  D(1, "Posts", "Publicar os posts da semana (um ângulo de módulo por post)"),
  D(1, "Grupos LinkedIn", "Distribuir o post/PDF do módulo nos grupos certos — levar valor, não vender"),
  D(1, "Vagas LinkedIn", "Varrer vagas que sinalizam projeto ativo → criar contas (fonte: vaga)"),
  D(1, "Scraping", "Scraping de prédios → contas de Manutenção Predial (fonte: prédio)"),
  D(2, "Contatos recebidos", "Abordar a lista morna primeiro, amarrando cada um ao módulo da dor"),
  D(2, "E-mail + LinkedIn", "Abordar as contas novas da segunda (abertura < 15 palavras + PDF do módulo)"),
  D(3, "Respostas", "Tratar respostas no mesmo dia: classificar, enviar o documento-ímã, marcar conversa"),
  D(3, "Follow-up", "1 follow-up após 48h de quem sumiu; depois, para"),
  D(4, "E-mail + LinkedIn", "Continuar o motor de contato + tratar respostas no mesmo dia"),
  D(5, "Fechamento", "Calls de fechamento agendadas na semana (founder-led enquanto o ticket pedir)"),
  D(5, "Retenção", "Relatório semanal: para cada cliente ativo, o recado 'fiz X, Y, Z para você'"),
  D(5, "Revisão", "Revisão (30 min): Painel de Ativos + Funil por Módulo — escolher 1 alavanca"),
].map((b, i) => ({ ...b, order_index: i, done_week: null }));
