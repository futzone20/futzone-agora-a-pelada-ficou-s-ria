import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Flame, Star, CircleDot, Calendar, Clock, MapPin } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { encerrarPeladasVencidas } from "@/lib/limpezaPeladas";
import { PeladaStatusOuContagem, ConfirmadosProgress, useAgora } from "@/lib/pelada-status";
import { ConvitesGrupoCard } from "@/components/ConvitesGrupoCard";
import { CaixinhaEntradaCard } from "@/components/CaixinhaEntradaCard";

export const Route = createFileRoute("/capitao/")({
  component: Inicio,
});

type ProximaRow = {
  id: string; nome_pelada: string; data: string; horario_inicio: string; status: string;
  quadra: { nome: string } | null;
  confirmados: number; capacidade: number;
};

function Inicio() {
  const { user } = useAuth();
  const first = user?.nome.split(" ")[0] || "capitão";
  const [aoVivo, setAoVivo] = useState<{ pelada: any; partida: any; timeA: any; timeB: any } | null>(null);
  const [proximas, setProximas] = useState<ProximaRow[]>([]);
  const agora = useAgora();

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: tj } = await supabase.from("time_jogadores").select("pelada_id").eq("user_id", user.id);
      const peladaIds = Array.from(new Set((tj || []).map((x: any) => x.pelada_id)));
      if (!peladaIds.length) return;
      await encerrarPeladasVencidas(peladaIds);
      const { data: pAoVivo } = await supabase.from("peladas").select("id, nome_pelada").in("id", peladaIds).eq("status", "em_andamento").limit(1).maybeSingle();
      if (!pAoVivo) return;
      const { data: partida } = await supabase.from("partidas").select("*").eq("pelada_id", pAoVivo.id).eq("status", "em_andamento").maybeSingle();
      const { data: timesAoVivo } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", pAoVivo.id);
      const timeA = (timesAoVivo || []).find((t: any) => t.id === partida?.time_a_id) || null;
      const timeB = (timesAoVivo || []).find((t: any) => t.id === partida?.time_b_id) || null;
      setAoVivo({ pelada: pAoVivo, partida, timeA, timeB });
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: ms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo").in("papel", ["capitao", "auxiliar"]);
      const grupoIds = Array.from(new Set((ms || []).map((m: any) => m.grupo_id)));
      if (!grupoIds.length) { setProximas([]); return; }
      const { data: peladas } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, status, quadra_id, jogadores_por_time, goleiros_por_time, numero_times")
        .in("grupo_id", grupoIds)
        .not("status", "in", "(encerrada,cancelada)")
        .order("data", { ascending: true })
        .limit(5);
      const peladaIds = (peladas || []).map((p: any) => p.id);
      const quadraIds = Array.from(new Set((peladas || []).map((p: any) => p.quadra_id).filter(Boolean)));
      const { data: confs } = peladaIds.length ? await supabase.from("pelada_confirmacoes").select("pelada_id, status").in("pelada_id", peladaIds) : { data: [] as any[] };
      const { data: quadras } = quadraIds.length ? await supabase.from("quadras_publicas").select("id, nome").in("id", quadraIds) : { data: [] as any[] };
      const quadraMap: Record<string, { nome: string }> = {};
      (quadras || []).forEach((q: any) => { quadraMap[q.id] = { nome: q.nome }; });
      const out: ProximaRow[] = (peladas || []).map((p: any) => ({
        id: p.id, nome_pelada: p.nome_pelada, data: p.data, horario_inicio: p.horario_inicio, status: p.status,
        quadra: p.quadra_id ? quadraMap[p.quadra_id] : null,
        confirmados: (confs || []).filter((c: any) => c.pelada_id === p.id && c.status === "confirmado").length,
        capacidade: (p.jogadores_por_time + p.goleiros_por_time) * p.numero_times,
      }));
      setProximas(out);
    })();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <ConvitesGrupoCard />
      <CaixinhaEntradaCard to="/capitao/vaquinhas" />
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
        {proximas.length === 0 ? (
          <EmptyState icon={CircleDot} title="Nenhuma pelada agendada" description="Crie um grupo e marque a próxima pelada." />
        ) : (
          <div className="space-y-2">
            {proximas.map((p) => (
              <Link key={p.id} to="/peladas/$id" params={{ id: p.id }} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
                <div className="flex items-start justify-between">
                  <div className="font-bold">{p.nome_pelada}</div>
                  <PeladaStatusOuContagem status={p.status} data={p.data} horarioInicio={p.horario_inicio} agora={agora} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0, 5)}</span>
                  {p.quadra && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.quadra.nome}</span>}
                </div>
                <ConfirmadosProgress confirmados={p.confirmados} capacidade={p.capacidade} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
