import { supabase } from "@/integrations/supabase/client";
import { calcularRankingPelada } from "@/lib/rankingPelada";

export type LinhaRankingGrupo = {
  user_id: string;
  nome: string;
  foto_url: string | null;
  pontos: number;
  peladasJogadas: number;
};

/** Ranking geral do grupo — soma a mesma fórmula de pontos de TODAS as peladas encerradas do grupo. */
export async function calcularRankingGrupo(grupoId: string): Promise<LinhaRankingGrupo[]> {
  const { data: ps } = await supabase.from("peladas").select("id").eq("grupo_id", grupoId).eq("status", "encerrada");
  const peladaIds = (ps || []).map((p: any) => p.id as string);
  if (!peladaIds.length) return [];

  const todasLinhas = await Promise.all(peladaIds.map((pid) => calcularRankingPelada(pid)));

  const acc: Record<string, LinhaRankingGrupo> = {};
  todasLinhas.flat().forEach((l) => {
    const cur = (acc[l.user_id] ||= { user_id: l.user_id, nome: l.nome, foto_url: l.foto_url, pontos: 0, peladasJogadas: 0 });
    cur.pontos += l.pontos;
    cur.peladasJogadas += 1;
  });

  return Object.values(acc).sort((a, b) => b.pontos - a.pontos);
}

export type LinhaArtilharia = { user_id: string; nome: string; foto_url: string | null; gols: number };

/** Artilharia — funciona tanto pra 1 pelada (passe [peladaId]) quanto pro grupo inteiro (passe todas as encerradas). */
export async function calcularArtilharia(peladaIds: string[]): Promise<LinhaArtilharia[]> {
  if (!peladaIds.length) return [];
  const { data: lances } = await supabase.from("lances").select("user_id").in("pelada_id", peladaIds).eq("tipo", "gol");
  const contagem: Record<string, number> = {};
  (lances || []).forEach((l: any) => { if (l.user_id) contagem[l.user_id] = (contagem[l.user_id] || 0) + 1; });

  const uids = Object.keys(contagem);
  if (!uids.length) return [];
  const [{ data: profs }, { data: convs }] = await Promise.all([
    supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", uids),
    supabase.from("pelada_convidados").select("id, nome").in("id", uids),
  ]);
  const map: Record<string, any> = {};
  (profs || []).forEach((p: any) => { map[p.user_id] = p; });
  (convs || []).forEach((c: any) => { if (!map[c.id]) map[c.id] = { nome: `${c.nome} (convidado)`, foto_url: null }; });

  return uids
    .map((uid) => ({ user_id: uid, nome: map[uid]?.nome || "Jogador", foto_url: map[uid]?.foto_url || null, gols: contagem[uid] }))
    .sort((a, b) => b.gols - a.gols);
}

export type LinhaGoleiro = { user_id: string; nome: string; foto_url: string | null; golsSofridos: number; partidas: number; media: number };

/** Goleiro "menos vazado" — ordenado pela MÉDIA de gols sofridos por partida (mais justo que o total bruto). */
export async function calcularMenosVazado(peladaIds: string[]): Promise<LinhaGoleiro[]> {
  if (!peladaIds.length) return [];
  const { data: tj } = await (supabase as any).from("time_jogadores").select("user_id, pelada_id, time_id").in("pelada_id", peladaIds).eq("eh_goleiro", true);
  const porPelada: Record<string, { user_id: string; time_id: string }[]> = {};
  (tj || []).forEach((x: any) => { (porPelada[x.pelada_id] ||= []).push(x); });

  const { data: partidas } = await supabase.from("partidas").select("pelada_id, time_a_id, time_b_id, placar_a, placar_b").in("pelada_id", peladaIds).eq("status", "encerrada");

  const acc: Record<string, { sofridos: number; partidas: number }> = {};
  (partidas || []).forEach((p: any) => {
    const goleiros = porPelada[p.pelada_id] || [];
    goleiros.forEach((g) => {
      if (g.time_id !== p.time_a_id && g.time_id !== p.time_b_id) return;
      const sofrido = g.time_id === p.time_a_id ? p.placar_b : p.placar_a;
      const cur = (acc[g.user_id] ||= { sofridos: 0, partidas: 0 });
      cur.sofridos += sofrido;
      cur.partidas += 1;
    });
  });

  const uids = Object.keys(acc);
  if (!uids.length) return [];
  const [{ data: profs }, { data: convs }] = await Promise.all([
    supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", uids),
    supabase.from("pelada_convidados").select("id, nome").in("id", uids),
  ]);
  const map: Record<string, any> = {};
  (profs || []).forEach((p: any) => { map[p.user_id] = p; });
  (convs || []).forEach((c: any) => { if (!map[c.id]) map[c.id] = { nome: `${c.nome} (convidado)`, foto_url: null }; });

  return uids
    .map((uid) => {
      const d = acc[uid];
      return {
        user_id: uid, nome: map[uid]?.nome || "Jogador", foto_url: map[uid]?.foto_url || null,
        golsSofridos: d.sofridos, partidas: d.partidas, media: d.partidas ? d.sofridos / d.partidas : 0,
      };
    })
    .sort((a, b) => a.media - b.media || a.golsSofridos - b.golsSofridos);
}
