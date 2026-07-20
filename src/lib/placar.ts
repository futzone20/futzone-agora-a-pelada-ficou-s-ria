export const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type Tabela = Record<string, { time_id: string; nome: string; cor: string; v: number; e: number; d: number; gp: number; gc: number; pts: number }>;

export function calcularTabela(partidas: any[], times: any[]): Tabela {
  const tab: Tabela = {};
  times.forEach((t) => {
    tab[t.id] = { time_id: t.id, nome: t.nome, cor: t.cor, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
  });
  partidas.filter((p) => p.status === "encerrada").forEach((p) => {
    const a = tab[p.time_a_id], b = tab[p.time_b_id];
    if (!a || !b) return;
    a.gp += p.placar_a; a.gc += p.placar_b;
    b.gp += p.placar_b; b.gc += p.placar_a;
    if (p.placar_a > p.placar_b) { a.v++; a.pts += 3; b.d++; }
    else if (p.placar_a < p.placar_b) { b.v++; b.pts += 3; a.d++; }
    else { a.e++; b.e++; a.pts++; b.pts++; }
  });
  return tab;
}
