import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { calcularResumoCarreira, type ResumoCarreira } from "@/lib/resumoJogadorPelada";

export const Route = createFileRoute("/p/$id")({
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [{ data: profile }, { data: skills }, { data: ofensiva }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome,cidade,estado,pontos_total").eq("user_id", id).maybeSingle(),
        supabase.from("skills").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("ofensivas").select("*").eq("user_id", id).maybeSingle(),
      ]);
      const { data: us } = await supabase.from("usuario_selos").select("selo_id").eq("user_id", id);
      const seloIds = (us || []).map((x: any) => x.selo_id);
      const { data: selos } = seloIds.length
        ? await supabase.from("selos").select("*").in("id", seloIds)
        : { data: [] } as any;
      const { data: posts } = await supabase.from("feed_posts").select("*").eq("user_id", id).order("criado_em", { ascending: false }).limit(10);
      const carreira = await calcularResumoCarreira(id);
      setData({ profile, skills, ofensiva, selos: selos || [], posts: posts || [], carreira });
    })();
  }, [id]);

  if (!data?.profile) return <div className="min-h-screen bg-background p-6 text-center text-muted-foreground">Carregando...</div>;
  const p = data.profile;
  const s = data.skills || {};
  const skillsArr = [
    ["Velocidade", s.velocidade || 3], ["Drible", s.drible || 3], ["Passe", s.passe || 3],
    ["Chute", s.chute || 3], ["Marcação", s.resistencia || 3], ["Posicionamento", s.posicionamento || 3],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <header className="flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarFallback className="bg-primary/20 text-2xl font-bold">{p.nome?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
          <div>
            <h1 className="text-2xl font-bold">{p.nome}</h1>
            {(p.cidade || p.estado) && <div className="text-sm text-muted-foreground">{[p.cidade, p.estado].filter(Boolean).join(" - ")}</div>}
            <div className="text-sm font-bold text-primary">{p.pontos_total || 0} pontos</div>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-bold">Skills</h2>
          <div className="space-y-2">
            {skillsArr.map(([n, v]) => (
              <div key={n as string} className="flex items-center gap-2 text-sm">
                <span className="w-32">{n}</span>
                <div className="flex-1 h-2 rounded bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${((v as number) / 10) * 100}%` }} /></div>
                <span className="w-8 text-right">{v as number}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-bold">Ofensiva</h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="Ofensiva atual" value={data.ofensiva?.sequencia_atual || 0} />
            <Stat label="Maior ofensiva" value={data.ofensiva?.maior_sequencia || 0} />
          </div>
        </section>

        {data.carreira && (data.carreira as ResumoCarreira).totalPeladas > 0 && (() => {
          const c = data.carreira as ResumoCarreira;
          const horas = Math.floor(c.minutosJogados / 60);
          const minutosResto = c.minutosJogados % 60;
          return (
            <section className="rounded-2xl border border-primary/30 bg-card p-5 space-y-4">
              <h2 className="font-bold text-primary">Resumo da carreira</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Peladas" value={c.totalPeladas} />
                <div className="rounded-lg bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">Tempo jogado</div>
                  <div className="text-lg font-bold">{horas > 0 ? `${horas}h${minutosResto.toString().padStart(2, "0")}` : `${minutosResto}min`}</div>
                </div>
                <Stat label="Gols" value={c.gols} />
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/40 p-3 text-center">
                <div><div className="text-lg font-extrabold text-green-500">{c.vitorias}</div><div className="text-[10px] uppercase text-muted-foreground">Vitórias</div></div>
                <div><div className="text-lg font-extrabold text-yellow-500">{c.empates}</div><div className="text-[10px] uppercase text-muted-foreground">Empates</div></div>
                <div><div className="text-lg font-extrabold text-red-500">{c.derrotas}</div><div className="text-[10px] uppercase text-muted-foreground">Derrotas</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Passes decisivos" value={c.passes} />
                <Stat label="Defesas" value={c.defesas} />
                <div className="rounded-lg bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">Nota média ({c.totalAvaliacoes})</div>
                  <div className="text-lg font-bold">{c.notaMedia != null ? `⭐ ${c.notaMedia.toFixed(1)}` : "—"}</div>
                </div>
              </div>
            </section>
          );
        })()}

        {data.selos.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-bold">Selos</h2>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              {data.selos.map((s: any) => (
                <div key={s.id} className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-2xl">{s.icone_emoji}</div>
                  <div>{s.nome}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
