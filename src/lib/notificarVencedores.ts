import { supabase } from "@/integrations/supabase/client";
import { calcularTabela } from "@/lib/placar";

/**
 * Ao encerrar uma pelada, descobre o time vencedor (maior pontuação, com desempate por saldo
 * de gols) e cria uma notificação de "resultado_pelada" para cada jogador desse time, com um
 * link direto para o Card da Vitória. Se houver empate geral (mesma pontuação e saldo entre o
 * 1º e o 2º colocado), não notifica ninguém — não há vencedor claro.
 *
 * Seguro de chamar múltiplas vezes (não é idempotente por si só, mas o card busca os dados na
 * hora, então o pior caso é notificar de novo caso a função rode duas vezes para a mesma pelada).
 */
export async function notificarVencedoresPelada(peladaId: string) {
  try {
    const [{ data: times }, { data: partidas }, { data: pelada }] = await Promise.all([
      supabase.from("times").select("id, nome, cor").eq("pelada_id", peladaId),
      supabase.from("partidas").select("time_a_id, time_b_id, placar_a, placar_b, status").eq("pelada_id", peladaId),
      supabase.from("peladas").select("nome_pelada").eq("id", peladaId).maybeSingle(),
    ]);

    const timesArr = (times as any) || [];
    if (timesArr.length < 2) return; // sem times suficientes

    const tabela = Object.values(calcularTabela((partidas as any) || [], timesArr)).sort(
      (a, b) => b.pts - a.pts || b.gp - b.gc - (a.gp - a.gc),
    );
    if (tabela.length < 2) return;

    const [primeiro, segundo] = tabela;
    const semJogos = primeiro.v + primeiro.e + primeiro.d === 0;
    if (semJogos) return; // ninguém jogou, nada a comemorar

    const empateGeral = primeiro.pts === segundo.pts && primeiro.gp - primeiro.gc === segundo.gp - segundo.gc;
    if (empateGeral) return; // sem vencedor claro, ninguém é notificado

    const { data: jogadoresTime } = await supabase
      .from("time_jogadores")
      .select("user_id")
      .eq("time_id", primeiro.time_id);

    const userIds = ((jogadoresTime as any) || []).map((j: any) => j.user_id).filter(Boolean);
    if (!userIds.length) return;

    const nomePelada = (pelada as any)?.nome_pelada || "sua pelada";
    const notifs = userIds.map((uid: string) => ({
      user_id: uid,
      titulo: "🏆 Vitória!",
      mensagem: `Seu time (${primeiro.nome}) venceu a pelada "${nomePelada}"! Compartilhe seu Card da Vitória.`,
      tipo: "resultado_pelada",
      link: `/peladas/${peladaId}/card`,
      dados_extras: { time_id: primeiro.time_id, pelada_id: peladaId },
    }));

    await supabase.from("notificacoes").insert(notifs as never);
  } catch (err) {
    // Notificação é um "nice to have" — nunca deve travar o encerramento da pelada.
    console.error("Falha ao notificar vencedores da pelada", err);
  }
}
