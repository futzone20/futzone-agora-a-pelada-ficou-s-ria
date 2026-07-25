import { supabase } from "@/integrations/supabase/client";

export type ResumoJogadorPelada = {
  minutosJogados: number;
  notaLances: number;
  notaAvaliacoes: number | null;
  totalAvaliacoes: number;
  gols: number;
  passes: number;
  defesas: number;
  frangos: number;
  /** Pontuação de ranking dessa pelada (mesma fórmula usada na tela de Ranking e na "Minha
   *  Carreira") — sem bônus de capitão, e a avaliação nunca desconta, só soma a partir de 4. */
  pontosRanking: number;
};

/**
 * Calcula, pra um jogador específico numa pelada específica:
 * - minutos jogados de verdade (soma da duração real de cada partida do time dele, descontando
 *   pausas — usa o tempo real decorrido quando existe, e cai pro tempo configurado se faltar
 *   algum dado)
 * - uma "nota de desempenho" derivada dos lances da partida (fórmula nova, poderia ser ajustada)
 * - a nota média que outros jogadores deram pra ele na avaliação pós-pelada
 *
 * Retorna null se o jogador não fez parte de nenhum time nessa pelada.
 */
export async function calcularResumoJogadorPelada(peladaId: string, userId: string): Promise<ResumoJogadorPelada | null> {
  const [{ data: tj }, { data: partidas }, { data: lances }, { data: avals }] = await Promise.all([
    supabase.from("time_jogadores").select("time_id").eq("pelada_id", peladaId).eq("user_id", userId).maybeSingle(),
    supabase.from("partidas").select("*").eq("pelada_id", peladaId).eq("status", "encerrada"),
    supabase.from("lances").select("tipo, user_id").eq("pelada_id", peladaId).eq("user_id", userId),
    supabase.from("avaliacoes_pos_pelada").select("nota_geral").eq("pelada_id", peladaId).eq("avaliado_id", userId),
  ]);

  if (!tj) return null;
  const timeId = (tj as any).time_id;

  let minutos = 0;
  ((partidas as any[]) || []).forEach((p) => {
    if (p.time_a_id !== timeId && p.time_b_id !== timeId) return;
    let dur: number;
    if (p.iniciada_em && p.encerrada_em) {
      const inicioMs = new Date(p.iniciada_em).getTime();
      const fimMs = new Date(p.encerrada_em).getTime();
      const pausaMs = (p.tempo_pausado_total_seg || 0) * 1000;
      dur = Math.max(0, (fimMs - inicioMs - pausaMs) / 60000);
    } else {
      dur = p.duracao_minutos || 0;
    }
    minutos += dur;
  });

  const contagens: Record<string, number> = {};
  ((lances as any[]) || []).forEach((l) => { contagens[l.tipo] = (contagens[l.tipo] || 0) + 1; });

  // Fórmula nova (não existia antes) — pode ser ajustada depois se quiser pesos diferentes.
  let nota = 3
    + (contagens.gol || 0) * 0.3
    + (contagens.passe_decisivo || 0) * 0.2
    + (contagens.defesa || 0) * 0.2
    + (contagens.entrada_forte || 0) * 0.1
    - (contagens.frango || 0) * 0.3
    - (contagens.falta || 0) * 0.15
    - (contagens.cartao_amarelo || 0) * 0.4
    - (contagens.cartao_vermelho || 0) * 0.8;
  nota = Math.max(0, Math.min(5, nota));

  const notasAvals = ((avals as any[]) || []).map((a) => a.nota_geral).filter((n) => typeof n === "number");
  const notaAvaliacoes = notasAvals.length ? notasAvals.reduce((a, b) => a + b, 0) / notasAvals.length : null;

  // Pontuação de ranking: mesma fórmula da tela de Ranking (sem clamp, sem bônus de capitão,
  // avaliação nunca desconta — só soma a partir da nota 4).
  const pontosAvaliacao = notasAvals.reduce((acc, n) => acc + (n === 5 ? 20 : n === 4 ? 10 : 0), 0);
  const pontosLances =
    (contagens.gol || 0) * 7 +
    (contagens.passe_decisivo || 0) * 5 +
    (contagens.defesa || 0) * 6 +
    (contagens.entrada_forte || 0) * 2 -
    (contagens.frango || 0) * 5 -
    (contagens.falta || 0) * 3 -
    (contagens.cartao_amarelo || 0) * 8 -
    (contagens.cartao_vermelho || 0) * 15;

  return {
    minutosJogados: Math.round(minutos),
    notaLances: Math.round(nota * 10) / 10,
    notaAvaliacoes: notaAvaliacoes != null ? Math.round(notaAvaliacoes * 10) / 10 : null,
    totalAvaliacoes: notasAvals.length,
    gols: contagens.gol || 0,
    passes: contagens.passe_decisivo || 0,
    defesas: contagens.defesa || 0,
    frangos: contagens.frango || 0,
    pontosRanking: pontosLances + pontosAvaliacao,
  };
}
