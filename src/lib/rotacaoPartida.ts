import { supabase } from "@/integrations/supabase/client";
import { proximaRodada, escolherTimesIniciais } from "@/lib/rodizio";

export type ProximaPartidaPreview = {
  timeAId: string; timeBId: string; timeForaId: string | null; novaFila: string[];
  saidas: { entrouEm: "A" | "B"; timeQueSaiu: string }[]; numeroPartida: number; empateSorteio: boolean;
};

export async function calcularProximaPartida(peladaId: string, pelada: any): Promise<ProximaPartidaPreview | null> {
  if (!pelada) return null;
  const { data: ultima } = await supabase
    .from("partidas")
    .select("numero_partida, time_a_id, time_b_id, time_fora_id, fila_espera, placar_a, placar_b")
    .eq("pelada_id", peladaId)
    .order("numero_partida", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", peladaId).order("ordem");

  if (!tms || tms.length < 2) return null;

  let timeAId: string, timeBId: string, timeForaId: string | null = null;
  let novaFila: string[] = [];
  let saidas: { entrouEm: "A" | "B"; timeQueSaiu: string }[] = [];
  let empateSorteio = false;

  if (!ultima) {
    const { data: tjGoleiros } = await supabase.from("time_jogadores").select("time_id").eq("pelada_id", peladaId).eq("eh_goleiro", true);
    const idsComGoleiro = new Set((tjGoleiros || []).map((x: any) => x.time_id));
    const { jogam, fila } = escolherTimesIniciais(tms as any[], idsComGoleiro);
    timeAId = (jogam[0] as any).id;
    timeBId = (jogam[1] as any).id;
    novaFila = fila.map((t: any) => t.id);
    timeForaId = novaFila[0] ?? null;
  } else if (tms.length === 2) {
    const u: any = ultima;
    if (u.placar_a === u.placar_b) {
      timeAId = u.time_b_id;
      timeBId = u.time_a_id;
    } else {
      const vencedor = u.placar_a > u.placar_b ? u.time_a_id : u.time_b_id;
      const perdedor = vencedor === u.time_a_id ? u.time_b_id : u.time_a_id;
      timeAId = vencedor;
      timeBId = perdedor;
    }
    timeForaId = null;
  } else {
    const u: any = ultima;
    const filaAtual: string[] = Array.isArray(u.fila_espera) && u.fila_espera.length
      ? u.fila_espera
      : (u.time_fora_id ? [u.time_fora_id] : (tms as any[]).filter((t: any) => t.id !== u.time_a_id && t.id !== u.time_b_id).map((t: any) => t.id));

    const resultado = proximaRodada({
      timeAId: u.time_a_id,
      timeBId: u.time_b_id,
      filaAtual,
      placarA: u.placar_a,
      placarB: u.placar_b,
      numeroPartida: u.numero_partida,
      regraEmpate: (pelada as any).regra_empate_rodizio || "time_atual_sai",
    });
    if (!resultado) return null;

    timeAId = resultado.novoA;
    timeBId = resultado.novoB;
    novaFila = resultado.novaFila;
    timeForaId = novaFila[0] ?? null;
    saidas = resultado.saidas;
    empateSorteio = !!resultado.empateResolvidoPorSorteio;
  }

  return {
    timeAId, timeBId, timeForaId, novaFila, saidas,
    numeroPartida: ((ultima as any)?.numero_partida || 0) + 1,
    empateSorteio,
  };
}

export async function iniciarProximaPartida(peladaId: string, pelada: any, preview: ProximaPartidaPreview) {
  const { timeAId, timeBId, timeForaId, novaFila, saidas, numeroPartida } = preview;

  for (const s of saidas) {
    const timeEntrante = s.entrouEm === "A" ? timeAId : timeBId;
    const { data: tjExistente } = await supabase.from("time_jogadores").select("id")
      .eq("pelada_id", peladaId).eq("time_id", timeEntrante).eq("eh_goleiro", true).limit(1);
    if (!tjExistente || tjExistente.length === 0) {
      await supabase.from("time_jogadores").update({ time_id: timeEntrante } as never)
        .eq("pelada_id", peladaId).eq("time_id", s.timeQueSaiu).eq("eh_goleiro", true);
    }
  }

  const { error } = await supabase.from("partidas").insert({
    pelada_id: peladaId,
    numero_partida: numeroPartida,
    time_a_id: timeAId,
    time_b_id: timeBId,
    time_fora_id: timeForaId,
    fila_espera: novaFila,
    placar_a: 0,
    placar_b: 0,
    status: "em_andamento",
    duracao_minutos: pelada?.duracao_partida_minutos || 8,
    iniciada_em: new Date().toISOString(),
  } as never);

  if (error && (error as any).code !== "23505") {
    throw error;
  }
}
