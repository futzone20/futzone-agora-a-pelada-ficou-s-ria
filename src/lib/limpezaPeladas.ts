import { supabase } from "@/integrations/supabase/client";
import { notificarVencedoresPelada } from "@/lib/notificarVencedores";

export async function encerrarPeladasVencidas(peladaIds: string[], margemMinutos = 20) {
  if (!peladaIds.length) return;
  try {
    const { data: peladas } = await supabase
      .from("peladas")
      .select("id, status, aluguel_iniciado_em, tempo_locado_minutos")
      .in("id", peladaIds)
      .eq("status", "em_andamento");

    const agora = Date.now();
    const vencidas = (peladas || []).filter((p: any) => {
      if (!p.aluguel_iniciado_em) return false;
      const fim = new Date(p.aluguel_iniciado_em).getTime() + (p.tempo_locado_minutos ?? 60) * 60_000;
      return agora - fim > margemMinutos * 60_000;
    });

    for (const p of vencidas) {
      await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never)
        .eq("pelada_id", p.id).eq("status", "em_andamento");
      await supabase.from("peladas").update({ status: "encerrada" } as never).eq("id", p.id);
      void notificarVencedoresPelada(p.id);
    }
  } catch (err) {
    console.error("Falha ao verificar peladas vencidas", err);
  }
}
