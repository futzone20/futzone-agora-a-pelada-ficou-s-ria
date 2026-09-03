import { supabase } from "@/integrations/supabase/client";
import { calcularTabela } from "@/lib/placar";

export type LinhaRankingPelada = {
  user_id: string;
  nome: string;
  foto_url: string | null;
  pontos: number;
  vitoriasTime: number;
  foiCampeao: boolean;
};

/**
 * Calcula o ranking de TODOS os jogadores que jogaram uma pelada específica.
 *
 * Pontuação:
 *  - Gol: +7 · Passe decisivo: +5 · Defesa de GOLEIRO: +6 · Defesa de LINHA: +3
 *  - Frango: -5 · Falta: -3 · Cartão amarelo: -8 · Cartão vermelho: -15
 *  - "Entrada forte" não vale ponto.
 *  - Avaliação dos colegas: nota 5 = +20, nota 4 = +10, nota 1-3 = 0 (nunca desconta).
 *  - +1 ponto por vitória do time dele na pelada.
 *  - +5 pontos de bônus se o time dele foi o campeão (1º lugar na tabela).
 * Não tem bônus de capitão — no ranking, todo mundo compete igual.
 */
export async function calcularRankingPelada(peladaId: string): Promise<LinhaRankingPelada[]> {
  const [{ data: tj }, { data: lances }, { data: avals }, { data: times }, { data: partidas }] = await Promise.all([
    supabase.from("time_jogadores").select("user_id, time_id, eh_goleiro").eq("pelada_id", peladaId),
    supabase.from("lances").select("tipo, user_id").eq("pelada_id", peladaId),
    supabase.from("avaliacoes_pos_pelada").select("avaliado_id, nota_geral").eq("pelada_id", peladaId),
    supabase.from("times").select("id, nome, cor").eq("pelada_id", peladaId),
    supabase.from("partidas").select("time_a_id, time_b_id, placar_a, placar_b, status").eq("pelada_id", peladaId),
  ]);

  const escalados = (tj as any[]) || [];
  if (!escalados.length) return [];

  const { data: profs } = await supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", Array.from(new Set(escalados.map((x) => x.user_id))));
  const perfilMap: Record<string, { nome: string; foto_url: string | null }> = {};
  (profs || []).forEach((p: any) => { perfilMap[p.user_id] = { nome: p.nome, foto_url: p.foto_url }; });

  const ehGoleiroMap: Record<string, boolean> = {};
  const timeDoJogador: Record<string, string> = {};
  escalados.forEach((x) => { ehGoleiroMap[x.user_id] = !!x.eh_goleiro; timeDoJogador[x.user_id] = x.time_id; });

  const tabela = calcularTabela((partidas as any[]) || [], (times as any[]) || []);
  const timeCampeaoId = Object.values(tabela).sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc))[0]?.time_id;

  const contagens: Record<string, Record<string, number>> = {};
  ((lances as any[]) || []).forEach((l) => {
    if (!l.user_id) return;
    const bucket = (contagens[l.user_id] ||= {});
    bucket[l.tipo] = (bucket[l.tipo] || 0) + 1;
  });

  const avalPontos: Record<string, number> = {};
  ((avals as any[]) || []).forEach((a) => {
    const p = a.nota_geral >= 5 ? a.nota_geral * 2 : 0;
    avalPontos[a.avaliado_id] = (avalPontos[a.avaliado_id] || 0) + p;
  });

  const uids = Array.from(new Set(escalados.map((x) => x.user_id as string)));

  return uids
    .map((uid) => {
      const c = contagens[uid] || {};
      const ehGoleiro = !!ehGoleiroMap[uid];
      const timeId = timeDoJogador[uid];
      const linhaTime = timeId ? tabela[timeId] : undefined;
      const vitoriasTime = linhaTime?.v || 0;
      const foiCampeao = !!timeId && timeId === timeCampeaoId;

      const pontosLances =
        (c.gol || 0) * 7 +
        (c.passe_decisivo || 0) * 5 +
        (c.defesa || 0) * (ehGoleiro ? 6 : 3) -
        (c.frango || 0) * 5 -
        (c.falta || 0) * 3 -
        (c.cartao_amarelo || 0) * 8 -
        (c.cartao_vermelho || 0) * 15;

      const pontosTime = vitoriasTime * 1 + (foiCampeao ? 5 : 0);
      const total = pontosLances + (avalPontos[uid] || 0) + pontosTime;

      return {
        user_id: uid,
        nome: perfilMap[uid]?.nome || "Jogador",
        foto_url: perfilMap[uid]?.foto_url || null,
        pontos: total,
        vitoriasTime,
        foiCampeao,
      };
    })
    .sort((a, b) => b.pontos - a.pontos);
}
