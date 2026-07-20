import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/p/$id")({
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [{ data: profile }, { data: skills }, { data: ofensiva }, { data: stats }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome,cidade,estado,pontos_total").eq("user_id", id).maybeSingle(),
        supabase.from("skills").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("ofensivas").select("*").eq("user_id", id).maybeSingle(),
        supabase.rpc("user_stats", { _user_id: id }),
      ]);
      const { data: us } = await supabase.from("usuario_selos").select("selo_id").eq("user_id", id);
      const seloIds = (us || []).map((x: any) => x.selo_id);
      const { data: selos } = seloIds.length
        ? await supabase.from("selos").select("*").in("id", seloIds)
        : { data: [] } as any;
      const { data: posts } = await supabase.from("feed_posts").select("*").eq("user_id", id).order("criado_em", { ascending: false }).limit(10);
      setData({ profile, skills, ofensiva, stats, selos: selos || [], posts: posts || [] });
    })();
  }, [id]);

  if (!data?.profile) return <div className="min-h-screen bg-background p-6 text-center text-muted-foreground">Carregando...</div>;
  const p = data.profile;
  const s = data.skills || {};
  const skillsArr = [
    ["Velocidade", s.velocidade || 3], ["Drible", s.drible || 3], ["Passe", s.passe || 3],
    ["Chute", s.chute || 3], ["Resistência", s.resistencia || 3], ["Posicionamento", s.posicionamento || 3],
  ];
  const stats = data.stats || {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
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
                <div className="flex-1 h-2 rounded bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${((v as number) / 5) * 100}%` }} /></div>
                <span className="w-8 text-right">{v as number}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-bold">Estatísticas</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Peladas" value={stats.peladas_total || 0} />
            <Stat label="Gols" value={stats.gols_total || 0} />
            <Stat label="Passes" value={stats.passes_total || 0} />
            <Stat label="Defesas" value={stats.defesas_total || 0} />
            <Stat label="Ofensiva atual" value={data.ofensiva?.sequencia_atual || 0} />
            <Stat label="Maior ofensiva" value={data.ofensiva?.maior_sequencia || 0} />
          </div>
        </section>

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
