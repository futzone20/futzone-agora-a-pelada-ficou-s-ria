import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: raizes, error } = await supabase
      .from("peladas")
      .select("*")
      .eq("recorrente", true)
      .is("recorrente_raiz_id", null);
    if (error) throw error;

    let criadas = 0;
    for (const raiz of raizes || []) {
      if (raiz.dia_semana === null || raiz.dia_semana === undefined) continue;

      const { data: familia } = await supabase
        .from("peladas")
        .select("data")
        .or(`id.eq.${raiz.id},recorrente_raiz_id.eq.${raiz.id}`)
        .order("data", { ascending: false })
        .limit(1);

      const ultimaData = familia && familia[0]
        ? new Date(familia[0].data + "T00:00:00")
        : new Date(raiz.data + "T00:00:00");

      const proxima = new Date(ultimaData);
      do {
        proxima.setDate(proxima.getDate() + 1);
      } while (proxima.getDay() !== raiz.dia_semana);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const antecedenciaMs = (raiz.antecedencia_dias_lista ?? 3) * 24 * 60 * 60 * 1000;
      const deveAbrir = hoje.getTime() >= proxima.getTime() - antecedenciaMs;
      if (!deveAbrir) continue;

      const proximaStr = proxima.toISOString().slice(0, 10);

      const { data: jaExiste } = await supabase
        .from("peladas")
        .select("id")
        .or(`id.eq.${raiz.id},recorrente_raiz_id.eq.${raiz.id}`)
        .eq("data", proximaStr)
        .maybeSingle();
      if (jaExiste) continue;

      const {
        id, criado_em, status, sorteio_feito, aluguel_iniciado_em, atraso_registrado_em,
        avaliacao_aberta, avaliacao_fecha_em, mvp_user_id, ...configBase
      } = raiz as any;
      void id; void criado_em; void status; void sorteio_feito; void aluguel_iniciado_em;
      void atraso_registrado_em; void avaliacao_aberta; void avaliacao_fecha_em; void mvp_user_id;

      await supabase.from("peladas").insert({
        ...configBase,
        data: proximaStr,
        status: "aguardando",
        sorteio_feito: false,
        aluguel_iniciado_em: null,
        recorrente: false,
        recorrente_raiz_id: raiz.id,
      });
      criadas++;
    }

    return new Response(JSON.stringify({ ok: true, criadas }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
