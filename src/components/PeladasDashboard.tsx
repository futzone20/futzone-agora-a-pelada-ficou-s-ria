import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CircleDot, Calendar, Clock, Plus, Radio, CalendarDays, Users, CheckCircle2,
  Star, ChevronRight, ChevronDown, Trophy, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { statusLabel } from "@/lib/pelada-status";

type Row = {
  id: string; nome_pelada: string; data: string; horario_inicio: string; status: string;
  grupoNome: string;
  confirmadosNomes: { user_id: string; nome: string; foto_url: string | null }[];
  totalConfirmados: number;
};

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function AvatarStack({ pessoas, total }: { pessoas: { nome: string; foto_url: string | null }[]; total: number }) {
  const extra = total - pessoas.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {pessoas.slice(0, 4).map((p, i) => (
          <Avatar key={i} className="h-7 w-7 border-2 border-background">
            {p.foto_url ? <AvatarImage src={p.foto_url} /> : null}
            <AvatarFallback className="bg-secondary text-[10px]">{(p.nome || "?")[0]}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      {extra > 0 && <span className="ml-1 text-xs font-bold text-muted-foreground">+{extra}</span>}
    </div>
  );
}

/**
 * Dashboard de peladas — usado tanto na home de jogador (`/jogador/peladas`, mostra peladas de
 * todos os grupos que a pessoa participa) quanto na de capitão (`/capitao/peladas`, mostra só
 * peladas dos grupos onde a pessoa é capitão ou auxiliar).
 */
export function PeladasDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "em_andamento" | "aguardando" | "confirmada" | "encerrada">("todas");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [mesFiltro, setMesFiltro] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: ms } = await supabase.from("grupo_membros").select("grupo_id, papel").eq("user_id", user.id).eq("status", "ativo");
      const grupoIds = Array.from(new Set((ms || []).map((m: any) => m.grupo_id as string)));
      if (grupoIds.length === 0) { setRows([]); setLoading(false); return; }

      const { data: grupos } = await supabase.from("grupos").select("id, nome").in("id", grupoIds);
      const grupoNomeMap: Record<string, string> = {};
      (grupos || []).forEach((g: any) => { grupoNomeMap[g.id] = g.nome; });

      const { data: peladas } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, status, grupo_id")
        .in("grupo_id", grupoIds)
        .not("status", "eq", "cancelada")
        .order("data", { ascending: true });

      const peladaIds = (peladas || []).map((p: any) => p.id);
      const { data: confs } = peladaIds.length
        ? await supabase.from("pelada_confirmacoes").select("pelada_id, user_id, status").in("pelada_id", peladaIds).eq("status", "confirmado")
        : { data: [] as any[] };

      const userIds = Array.from(new Set((confs || []).map((c: any) => c.user_id as string)));
      const { data: profs } = userIds.length ? await supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", userIds) : { data: [] as any[] };
      const profMap: Record<string, { nome: string; foto_url: string | null }> = {};
      (profs || []).forEach((p: any) => { profMap[p.user_id] = { nome: p.nome, foto_url: p.foto_url }; });

      const out: Row[] = (peladas || []).map((p: any) => {
        const confirmadosDaPelada = (confs || []).filter((c: any) => c.pelada_id === p.id);
        return {
          id: p.id, nome_pelada: p.nome_pelada, data: p.data, horario_inicio: p.horario_inicio, status: p.status,
          grupoNome: grupoNomeMap[p.grupo_id] || "Grupo",
          confirmadosNomes: confirmadosDaPelada.map((c: any) => ({ user_id: c.user_id, ...(profMap[c.user_id] || { nome: "Jogador", foto_url: null }) })),
          totalConfirmados: confirmadosDaPelada.length,
        };
      });
      setRows(out);
      setLoading(false);
    })();
  }, [user?.id]);

  const aoVivo = useMemo(() => rows.filter((r) => r.status === "em_andamento"), [rows]);
  const abertas = useMemo(() => rows.filter((r) => r.status === "aguardando"), [rows]);
  const proximas = useMemo(() => rows.filter((r) => r.status === "confirmada"), [rows]);
  const encerradas = useMemo(() => rows.filter((r) => r.status === "encerrada"), [rows]);

  const proximasEAbertas = useMemo(
    () => [...abertas, ...proximas].sort((a, b) => new Date(`${a.data}T${a.horario_inicio}`).getTime() - new Date(`${b.data}T${b.horario_inicio}`).getTime()),
    [abertas, proximas],
  );

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(encerradas.map((r) => r.data.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [encerradas]);

  const encerradasDoMes = useMemo(
    () => encerradas.filter((r) => r.data.slice(0, 7) === mesFiltro).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [encerradas, mesFiltro],
  );

  const listaFiltrada = useMemo(() => {
    if (filtro === "todas") return [];
    return rows.filter((r) => r.status === filtro).sort((a, b) => new Date(`${a.data}T${a.horario_inicio}`).getTime() - new Date(`${b.data}T${b.horario_inicio}`).getTime());
  }, [rows, filtro]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Peladas</h2>
          <CriarGrupoButton />
        </div>
        <EmptyStateSemPeladas />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black">Peladas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Partidas, listas e resultados</p>
          </div>
          <CriarGrupoButton />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-bold"><Radio className="h-4 w-4 text-primary" />{aoVivo.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Ao vivo</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-bold"><CalendarDays className="h-4 w-4 text-primary" />{proximas.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Próximas</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-bold"><Users className="h-4 w-4 text-primary" />{abertas.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Lista aberta</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-bold"><CheckCircle2 className="h-4 w-4 text-primary" />{encerradas.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Encerradas</div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { v: "todas", label: "Todas" },
          { v: "em_andamento", label: "Em andamento" },
          { v: "aguardando", label: "Lista aberta" },
          { v: "confirmada", label: "Próximas" },
          { v: "encerrada", label: "Encerradas" },
        ] as const).map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${filtro === f.v ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtro !== "todas" ? (
        listaFiltrada.length === 0 ? (
          <EmptyStateFiltro />
        ) : (
          <div className="space-y-2">
            {listaFiltrada.map((p) => <PeladaRowCard key={p.id} p={p} />)}
          </div>
        )
      ) : (
        <>
          {aoVivo.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary"><Star className="h-3.5 w-3.5" /> Destaque</div>
              {aoVivo.map((p) => (
                <Link key={p.id} to="/peladas/$id" params={{ id: p.id }} className="block rounded-2xl border border-primary bg-gradient-to-br from-primary/10 to-card p-5 shadow-[0_0_20px_rgba(0,255,135,0.15)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/10">
                      <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Em andamento
                      </span>
                      <div className="mt-1 truncate text-lg font-bold">{p.nome_pelada}</div>
                      <div className="text-xs text-muted-foreground">{p.grupoNome}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0, 5)}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.totalConfirmados} confirmados</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">
                    Acompanhar agora <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </section>
          )}

          {proximasEAbertas.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary"><Calendar className="h-3.5 w-3.5" /> Próximas e abertas</div>
              {proximasEAbertas.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/peladas/$id"
                  params={{ id: p.id }}
                  className={`block rounded-2xl border p-4 ${p.status === "aguardando" ? "border-yellow-500/50 bg-yellow-500/5" : "border-border bg-card"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.status === "aguardando" ? "bg-yellow-500/15 text-yellow-500" : "bg-primary/15 text-primary"}`}>
                      {p.status === "aguardando" ? <Users className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold">{p.nome_pelada}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${p.status === "aguardando" ? "bg-yellow-500/20 text-yellow-500" : "bg-primary/15 text-primary"}`}>
                          {p.status === "aguardando" ? "Lista liberada" : "Próxima"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.grupoNome}</div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0, 5)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <AvatarStack pessoas={p.confirmadosNomes} total={p.totalConfirmados} />
                    <span className={`flex items-center gap-1 text-xs font-bold ${p.status === "aguardando" ? "text-yellow-500" : "text-primary"}`}>
                      {p.status === "aguardando" ? "Entrar na lista" : "Ver detalhes"} <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <button onClick={() => setHistoricoAberto((v) => !v)} className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-primary">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Histórico recente</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${historicoAberto ? "rotate-180" : ""}`} />
            </button>

            {historicoAberto && (
              <div className="space-y-2">
                {mesesDisponiveis.length > 0 && (
                  <Select value={mesFiltro} onValueChange={setMesFiltro}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {mesesDisponiveis.map((m) => {
                        const [ano, mes] = m.split("-");
                        return <SelectItem key={m} value={m}>{MESES[+mes - 1]} de {ano}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )}

                {encerradasDoMes.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma pelada encerrada nesse mês.</p>
                ) : (
                  encerradasDoMes.map((p) => <PeladaRowCard key={p.id} p={p} />)
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PeladaRowCard({ p }: { p: Row }) {
  return (
    <Link to="/peladas/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{p.nome_pelada}</div>
        <div className="text-xs text-muted-foreground">{p.grupoNome}</div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0, 5)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{statusLabel(p.status)}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-primary">Ver detalhes <ChevronRight className="h-3.5 w-3.5" /></span>
      </div>
    </Link>
  );
}

function EmptyStateSemPeladas() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <CircleDot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <div className="font-bold">Você ainda não tem peladas</div>
      <p className="mt-1 text-sm text-muted-foreground">Crie um grupo ou entre em um via convite para ver peladas aqui.</p>
    </div>
  );
}

function EmptyStateFiltro() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      Nenhuma pelada nessa categoria.
    </div>
  );
}

function CriarGrupoButton() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos").insert({ nome: nome.trim(), criado_por: user.id, codigo_convite: "" } as never)
      .select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    setOpen(false); setNome("");
    toast.success("Grupo criado");
    await refresh();
    navigate({ to: "/grupos/$id", params: { id: (data as any).id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary/10" title="Criar grupo">
          <Plus className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle>Criar Grupo</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Nome do grupo</Label><Input required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pelada de Quinta" /></div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {loading ? "Criando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
