import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { ArrowLeft, Shuffle, CircleDot, Home, Trophy, User, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CORES_TIMES, type Jogador, mediaSkill, mediaTime, sortear } from "@/lib/sorteio";

export const Route = createFileRoute("/peladas/$id/sorteio")({
  component: Wrapper,
});

const items = [
  { to: "/capitao", label: "Início", icon: Home },
  { to: "/capitao/grupos", label: "Grupos", icon: Users },
  { to: "/capitao/ranking", label: "Ranking", icon: Trophy },
  { to: "/capitao/perfil", label: "Perfil", icon: User },
];

function Wrapper() {
  return (
    <RequireAuth allow={["capitao", "admin"]}>
      <MobileShell items={items as any}><SorteioPage /></MobileShell>
    </RequireAuth>
  );
}

type TimeUI = { nome: string; cor: string; jogadores: Jogador[]; goleiros: Jogador[] };

function SorteioPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pelada, setPelada] = useState<any>(null);
  const [confirmados, setConfirmados] = useState<Jogador[]>([]);
  const [times, setTimes] = useState<TimeUI[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
    setPelada(p);
    if (!p) { setLoading(false); return; }

    const { data: confs } = await supabase
      .from("pelada_confirmacoes").select("*").eq("pelada_id", id).eq("status", "confirmado");
    const userIds = (confs || []).map((c: any) => c.user_id);
    const [{ data: profs }, { data: skills }] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, posicao_preferida, quer_ser_goleiro").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("skills").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const profMap = new Map((profs || []).map((x: any) => [x.user_id, x]));
    const skMap = new Map((skills || []).map((x: any) => [x.user_id, x]));

    const list: Jogador[] = (confs || []).map((c: any) => {
      const prof: any = profMap.get(c.user_id) || {};
      const sk: any = skMap.get(c.user_id);
      const pendente = !sk || !sk.origem_ultima_atualizacao;
      return {
        user_id: c.user_id,
        nome: prof.nome || "Jogador",
        media: pendente ? 3.0 : mediaSkill(sk as any),
        eh_goleiro: !!c.eh_goleiro || prof.posicao_preferida === "goleiro" || !!prof.quer_ser_goleiro,
        skills_pendentes: pendente,
      } as Jogador & { skills_pendentes: boolean };
    });
    setConfirmados(list);

    // se já existe sorteio, carrega
    const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    if (tms && tms.length) {
      const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
      const ui: TimeUI[] = tms.map((t: any) => {
        const membros = (tj || []).filter((x: any) => x.time_id === t.id);
        const toJ = (m: any): Jogador => {
          const fonte = list.find((l) => l.user_id === m.user_id);
          return fonte || { user_id: m.user_id, nome: profMap.get(m.user_id)?.nome || "Jogador", media: mediaSkill(skMap.get(m.user_id) as any), eh_goleiro: m.eh_goleiro };
        };
        return {
          nome: t.nome, cor: t.cor,
          jogadores: membros.filter((m: any) => !m.eh_goleiro).map(toJ),
          goleiros: membros.filter((m: any) => m.eh_goleiro).map(toJ),
        };
      });
      setTimes(ui);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const minimoOk = useMemo(() => {
    if (!pelada) return false;
    return confirmados.length >= pelada.jogadores_por_time * pelada.numero_times;
  }, [pelada, confirmados]);

  const totalGoleirosNecessarios = pelada ? pelada.goleiros_por_time * pelada.numero_times : 0;
  const totalGoleirosConfirmados = confirmados.filter((c) => c.eh_goleiro).length;

  const pendentes = (confirmados as any[]).filter((c) => c.skills_pendentes);

  const gerar = () => {
    if (!pelada) return;
    if (pendentes.length > 0) {
      const nomes = pendentes.map((p) => p.nome).join(", ");
      if (!confirm(`⚠️ ${pendentes.length} jogador(es) ainda não têm skills definidas: ${nomes}.\n\nO sorteio será menos preciso (média neutra 3.0). Continuar mesmo assim?`)) return;
    }
    const numTimes = pelada.numero_times;
    const modalidade = ((pelada as any).modalidade_goleiro || "fixo") as "fixo" | "sorteado";
    const { jogadores, goleiros } = sortear(confirmados, numTimes, modalidade);
    const cores = CORES_TIMES[numTimes] || [];
    const ui: TimeUI[] = Array.from({ length: numTimes }, (_, i) => ({
      nome: times[i]?.nome || cores[i]?.nome || `Time ${i + 1}`,
      cor: times[i]?.cor || cores[i]?.cor || "#666666",
      jogadores: jogadores[i] || [],
      goleiros: goleiros[i] || [],
    }));
    setTimes(ui);
  };

  const confirmar = async () => {
    if (!user || !pelada || !times.length) return;
    setSaving(true);
    // limpa anteriores
    await supabase.from("time_jogadores").delete().eq("pelada_id", id);
    await supabase.from("times").delete().eq("pelada_id", id);

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const { data: novo, error } = await supabase.from("times")
        .insert({ pelada_id: id, nome: t.nome, cor: t.cor, ordem: i } as never)
        .select().single();
      if (error || !novo) { toast.error(error?.message || "Erro ao salvar time"); setSaving(false); return; }
      const rows = [
        ...t.jogadores.map((j) => ({ time_id: (novo as any).id, pelada_id: id, user_id: j.user_id, eh_goleiro: false })),
        ...t.goleiros.map((j) => ({ time_id: (novo as any).id, pelada_id: id, user_id: j.user_id, eh_goleiro: true })),
      ];
      if (rows.length) {
        const { error: e2 } = await supabase.from("time_jogadores").insert(rows as never);
        if (e2) { toast.error(e2.message); setSaving(false); return; }
      }
    }

    await supabase.from("peladas").update({ sorteio_feito: true, status: "confirmada" } as never).eq("id", id);
    await supabase.from("sorteio_log").insert({ pelada_id: id, realizado_por: user.id, tipo: "primeiro_sorteio" } as never);

    // notificações
    const notifs = times.flatMap((t) => {
      const membros = [...t.jogadores, ...t.goleiros];
      const nomes = membros.map((m) => m.nome).join(", ");
      return membros.map((m) => ({
        user_id: m.user_id,
        titulo: "⚽ Times sorteados!",
        mensagem: `Você está no ${t.nome}. Companheiros: ${nomes}. Bora!`,
        link: `/peladas/${id}`,
      }));
    });
    if (notifs.length) await supabase.from("notificacoes").insert(notifs as never);

    setSaving(false);
    toast.success("Sorteio confirmado!");
    navigate({ to: "/peladas/$id", params: { id } });
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada) return <EmptyState icon={CircleDot} title="Pelada não encontrada" />;

  return (
    <div className="space-y-4">
      <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Sorteio — {pelada.nome_pelada}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {confirmados.length} confirmados · {pelada.numero_times} times de {pelada.jogadores_por_time} + {pelada.goleiros_por_time} goleiro(s)
        </p>
        {!minimoOk && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Mínimo de jogadores não atingido ({pelada.jogadores_por_time * pelada.numero_times}).
          </div>
        )}
        {totalGoleirosConfirmados < totalGoleirosNecessarios && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Goleiros confirmados ({totalGoleirosConfirmados}) abaixo do ideal ({totalGoleirosNecessarios}). Você pode prosseguir mesmo assim.
          </div>
        )}
        {pelada.numero_times === 3 && confirmados.filter((c) => c.eh_goleiro).length === 2 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            3 times com 2 goleiros: o sistema já equilibra automaticamente, colocando o goleiro mais fraco no time de linha mais forte (e vice-versa) nos 2 times que começam jogando. O 3º time (que começa de fora) fica sem goleiro fixo por enquanto.
          </div>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">{pendentes.length} jogador(es) sem skills definidas</div>
            <div className="text-xs opacity-90">{pendentes.map((p: any) => p.nome).join(", ")}. Receberão média neutra 3.0 no sorteio.</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Confirmados</h3>
        <div className="grid gap-2">
          {confirmados.map((j) => (
            <div key={j.user_id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{j.nome}{j.eh_goleiro ? " 🧤" : ""}</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${(j.media / 5) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-bold text-primary">{j.media.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={gerar} disabled={!minimoOk} className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          <Shuffle className="mr-2 h-4 w-4" />{times.length ? "Regerar" : "Gerar Sorteio"}
        </Button>
      </div>

      {times.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {times.map((t, i) => {
              const todos = [...t.jogadores, ...t.goleiros];
              const forca = mediaTime(todos);
              return (
                <div key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full border border-border" style={{ background: t.cor }} />
                    <Input value={t.nome} onChange={(e) => setTimes((arr) => arr.map((x, idx) => idx === i ? { ...x, nome: e.target.value } : x))} className="h-8 flex-1 bg-secondary" />
                    <input type="color" value={t.cor} onChange={(e) => setTimes((arr) => arr.map((x, idx) => idx === i ? { ...x, cor: e.target.value } : x))} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
                  </div>
                  <div className="grid gap-1.5">
                    {todos.map((j) => (
                      <div key={j.user_id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{j.eh_goleiro ? "🧤 " : ""}{j.nome}</span>
                        <span className="text-xs text-primary">{j.media.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                    Força do time: <span className="font-bold text-primary">{forca.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={confirmar} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            Confirmar Sorteio
          </Button>
        </>
      )}
    </div>
  );
}
