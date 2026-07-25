import { supabase } from "@/integrations/supabase/client";

export type LinhaRankingPelada = { user_id: string; nome: string; foto_url: string | null; pontos: number };

/**
 * Calcula o ranking de TODOS os jogadores que jogaram uma pelada específica.
 * Pontuação = lances da partida (gol/passe/defesa/frango/falta/cartão) + nota que os colegas
 * deram na avaliação pós-pelada (só soma a partir de nota 4 — nota baixa nunca desconta).
 * Não tem bônus de capitão aqui: no ranking, todo mundo compete igual.
 */
export async function calcularRankingPelada(peladaId: string): Promise<LinhaRankingPelada[]> {
  const [{ data: tj }, { data: lances }, { data: avals }] = await Promise.all([
    supabase.from("time_jogadores").select("user_id").eq("pelada_id", peladaId),
    supabase.from("lances").select("tipo, user_id").eq("pelada_id", peladaId),
    supabase.from("avaliacoes_pos_pelada").select("avaliado_id, nota_geral").eq("pelada_id", peladaId),
  ]);

  const uids = Array.from(new Set(((tj as any[]) || []).map((x) => x.user_id as string)));
  if (!uids.length) return [];

  const { data: profs } = await supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", uids);
  const perfilMap: Record<string, { nome: string; foto_url: string | null }> = {};
  (profs || []).forEach((p: any) => { perfilMap[p.user_id] = { nome: p.nome, foto_url: p.foto_url }; });

  const contagens: Record<string, Record<string, number>> = {};
  ((lances as any[]) || []).forEach((l) => {
    if (!l.user_id) return;
    const bucket = (contagens[l.user_id] ||= {});
    bucket[l.tipo] = (bucket[l.tipo] || 0) + 1;
  });

  const avalPontos: Record<string, number> = {};
  ((avals as any[]) || []).forEach((a) => {
    const p = a.nota_geral === 5 ? 20 : a.nota_geral === 4 ? 10 : 0;
    avalPontos[a.avaliado_id] = (avalPontos[a.avaliado_id] || 0) + p;
  });

  return uids
    .map((uid) => {
      const c = contagens[uid] || {};
      const pontosLances =
        (c.gol || 0) * 7 +
        (c.passe_decisivo || 0) * 5 +
        (c.defesa || 0) * 6 +
        (c.entrada_forte || 0) * 2 -
        (c.frango || 0) * 5 -
        (c.falta || 0) * 3 -
        (c.cartao_amarelo || 0) * 8 -
        (c.cartao_vermelho || 0) * 15;
      const total = pontosLances + (avalPontos[uid] || 0);
      return {
        user_id: uid,
        nome: perfilMap[uid]?.nome || "Jogador",
        foto_url: perfilMap[uid]?.foto_url || null,
        pontos: total,
      };
    })
    .sort((a, b) => b.pontos - a.pontos);
}
