import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const margemMinutos = 10; // tolerância antes de considerar realmente vencida
    const { data: peladas, error } = await supabase
      .from("peladas")
      .select("id, aluguel_iniciado_em, tempo_locado_minutos")
      .eq("status", "em_andamento")
      .not("aluguel_iniciado_em", "is", null);

    if (error) throw error;

    const agora = Date.now();
    const vencidas = (peladas || []).filter((p: any) => {
      const fim = new Date(p.aluguel_iniciado_em).getTime() + (p.tempo_locado_minutos ?? 60) * 60_000;
      return agora - fim > margemMinutos * 60_000;
    });

    for (const p of vencidas) {
      await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() })
        .eq("pelada_id", p.id).eq("status", "em_andamento");
      await supabase.from("peladas").update({ status: "encerrada" }).eq("id", p.id);
      await notificarVencedores(supabase, p.id);
    }

    return new Response(JSON.stringify({ ok: true, encerradas: vencidas.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});

async function notificarVencedores(supabase: any, peladaId: string) {
  try {
    const [{ data: times }, { data: partidas }, { data: pelada }] = await Promise.all([
      supabase.from("times").select("id, nome, cor").eq("pelada_id", peladaId),
      supabase.from("partidas").select("time_a_id, time_b_id, placar_a, placar_b, status").eq("pelada_id", peladaId),
      supabase.from("peladas").select("nome_pelada").eq("id", peladaId).maybeSingle(),
    ]);

    const timesArr = times || [];
    if (timesArr.length < 2) return;

    const tab: Record<string, any> = {};
    timesArr.forEach((t: any) => { tab[t.id] = { time_id: t.id, nome: t.nome, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }; });
    (partidas || []).filter((p: any) => p.status === "encerrada").forEach((p: any) => {
      const a = tab[p.time_a_id], b = tab[p.time_b_id];
      if (!a || !b) return;
      a.gp += p.placar_a; a.gc += p.placar_b;
      b.gp += p.placar_b; b.gc += p.placar_a;
      if (p.placar_a > p.placar_b) { a.v++; a.pts += 3; b.d++; }
      else if (p.placar_a < p.placar_b) { b.v++; b.pts += 3; a.d++; }
      else { a.e++; b.e++; a.pts++; b.pts++; }
    });

    const tabela = Object.values(tab).sort((a: any, b: any) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc));
    if (tabela.length < 2) return;
    const [primeiro, segundo]: any = tabela;
    const semJogos = primeiro.v + primeiro.e + primeiro.d === 0;
    if (semJogos) return;
    const empateGeral = primeiro.pts === segundo.pts && (primeiro.gp - primeiro.gc) === (segundo.gp - segundo.gc);
    if (empateGeral) return;

    const { data: jogadoresTime } = await supabase.from("time_jogadores").select("user_id").eq("time_id", primeiro.time_id);
    const userIds = (jogadoresTime || []).map((j: any) => j.user_id).filter(Boolean);
    if (!userIds.length) return;

    const nomePelada = pelada?.nome_pelada || "sua pelada";
    const notifs = userIds.map((uid: string) => ({
      user_id: uid,
      titulo: "🏆 Vitória!",
      mensagem: `Seu time (${primeiro.nome}) venceu a pelada "${nomePelada}"! Compartilhe seu Card da Vitória.`,
      tipo: "resultado_pelada",
      link: `/peladas/${peladaId}/card`,
      dados_extras: { time_id: primeiro.time_id, pelada_id: peladaId },
    }));
    await supabase.from("notificacoes").insert(notifs);
  } catch (err) {
    console.error("Falha ao notificar vencedores (cron)", err);
  }
}
