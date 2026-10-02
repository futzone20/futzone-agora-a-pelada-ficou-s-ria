// Cores/etiquetas de agendamento da área "Dono de Quadra" — compartilhadas
// entre a Agenda (lista + calendário) e o Dashboard, pra nunca ficarem
// dessincronizadas (ex: Futebol sempre verde nos dois lugares).

// A mesma quadra pode ser usada pra mais de um esporte (futebol, vôlei,
// etc.) — cada modalidade tem uma cor fixa própria, sempre a mesma, pra dar
// pra reconhecer de relance na lista, no calendário e no dashboard.
export const MODALIDADES = [
  { value: "futebol", label: "Futebol", bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { value: "volei", label: "Vôlei", bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { value: "futvolei", label: "FutVôlei", bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { value: "badminton", label: "Badminton", bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { value: "tenis", label: "Tênis", bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
] as const;
export function infoModalidade(valor: string) {
  return MODALIDADES.find(m => m.value === valor) ?? MODALIDADES[0];
}

// Etiqueta de status dinâmica: cor viva na etiqueta, e o mesmo tom (bem mais
// opaco) no fundo/borda do card inteiro, pra dar pra reconhecer o estado só
// de bater o olho na lista ou na grade do calendário.
export const STATUS_INFO: Record<string, { label: string; badge: string; cardBorder: string; cardBg: string }> = {
  pendente: { label: "Pendente", badge: "bg-amber-500 text-white hover:bg-amber-500", cardBorder: "border-amber-500/30", cardBg: "bg-amber-500/5" },
  confirmado: { label: "Confirmado", badge: "bg-sky-500 text-white hover:bg-sky-500", cardBorder: "border-sky-500/30", cardBg: "bg-sky-500/5" },
  concluido: { label: "Concluído", badge: "bg-slate-500 text-white hover:bg-slate-500", cardBorder: "border-slate-500/30", cardBg: "bg-slate-500/5" },
  cancelado: { label: "Cancelado", badge: "bg-rose-600 text-white hover:bg-rose-600", cardBorder: "border-rose-500/30", cardBg: "bg-rose-500/5" },
};
export function infoStatus(status: string) {
  return STATUS_INFO[status] ?? { label: status, badge: "bg-muted text-foreground", cardBorder: "", cardBg: "" };
}
