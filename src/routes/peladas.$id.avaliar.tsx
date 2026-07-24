import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Star, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/peladas/$id/avaliar")({
  component: Wrapper,
});

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><Avaliar /></MobileShell>
    </RequireAuth>
  );
}

type Ja = {
  user_id: string;
  nome: string;
  time_nome?: string;
  gols: number; passes: number; defesas: number;
  nota_geral: number; nota_comportamento: number;
  desempenho: number;
};

const DESEMPENHO_LABELS = ["", "Muito abaixo", "Abaixo", "Como esperado", "Acima", "Muito acima"];

const CATEGORIAS_RESENHA = [
  { v: "craque", label: "Craque da Rodada", emoji: "⚽" },
  { v: "pereba", label: "Pereba da Rodada", emoji: "🥴" },
  { v: "perde_gol", label: "Perde-Gol da Rodada", emoji: "🎯" },
  { v: "frangueiro", label: "Frangueiro da Rodada", emoji: "🐔" },
  { v: "racudo", label: "Raçudo da Rodada", emoji: "🔥" },
] as const;

function Avaliar() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState<any>(null);
  const [jogadores, setJogadores] = useState<Ja[]>([]);
  const [mvp, setMvp] = useState<string>("");
  const [votosResenha, setVotosResenha] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      setPelada(p);
      const { data: tj } = await supabase.from("time_jogadores").select("user_id,time_id").eq("pelada_id", id);
      const uids = Array.from(new Set((tj || []).map((x: any) => x.user_id))).filter((u) => u !== user.id);
      const timeIds = Array.from(new Set((tj || []).map((x: any) => x.time_id)));
      const [{ data: profs }, { data: times }, { data: lances }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome").in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("times").select("id,nome").in("id", timeIds.length ? timeIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("lances").select("user_id,tipo").eq("pelada_id", id),
      ]);
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { pMap[p.user_id] = p.nome; });
      const tMap: Record<string, string> = {};
      (times || []).forEach((t: any) => { tMap[t.id] = t.nome; });
      const userTime: Record<string, string> = {};
      (tj || []).forEach((x: any) => { userTime[x.user_id] = tMap[x.time_id] || ""; });
      const stats: Record<string, { g: number; p: number; d: number }> = {};
      (lances || []).forEach((l: any) => {
        const s = stats[l.user_id] = stats[l.user_id] || { g: 0, p: 0, d: 0 };
        if (l.tipo === "gol") s.g++;
        else if (l.tipo === "passe_decisivo") s.p++;
        else if (l.tipo === "defesa") s.d++;
      });
      setJogadores(uids.map((uid) => ({
        user_id: uid,
        nome: pMap[uid] || "Jogador",
        time_nome: userTime[uid],
        gols: stats[uid]?.g || 0,
        passes: stats[uid]?.p || 0,
        defesas: stats[uid]?.d || 0,
        nota_geral: 5,
        nota_comportamento: 5,
        desempenho: 3,
      })));
      setLoading(false);
    })();
  }, [id, user?.id]);

  const upd = (uid: string, patch: Partial<Ja>) =>
    setJogadores((arr) => arr.map((j) => j.user_id === uid ? { ...j, ...patch } : j));

  const enviar = async () => {
    if (!user) return;
    setSaving(true);
    const rows = jogadores.map((j) => ({
      pelada_id: id, avaliador_id: user.id, avaliado_id: j.user_id,
      gols_confirmados: j.gols, passes_confirmados: j.passes, defesas_confirmadas: j.defesas,
      nota_geral: j.nota_geral, nota_comportamento: j.nota_comportamento,
    }));
    const { error } = await supabase.from("avaliacoes_pos_pelada").insert(rows as never);
    if (error) { toast.error(error.message); setSaving(false); return; }

    // Avaliações de desempenho (skills sistema novo)
    if (pelada?.grupo_id) {
      const desRows = jogadores.map((j) => ({
        avaliador_id: user.id, avaliado_id: j.user_id, grupo_id: pelada.grupo_id,
        tipo: "pos_pelada", pelada_id: id, conhece_jogador: true,
        nota_desempenho_geral: j.desempenho,
      }));
      await supabase.from("avaliacoes_skill_membro").insert(desRows as never);
    }

    if (mvp) {
      const { error: e2 } = await supabase.from("mvp_votos").insert({ pelada_id: id, votante_id: user.id, votado_id: mvp } as never);
      if (e2) toast.error(e2.message);
    }

    const votosRows = Object.entries(votosResenha)
      .filter(([, votado_id]) => !!votado_id)
      .map(([categoria, votado_id]) => ({ pelada_id: id, categoria, votante_id: user.id, votado_id }));
    if (votosRows.length) {
      const { error: e3 } = await (supabase as any).from("resenha_votos").insert(votosRows);
      if (e3) toast.error(e3.message);
    }

    toast.success("Avaliação enviada!");
    navigate({ to: "/jogador/peladas" });
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada?.avaliacao_aberta) return <div className="text-sm text-muted-foreground">A janela de avaliação está fechada.</div>;
  if (!jogadores.length) return <div className="text-sm text-muted-foreground">Nenhum jogador para avaliar.</div>;

  const avaliados = jogadores.filter((j) => j.desempenho > 0).length;
  const total = jogadores.length;
  const completo = avaliados === total && total > 0;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="text-xl font-bold">Avaliar pelada</h2>
      <p className="text-xs text-muted-foreground">Avaliações são anônimas. Confirme os lances e dê suas notas.</p>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex justify-between text-xs mb-1">
          <span>Avaliando {avaliados} de {total} jogadores</span>
          <span className="font-bold text-primary">{Math.round((avaliados / Math.max(total,1)) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${(avaliados / Math.max(total,1)) * 100}%` }} />
        </div>
        {completo && (
          <div className="mt-2 rounded-lg bg-green-500/15 px-3 py-2 text-xs font-bold text-green-500">
            🏆 Avaliação completa! Você ganhará +20 pontos bônus
          </div>
        )}
      </div>


      {jogadores.map((j) => (
        <div key={j.user_id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{j.nome}</div>
              {j.time_nome && <div className="text-xs text-muted-foreground">{j.time_nome}</div>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {(["gols", "passes", "defesas"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-xs uppercase text-muted-foreground">{k}</span>
                <input type="number" min={0} value={(j as any)[k]}
                  onChange={(e) => upd(j.user_id, { [k]: Math.max(0, parseInt(e.target.value || "0", 10)) } as any)}
                  className="rounded-lg bg-secondary px-2 py-1 outline-none" />
              </label>
            ))}
          </div>
          <Stars label="Nota geral" value={j.nota_geral} onChange={(v) => upd(j.user_id, { nota_geral: v })} />
          <Stars label="Comportamento" value={j.nota_comportamento} onChange={(v) => upd(j.user_id, { nota_comportamento: v })} />
          <div>
            <div className="text-xs text-muted-foreground">Desempenho na pelada</div>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => upd(j.user_id, { desempenho: n })}>
                  <Star className={`h-6 w-6 ${n <= j.desempenho ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{DESEMPENHO_LABELS[j.desempenho]}</div>
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="font-bold">⭐ Quem foi o MVP?</div>
        <div className="grid gap-2">
          {jogadores.map((j) => (
            <label key={j.user_id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="mvp" checked={mvp === j.user_id} onChange={() => setMvp(j.user_id)} />
              {j.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-bold">🎉 Resenha da pelada</div>
          <p className="text-xs text-muted-foreground">100% anônimo — nem o capitão vê quem votou em quem. Pode deixar em branco qualquer categoria.</p>
        </div>
        {CATEGORIAS_RESENHA.map((cat) => (
          <div key={cat.v}>
            <div className="mb-1.5 text-sm font-bold">{cat.emoji} {cat.label}</div>
            <div className="grid grid-cols-2 gap-2">
              {jogadores.map((j) => (
                <button
                  key={j.user_id}
                  type="button"
                  onClick={() => setVotosResenha((v) => ({ ...v, [cat.v]: v[cat.v] === j.user_id ? "" : j.user_id }))}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${votosResenha[cat.v] === j.user_id ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30"}`}
                >
                  {j.nome}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={enviar} disabled={saving} className="w-full bg-primary font-bold">
        Enviar Avaliação
      </Button>
    </div>
  );
}

function Stars({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} type="button">
            <Star className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
