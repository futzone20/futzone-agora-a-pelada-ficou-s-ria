import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Flame, Star, CircleDot } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/capitao/")({
  component: Inicio,
});

function Inicio() {
  const { user } = useAuth();
  const first = user?.nome.split(" ")[0] || "capitão";
  const [aoVivo, setAoVivo] = useState<{ pelada: any; partida: any; timeA: any; timeB: any } | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      // Pelada ao vivo em que o capitão está escalado (mesmo widget da home do jogador)
      const { data: tj } = await supabase.from("time_jogadores").select("pelada_id").eq("user_id", user.id);
      const peladaIds = Array.from(new Set((tj || []).map((x: any) => x.pelada_id)));
      if (!peladaIds.length) return;
      const { data: pAoVivo } = await supabase.from("peladas").select("id, nome_pelada").in("id", peladaIds).eq("status", "em_andamento").limit(1).maybeSingle();
      if (!pAoVivo) return;
      const { data: partida } = await supabase.from("partidas").select("*").eq("pelada_id", pAoVivo.id).eq("status", "em_andamento").maybeSingle();
      const { data: timesAoVivo } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", pAoVivo.id);
      const timeA = (timesAoVivo || []).find((t: any) => t.id === partida?.time_a_id) || null;
      const timeB = (timesAoVivo || []).find((t: any) => t.id === partida?.time_b_id) || null;
      setAoVivo({ pelada: pAoVivo, partida, timeA, timeB });
    })();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      {aoVivo && (
        <section>
          <Link
            to="/peladas/$id"
            params={{ id: aoVivo.pelada.id }}
            className="block rounded-2xl border border-[#00FF87]/60 bg-[#0F1F17] p-4 transition hover:border-[#00FF87]"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#00FF87]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF87]" /> Ao vivo agora
              </span>
              <span className="truncate text-[10px] text-gray-400">{aoVivo.pelada.nome_pelada}</span>
            </div>
            {aoVivo.partida ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: aoVivo.timeA?.cor || "#666" }} />
                  <span className="truncate text-sm font-bold text-white">{aoVivo.timeA?.nome || "Time A"}</span>
                </div>
                <span className="shrink-0 text-2xl font-black text-white">{aoVivo.partida.placar_a} - {aoVivo.partida.placar_b}</span>
                <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                  <span className="truncate text-sm font-bold text-white">{aoVivo.timeB?.nome || "Time B"}</span>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: aoVivo.timeB?.cor || "#666" }} />
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-white">Sua pelada está rolando — próxima partida já já.</p>
            )}
            <p className="mt-2 text-center text-[10px] text-gray-500">Toque para acompanhar ao vivo →</p>
          </Link>
        </section>
      )}

      <div>
        <p className="text-sm text-muted-foreground">Bem-vindo, capitão</p>
        <h2 className="text-2xl font-bold">{first} 👋</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Star className="h-4 w-4" /></div>
          <div className="text-xs text-muted-foreground">Seus pontos</div>
          <div className="mt-1 text-2xl font-extrabold">0</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Flame className="h-4 w-4" /></div>
          <div className="text-xs text-muted-foreground">Sua ofensiva</div>
          <div className="mt-1 text-2xl font-extrabold">0 <span className="text-sm font-medium text-muted-foreground">dias</span></div>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Próximas peladas</h3>
        <EmptyState icon={CircleDot} title="Nenhuma pelada agendada" description="Crie um grupo e marque a próxima pelada." />
      </section>
    </div>
  );
}
