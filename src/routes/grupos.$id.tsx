import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Shield, Users, CircleDot, Settings, Copy, Plus, Crown, UserCog, Trash2, ArrowLeft, Home, User, UserPlus, Search, Sparkles, Info, BookOpen, FolderPlus, PiggyBank, ChevronRight, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { useConfirm } from "@/components/ConfirmProvider";
import { SKILL_KEYS, mediaSkill, type SkillRow } from "@/lib/sorteio";
import { AvaliarMembroModal } from "@/components/AvaliarMembroModal";
import { TemporadaTab } from "@/components/TemporadaTab";
import { criarMembroManual } from "@/lib/membroManual";

export const Route = createFileRoute("/grupos/$id")({
  component: GrupoPageWrapper,
});

function GrupoPageWrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><GrupoPage /></MobileShell>
    </RequireAuth>
  );
}

type Membro = {
  id: string; user_id: string; papel: "jogador" | "auxiliar" | "capitao"; status: string;
  profile: { nome: string; foto_url: string | null; cidade: string | null; cadastro_completo: boolean } | null;
  skill: SkillRow | null;
  skill_origem: string | null;
};
type Pelada = { id: string; nome_pelada: string; data: string; horario_inicio: string; status: string };
type Quadra = { id: string; nome: string; cidade: string | null };

function GrupoPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState<any>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [pendentes, setPendentes] = useState<Membro[]>([]);
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [temporadaNumero, setTemporadaNumero] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [secaoAtiva, setSecaoAtiva] = useState<"membros" | "peladas" | "regras" | "vaquinhas" | "temporada" | "config" | null>(null);

  const isCapitao = !!membros.find((m) => m.user_id === user?.id && (m.papel === "capitao" || m.papel === "auxiliar"));
  const souCapitaoExato = !!membros.find((m) => m.user_id === user?.id && m.papel === "capitao");

  const load = async () => {
    try {
      setLoading(true);
      const [g, m, p] = await Promise.all([
        supabase.from("grupos").select("*").eq("id", id).maybeSingle(),
        supabase.from("grupo_membros").select("id, user_id, papel, status").eq("grupo_id", id).in("status", ["ativo", "pendente"]),
        supabase.from("peladas").select("id, nome_pelada, data, horario_inicio, status").eq("grupo_id", id).order("data", { ascending: true }),
      ]);
      if (g.error) toast.error(g.error.message);
      setGrupo(g.data);
      const userIds = (m.data || []).map((x: any) => x.user_id);
      let profilesMap: Record<string, { nome: string; foto_url: string | null; cidade: string | null; cadastro_completo: boolean }> = {};
      let skillsMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const [pr, sk] = await Promise.all([
          supabase.from("profiles").select("user_id, nome, foto_url, cidade, cadastro_completo").in("user_id", userIds),
          supabase.from("skills").select("*").in("user_id", userIds),
        ]);
        if (pr.error) toast.error(pr.error.message);
        if (sk.error) toast.error(sk.error.message);
        (pr.data || []).forEach((x: any) => { profilesMap[x.user_id] = { nome: x.nome, foto_url: x.foto_url, cidade: x.cidade, cadastro_completo: x.cadastro_completo !== false }; });
        (sk.data || []).forEach((x: any) => { skillsMap[x.user_id] = x; });
      }
      const todos = (m.data || []).map((x: any) => ({
        ...x,
        profile: profilesMap[x.user_id] || null,
        skill: skillsMap[x.user_id] || null,
        skill_origem: skillsMap[x.user_id]?.origem_ultima_atualizacao || null,
      }));
      setMembros(todos.filter((x: any) => x.status === "ativo"));
      setPendentes(todos.filter((x: any) => x.status === "pendente"));
      setPeladas((p.data as any) || []);

      const { data: temp } = await supabase.from("temporadas").select("numero").eq("status", "ativa").maybeSingle();
      setTemporadaNumero((temp as any)?.numero ?? null);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar grupo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const capitaoMembro = membros.find((m) => m.papel === "capitao");

  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const proximaPeladaLabel = useMemo(() => {
    const agora = Date.now();
    const futuras = peladas
      .filter((p) => p.status !== "encerrada" && p.status !== "cancelada")
      .map((p) => ({ p, ts: new Date(`${p.data}T${p.horario_inicio}`).getTime() }))
      .filter((x) => Number.isFinite(x.ts) && x.ts >= agora)
      .sort((a, b) => a.ts - b.ts);
    if (!futuras.length) return "—";
    const dt = new Date(futuras[0].ts);
    return `${diasSemana[dt.getDay()]}, ${futuras[0].p.horario_inicio.slice(0, 5)}`;
  }, [peladas]);

  // "Nível do grupo" e "XP total" são derivados — ainda não existiam antes, calculados aqui
  // a partir da força média dos membros e da quantidade de peladas já realizadas.
  const mediaGrupo = useMemo(() => {
    if (!membros.length) return 3;
    const soma = membros.reduce((acc, m) => acc + (m.skill ? mediaSkill(m.skill) : 3), 0);
    return soma / membros.length;
  }, [membros]);
  const nivelGrupo = mediaGrupo >= 4.5 ? "Elite" : mediaGrupo >= 4 ? "Avançado" : mediaGrupo >= 3 ? "Intermediário" : mediaGrupo >= 2 ? "Em evolução" : "Iniciante";
  const pctNivel = Math.min(100, (mediaGrupo / 5) * 100);
  const xpTotal = peladas.filter((p) => p.status === "encerrada").length * 100;

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!grupo) return <EmptyState icon={Shield} title="Grupo não encontrado" />;

  if (secaoAtiva) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSecaoAtiva(null)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div>
          <h2 className="text-2xl font-bold">{grupo.nome}</h2>
          <p className="text-sm text-muted-foreground">Código: <span className="text-foreground font-mono">{grupo.codigo_convite}</span></p>
        </div>

        {secaoAtiva === "membros" && <MembrosTab grupo={grupo} membros={membros} pendentes={pendentes} isCapitao={isCapitao} onChange={load} />}
        {secaoAtiva === "peladas" && <PeladasTab grupoId={id} peladas={peladas} isCapitao={isCapitao} onChange={load} />}
        {secaoAtiva === "regras" && <RegrasTab grupoId={id} isCapitao={isCapitao} souCapitaoExato={souCapitaoExato} />}
        {secaoAtiva === "vaquinhas" && <VaquinhasTab grupo={grupo} membros={membros} isCapitao={isCapitao} />}
        {secaoAtiva === "temporada" && <TemporadaTab grupoId={id} />}
        {secaoAtiva === "config" && (
          <ConfigTab grupo={grupo} membros={membros} isCapitao={isCapitao} souCapitaoExato={souCapitaoExato} peladas={peladas} onChange={load} onDeleted={() => navigate({ to: "/capitao/grupos" })} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/capitao/grupos" })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <h1 className="text-3xl font-black">{grupo.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Código: <span className="font-mono font-bold text-primary">{grupo.codigo_convite}</span></p>
      </div>

      <div className="space-y-4 rounded-2xl border border-primary/30 bg-card p-4">
        <div className="text-sm font-bold text-primary">Resumo do grupo</div>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary">
            {capitaoMembro?.profile?.foto_url ? <AvatarImage src={capitaoMembro.profile.foto_url} /> : null}
            <AvatarFallback className="bg-secondary">{(capitaoMembro?.profile?.nome || "C")[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{capitaoMembro?.profile?.nome || "—"}</div>
            <div className="flex items-center gap-1 text-xs text-primary"><Crown className="h-3 w-3" /> Capitão</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold"><Users className="h-4 w-4 text-primary" />{membros.length}</div>
            <div className="text-xs text-muted-foreground">membros</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
          <span className="text-xs text-muted-foreground">Próxima pelada</span>
          <span className="text-sm font-bold text-primary">{proximaPeladaLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Nível do grupo</div>
            <div className="text-sm font-bold text-primary">{nivelGrupo}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${pctNivel}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">XP total</div>
            <div className="text-sm font-bold">{xpTotal.toLocaleString("pt-BR")} ⭐</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Temporada ativa</div>
            <div className="text-sm font-bold">{temporadaNumero != null ? `Temporada ${temporadaNumero}` : "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HubCard icon={Users} title="Membros" subtitle="Jogadores e capitão" onClick={() => setSecaoAtiva("membros")} />
        <HubCard icon={CircleDot} title="Peladas" subtitle="Agenda e histórico" onClick={() => setSecaoAtiva("peladas")} />
        <HubCard icon={BookOpen} title="Regras" subtitle="Combinados do grupo" onClick={() => setSecaoAtiva("regras")} />
        <HubCard icon={PiggyBank} title="Vaquinhas" subtitle="Pagamentos e rateios" onClick={() => setSecaoAtiva("vaquinhas")} />
        <HubCard icon={Trophy} title="Temporadas" subtitle="Pontuação e evolução" onClick={() => setSecaoAtiva("temporada")} />
        <HubCard icon={Settings} title="Configurações" subtitle="Ajustes do grupo" onClick={() => setSecaoAtiva("config")} />
      </div>
    </div>
  );
}

function HubCard({ icon: Icon, title, subtitle, onClick }: { icon: any; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50">
      <div className="flex w-full items-center justify-between">
        <Icon className="h-7 w-7 text-primary" />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
  );
}

function tituloFor(papel: string) {
  if (papel === "capitao") return { label: "Capitão", emoji: "👑" };
  if (papel === "auxiliar") return { label: "Auxiliar", emoji: "⚙️" };
  return { label: "Jogador", emoji: "🎮" };
}

function MembrosTab({ grupo, membros, pendentes, isCapitao, onChange }: { grupo: any; membros: Membro[]; pendentes: Membro[]; isCapitao: boolean; onChange: () => void }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [skillsMembro, setSkillsMembro] = useState<Membro | null>(null);
  const [avaliarMembro, setAvaliarMembro] = useState<Membro | null>(null);
  const [jaAvaliados, setJaAvaliados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("avaliacoes_skill_membro")
        .select("avaliado_id")
        .eq("avaliador_id", user.id).eq("grupo_id", grupo.id).eq("tipo", "conhecimento_previo");
      setJaAvaliados(new Set((data || []).map((x: any) => x.avaliado_id)));
    })();
  }, [user?.id, grupo.id, membros.length]);

  const setPapel = async (m: Membro, papel: "jogador" | "auxiliar") => {
    const { error } = await supabase.from("grupo_membros").update({ papel } as never).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado"); onChange();
  };
  const remover = async (m: Membro) => {
    if (!(await confirm({ title: "Remover membro", description: `Remover ${m.profile?.nome || "membro"} do grupo?`, variant: "destructive", confirmLabel: "Remover" }))) return;
    const { error } = await supabase.from("grupo_membros").update({ status: "removido" } as never).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Membro removido"); onChange();
  };

  const aceitarPendente = async (m: Membro) => {
    const { error } = await supabase.from("grupo_membros").update({ status: "ativo" } as never).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(`${m.profile?.nome || "Jogador"} aceito no grupo!`);
    onChange();
  };

  const recusarPendente = async (m: Membro) => {
    if (!(await confirm({ title: "Recusar pedido", description: `Recusar a entrada de ${m.profile?.nome || "esse jogador"} no grupo?`, variant: "destructive", confirmLabel: "Recusar" }))) return;
    const { error } = await supabase.from("grupo_membros").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido recusado");
    onChange();
  };

  return (
    <div className="space-y-4">
      {isCapitao && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Adicionar Manualmente
          </Button>
          <Button onClick={() => setConvidarOpen(true)} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            <UserPlus className="mr-2 h-4 w-4" />Convidar Jogador
          </Button>
        </div>
      )}

      {isCapitao && pendentes.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="text-sm font-bold text-amber-200">🔔 Pedidos pendentes ({pendentes.length})</div>
          {pendentes.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2">
              <div className="text-sm font-bold">{p.profile?.nome || "Jogador"}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => aceitarPendente(p)} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">Aceitar</Button>
                <Button size="sm" variant="outline" onClick={() => recusarPendente(p)}>Recusar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {membros.map((m) => {
          const nome = (m.profile?.nome && m.profile.nome.trim()) || "Jogador";
          const initials = nome.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
          const t = tituloFor(m.papel);
          const media = m.skill ? mediaSkill(m.skill) : 0;
          const pendente = !m.skill || !m.skill_origem;
          return (
            <div key={m.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {m.profile?.foto_url ? <AvatarImage src={m.profile.foto_url} /> : null}
                  <AvatarFallback className="bg-secondary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{nome}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {m.papel === "capitao" && <Crown className="h-3 w-3 text-primary" />}
                    <span>{t.emoji} {t.label}</span>
                  </div>
                </div>
                {isCapitao && m.papel !== "capitao" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSkillsMembro(m)} title="Definir Skills">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPapel(m, m.papel === "auxiliar" ? "jogador" : "auxiliar")} title={m.papel === "auxiliar" ? "Remover auxiliar" : "Tornar auxiliar"}>
                      <UserCog className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(m)} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {m.profile && !m.profile.cadastro_completo && (
                  <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/15">Cadastro pendente</Badge>
                )}
                {pendente ? (
                  <Badge className="bg-orange-500/15 text-orange-500 hover:bg-orange-500/15">Skills pendentes</Badge>
                ) : (
                  <>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${media >= 4 ? "bg-green-500" : media >= 2.5 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${(media / 5) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs font-bold text-primary">⭐ {media.toFixed(1)}</span>
                  </>
                )}
                {user && m.user_id !== user.id && !jaAvaliados.has(m.user_id) && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setAvaliarMembro(m)}>
                    Aguardando sua avaliação
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {avaliarMembro && (
        <AvaliarMembroModal
          open={!!avaliarMembro}
          onClose={() => setAvaliarMembro(null)}
          avaliado={{ user_id: avaliarMembro.user_id, nome: avaliarMembro.profile?.nome || "Jogador", foto_url: avaliarMembro.profile?.foto_url }}
          grupoId={grupo.id}
          onDone={() => { setJaAvaliados((s) => new Set([...s, avaliarMembro.user_id])); onChange(); }}
        />
      )}

      <Dialog open={convidarOpen} onOpenChange={setConvidarOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Convidar Jogador</DialogTitle></DialogHeader>
          <ConvidarJogadorModal grupo={grupo} membros={membros} onDone={() => { setConvidarOpen(false); onChange(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Adicionar Membro Manualmente</DialogTitle></DialogHeader>
          <AdicionarMembroManualModal grupoId={grupo.id} onDone={() => { setManualOpen(false); onChange(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!skillsMembro} onOpenChange={(o) => !o && setSkillsMembro(null)}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Skills — {skillsMembro?.profile?.nome}</DialogTitle></DialogHeader>
          {skillsMembro && <SkillsModal membro={skillsMembro} onDone={() => { setSkillsMembro(null); onChange(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConvidarJogadorModal({ grupo, membros, onDone }: { grupo: any; membros: Membro[]; onDone: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"buscar" | "link">("buscar");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/convite/${grupo.codigo_convite}`;
  const copy = () => { navigator.clipboard.writeText(link); toast.success("Link copiado"); };

  const memberIds = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);

  useEffect(() => {
    if (termo.trim().length < 3) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email, foto_url, cidade, role")
        .or(`nome.ilike.%${termo}%,whatsapp.ilike.%${termo}%`)
        .not("role", "in", '("dono_quadra","parceiro","admin")')
        .limit(20);
      if (error) toast.error(error.message);
      setResultados((data || []).filter((p: any) => !memberIds.has(p.user_id)));
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [termo, memberIds]);

  const convidar = async (convidado_id: string) => {
    if (!user) return;
    const { error } = await supabase.from("convites_grupo").insert({
      grupo_id: grupo.id, capitao_id: user.id, convidado_id,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Convite enviado!");
    setResultados((arr) => arr.filter((r) => r.user_id !== convidado_id));
  };

  const gerarNovoCodigo = async () => {
    const novo = "FZ-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { error } = await supabase.from("grupos").update({ codigo_convite: novo } as never).eq("id", grupo.id);
    if (error) return toast.error(error.message);
    toast.success("Novo código gerado"); onDone();
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="buscar"><Search className="mr-2 h-4 w-4" />Buscar Jogador</TabsTrigger>
        <TabsTrigger value="link"><Copy className="mr-2 h-4 w-4" />Link de Convite</TabsTrigger>
      </TabsList>

      <TabsContent value="buscar" className="mt-3 space-y-3">
        <Input placeholder="Nome ou WhatsApp (mínimo 3 letras)" value={termo} onChange={(e) => setTermo(e.target.value)} autoFocus />
        {buscando && <p className="text-xs text-muted-foreground">Buscando...</p>}
        {!buscando && termo.length >= 3 && resultados.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum jogador encontrado.</p>
        )}
        <div className="space-y-2">
          {resultados.map((r) => {
            const initials = (r.nome || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={r.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-2">
                <Avatar className="h-9 w-9">
                  {r.foto_url ? <AvatarImage src={r.foto_url} /> : null}
                  <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{r.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.cidade || "—"} · {r.role === "capitao" ? "👑 Capitão" : "🎮 Jogador"}
                  </div>
                </div>
                <Button size="sm" onClick={() => convidar(r.user_id)}>Convidar</Button>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="link" className="mt-3 space-y-3">
        <Label className="text-xs text-muted-foreground">URL de convite</Label>
        <div className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button onClick={copy} variant="secondary"><Copy className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={gerarNovoCodigo}>Gerar novo código</Button>
      </TabsContent>
    </Tabs>
  );
}

function SkillsModal({ membro, onDone }: { membro: Membro; onDone: () => void }) {
  const base = membro.skill || { velocidade: 3, drible: 3, passe: 3, chute: 3, resistencia: 3, posicionamento: 3 };
  const [vals, setVals] = useState<Record<string, number>>({
    velocidade: base.velocidade, drible: base.drible, passe: base.passe,
    chute: base.chute, resistencia: base.resistencia, posicionamento: base.posicionamento,
  });
  const [saving, setSaving] = useState(false);
  const media = SKILL_KEYS.reduce((a, k) => a + (vals[k] || 0), 0) / SKILL_KEYS.length;

  const labels: Record<string, string> = {
    velocidade: "⚡ Velocidade", drible: "🎯 Drible", passe: "🤝 Passe",
    chute: "👟 Chute", resistencia: "💪 Resistência", posicionamento: "📍 Posicionamento",
  };

  const salvar = async () => {
    setSaving(true);
    const payload: any = {
      user_id: membro.user_id,
      ...vals,
      origem_ultima_atualizacao: "capitao",
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from("skills").upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Skills salvas!");
    onDone();
  };

  return (
    <div className="space-y-3">
      {SKILL_KEYS.map((k) => (
        <div key={k}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{labels[k]}</span>
            <span className="font-bold text-primary">{vals[k]}</span>
          </div>
          <Slider min={1} max={5} step={1} value={[vals[k]]} onValueChange={([v]) => setVals({ ...vals, [k]: v })} />
        </div>
      ))}
      <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
        <div className="text-xs text-muted-foreground">Nível geral</div>
        <div className="text-2xl font-bold text-primary">⭐ {media.toFixed(1)}</div>
      </div>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          {saving ? "Salvando..." : "Salvar Skills"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function PeladasTab({ grupoId, peladas, isCapitao, onChange }: { grupoId: string; peladas: Pelada[]; isCapitao: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      {isCapitao && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Criar Pelada</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
              <DialogHeader><DialogTitle>Nova pelada</DialogTitle></DialogHeader>
              <CriarPeladaForm grupoId={grupoId} onCreated={(peladaId) => {
                setOpen(false);
                if (peladaId) {
                  navigate({ to: "/peladas/$id", params: { id: peladaId } });
                } else {
                  onChange();
                }
              }} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {peladas.length === 0 ? (
        <EmptyState icon={CircleDot} title="Nenhuma pelada criada" description="Marque a primeira pelada deste grupo." />
      ) : (
        peladas.map((p) => (
          <Link key={p.id} to="/peladas/$id" params={{ id: p.id }} className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/50">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{p.nome_pelada}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.data.split("-").reverse().join("/")} às {p.horario_inicio.slice(0,5)}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    aguardando: { label: "Aguardando", cls: "bg-yellow-500/10 text-yellow-500" },
    confirmada: { label: "Confirmada", cls: "bg-primary/10 text-primary" },
    em_andamento: { label: "Em andamento", cls: "bg-blue-500/10 text-blue-400" },
    encerrada: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
  };
  const v = map[status] || { label: status, cls: "bg-muted" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${v.cls}`}>{v.label}</span>;
}

function CriarPeladaForm({ grupoId, onCreated }: { grupoId: string; onCreated: (peladaId?: string) => void }) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<"publica" | "cliente">("publica");
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<string>("");
  const [novaQuadra, setNovaQuadra] = useState(false);
  const [novaQ, setNovaQ] = useState({ nome: "", endereco: "", cidade: "", estado: "", tipo_superficie: "society" as const, capacidade_total: 14 });
  const [form, setForm] = useState({
    nome_pelada: "", data: "", horario_inicio: "20:00", horario_fim: "22:00",
    duracao_partida_minutos: 10,
    tempo_locado_minutos: 60,
    tempo_locado_custom: false,
    gols_para_encerrar_ativo: false,
    gols_para_encerrar: 2,
    numero_times: 2,
    jogadores_linha_por_time: 4,
    goleiros_por_time: 1,
    modalidade_goleiro: "fixo" as "fixo" | "sorteado",
    sistema_disputa: "rodizio" as const,
    regra_empate_rodizio: "time_atual_sai" as "time_atual_sai" | "time_atual_fica",
    recorrente: false,
    dia_semana: 2 as number,
    antecedencia_dias_lista: 3,
    horario_abertura_lista: "09:00",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.from("quadras_publicas").select("id, nome, cidade").eq("publica", true).order("nome").then(({ data }) => setQuadras((data as any) || []));
  }, []);

  const cadastrarQuadra = async () => {
    if (!user || !novaQ.nome.trim()) return;
    const { data, error } = await supabase.from("quadras_publicas").insert({ ...novaQ, criada_por: user.id } as never).select("id, nome, cidade").single();
    if (error) return toast.error(error.message);
    setQuadras([...quadras, data as any]);
    setQuadraId((data as any).id);
    setNovaQuadra(false);
    toast.success("Quadra cadastrada");
  };

  const totalPorTime = form.jogadores_linha_por_time + form.goleiros_por_time;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { tempo_locado_custom, gols_para_encerrar_ativo, ...rest } = form;
    void tempo_locado_custom;
    const payload: any = {
      grupo_id: grupoId,
      criado_por: user.id,
      ...rest,
      jogadores_por_time: form.jogadores_linha_por_time,
      gols_para_encerrar: gols_para_encerrar_ativo ? form.gols_para_encerrar : null,
      dia_semana: form.recorrente ? form.dia_semana : null,
    };
    if (tipo === "publica" && quadraId) payload.quadra_id = quadraId;
    const { data: nova, error } = await supabase.from("peladas").insert(payload as never).select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pelada criada");
    onCreated((nova as any)?.id);
  };


  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nome da pelada</Label><Input required value={form.nome_pelada} onChange={(e) => setForm({ ...form, nome_pelada: e.target.value })} placeholder="Pelada de Quinta" /></div>

      <div>
        <Label>Tipo de quadra</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="publica">Quadra Pública</SelectItem>
            <SelectItem value="cliente">Quadra MrFut (cliente)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tipo === "publica" && (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
          {!novaQuadra ? (
            <>
              <Label>Selecionar quadra</Label>
              <Select value={quadraId} onValueChange={setQuadraId}>
                <SelectTrigger><SelectValue placeholder="Buscar..." /></SelectTrigger>
                <SelectContent>
                  {quadras.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}{q.cidade ? ` — ${q.cidade}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNovaQuadra(true)}><Plus className="mr-1 h-3 w-3" />Cadastrar nova quadra</Button>
            </>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Nome" value={novaQ.nome} onChange={(e) => setNovaQ({ ...novaQ, nome: e.target.value })} />
              <Input placeholder="Endereço" value={novaQ.endereco} onChange={(e) => setNovaQ({ ...novaQ, endereco: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Cidade" value={novaQ.cidade} onChange={(e) => setNovaQ({ ...novaQ, cidade: e.target.value })} />
                <Input placeholder="UF" maxLength={2} value={novaQ.estado} onChange={(e) => setNovaQ({ ...novaQ, estado: e.target.value })} />
              </div>
              <Select value={novaQ.tipo_superficie} onValueChange={(v) => setNovaQ({ ...novaQ, tipo_superficie: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="society">Society</SelectItem>
                  <SelectItem value="futsal">Futsal</SelectItem>
                  <SelectItem value="campo">Campo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Capacidade" value={novaQ.capacidade_total} onChange={(e) => setNovaQ({ ...novaQ, capacidade_total: +e.target.value })} />
              <div className="flex gap-2">
                <Button type="button" onClick={cadastrarQuadra} size="sm">Salvar quadra</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNovaQuadra(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
        <div><Label>Início</Label><Input type="time" required value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} /></div>
        <div><Label>Fim</Label><Input type="time" required value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} /></div>
        <div>
          <Label>Tempo locado da quadra</Label>
          <Select
            value={form.tempo_locado_custom ? "custom" : String(form.tempo_locado_minutos)}
            onValueChange={(v) => {
              if (v === "custom") setForm({ ...form, tempo_locado_custom: true });
              else setForm({ ...form, tempo_locado_custom: false, tempo_locado_minutos: +v });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60min (1h)</SelectItem>
              <SelectItem value="90">90min (1h30)</SelectItem>
              <SelectItem value="120">120min (2h)</SelectItem>
              <SelectItem value="150">150min (2h30)</SelectItem>
              <SelectItem value="180">180min (3h)</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {form.tempo_locado_custom && (
            <Input className="mt-2" type="number" min={10} value={form.tempo_locado_minutos} onChange={(e) => setForm({ ...form, tempo_locado_minutos: Math.max(10, +e.target.value || 10) })} placeholder="minutos" />
          )}
        </div>
        <div><Label>Duração de cada partida (min)</Label><Input type="number" min={1} value={form.duracao_partida_minutos} onChange={(e) => setForm({ ...form, duracao_partida_minutos: Math.max(1, +e.target.value || 1) })} /></div>
        <div>
          <Label>Nº de times</Label>
          <Select value={String(form.numero_times)} onValueChange={(v) => setForm({ ...form, numero_times: +v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Jogadores de linha/time</Label><Input type="number" min={1} value={form.jogadores_linha_por_time} onChange={(e) => setForm({ ...form, jogadores_linha_por_time: Math.max(1, +e.target.value || 1) })} /></div>
        <div>
          <Label>Goleiros/time</Label>
          <Input type="number" min={0} value={form.goleiros_por_time} onChange={(e) => setForm({ ...form, goleiros_por_time: +e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">Total por time: {totalPorTime}</p>
        </div>
        <div>
          <Label>Sistema</Label>
          <Select value={form.sistema_disputa} onValueChange={(v) => setForm({ ...form, sistema_disputa: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rodizio">Rodízio</SelectItem>
              <SelectItem value="mata_mata">Mata-mata</SelectItem>
              <SelectItem value="pontos_corridos">Pontos corridos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="cursor-pointer" htmlFor="gols-toggle">Encerrar quando um time marcar X gols</Label>
          <Switch id="gols-toggle" checked={form.gols_para_encerrar_ativo} onCheckedChange={(v) => setForm({ ...form, gols_para_encerrar_ativo: v })} />
        </div>
        {form.gols_para_encerrar_ativo && (
          <Input type="number" min={1} value={form.gols_para_encerrar} onChange={(e) => setForm({ ...form, gols_para_encerrar: +e.target.value })} />
        )}
        <p className="text-xs text-muted-foreground">A partida encerra automaticamente por tempo OU por gols, o que acontecer primeiro.</p>
      </div>

      <div className="space-y-2">
        <Label>Modalidade dos goleiros</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, modalidade_goleiro: "fixo" })}
            className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "fixo" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
          >
            <div className="font-bold">🔒 Goleiros Fixos</div>
            <div className="text-xs text-muted-foreground">Goleiros ficam nas traves toda a pelada e não entram no sorteio.</div>
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, modalidade_goleiro: "sorteado" })}
            className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "sorteado" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
          >
            <div className="font-bold">🔀 Goleiros Sorteados</div>
            <div className="text-xs text-muted-foreground">Goleiros entram no sorteio junto com os jogadores de linha.</div>
          </button>
        </div>
      </div>

      {form.numero_times === 3 && form.sistema_disputa === "rodizio" && (
        <div>
          <Label>Regra de empate (a partir da 2ª partida)</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Na 1ª partida, um empate é sempre decidido por sorteio. Da 2ª em diante, você escolhe:
          </p>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_fica" })}
              className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_fica" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
            >
              <div className="font-bold">🛡️ Time que está ganhando FICA</div>
              <div className="text-xs text-muted-foreground">O time que ganhou a rodada anterior continua jogando. O adversário atual sai, e quem estava de fora entra.</div>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_sai" })}
              className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_sai" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
            >
              <div className="font-bold">🚪 Time que está ganhando SAI</div>
              <div className="text-xs text-muted-foreground">O time que ganhou a rodada anterior sai. Quem estava jogando contra ele continua, e quem estava de fora entra.</div>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
        <Label>Essa pelada é recorrente (se repete toda semana)?</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, recorrente: false })}
            className={`rounded-xl border p-2 text-sm font-bold ${!form.recorrente ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
          >
            Não, é única
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, recorrente: true })}
            className={`rounded-xl border p-2 text-sm font-bold ${form.recorrente ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
          >
            Sim, toda semana
          </button>
        </div>
        {form.recorrente && (
          <div className="space-y-2 pt-2">
            <div>
              <Label>Dia da semana</Label>
              <Select value={String(form.dia_semana)} onValueChange={(v) => setForm({ ...form, dia_semana: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((nome, i) => (
                    <SelectItem key={i} value={String(i)}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Abrir a lista de confirmação com quantos dias de antecedência?</Label>
              <Select value={String(form.antecedencia_dias_lista)} onValueChange={(v) => setForm({ ...form, antecedencia_dias_lista: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia antes</SelectItem>
                  <SelectItem value="2">2 dias antes</SelectItem>
                  <SelectItem value="3">3 dias antes</SelectItem>
                  <SelectItem value="4">4 dias antes</SelectItem>
                  <SelectItem value="5">5 dias antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Que horas a lista abre nesse dia?</Label>
              <Input type="time" value={form.horario_abertura_lista} onChange={(e) => setForm({ ...form, horario_abertura_lista: e.target.value })} />
            </div>
            <div className="text-xs text-muted-foreground">
              Toda semana, uma nova pelada com essa mesma configuração é criada automaticamente, com a lista já aberta pros jogadores confirmarem.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        {form.numero_times} times de {form.jogadores_linha_por_time} na linha + {form.goleiros_por_time} goleiro(s) | Partidas de {form.duracao_partida_minutos}min{form.gols_para_encerrar_ativo ? ` ou ${form.gols_para_encerrar} gols` : ""} | Aluguel de {form.tempo_locado_minutos}min
      </div>


      <DialogFooter>
        <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          {loading ? "Criando..." : "Criar Pelada"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RegrasTab({ grupoId, isCapitao, souCapitaoExato }: { grupoId: string; isCapitao: boolean; souCapitaoExato: boolean }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [regras, setRegras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("grupo_regras").select("*").eq("grupo_id", grupoId).order("ordem").order("criado_em");
    setRegras(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [grupoId]);

  const abrirNova = () => { setEditando(null); setTitulo(""); setTexto(""); setFormOpen(true); };
  const abrirEdicao = (r: any) => { setEditando(r); setTitulo(r.titulo); setTexto(r.texto); setFormOpen(true); };

  const salvar = async () => {
    if (!titulo.trim() || !texto.trim() || !user) return;
    setSaving(true);
    if (editando) {
      const { error } = await (supabase as any).from("grupo_regras").update({ titulo: titulo.trim(), texto: texto.trim() } as never).eq("id", editando.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Regra atualizada");
    } else {
      const { error } = await (supabase as any).from("grupo_regras").insert({
        grupo_id: grupoId, titulo: titulo.trim(), texto: texto.trim(), ordem: regras.length, criado_por: user.id,
      } as never);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Regra criada");
    }
    setSaving(false);
    setFormOpen(false);
    void load();
  };

  const excluir = async (r: any) => {
    if (!(await confirm({ title: "Excluir regra", description: `Excluir a regra "${r.titulo}"?`, variant: "destructive", confirmLabel: "Excluir" }))) return;
    const { error } = await (supabase as any).from("grupo_regras").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Regra excluída");
    void load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-3">
      {isCapitao && (
        <Button onClick={abrirNova} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova regra
        </Button>
      )}

      {regras.length === 0 ? (
        <EmptyState icon={Info} title="Nenhuma regra cadastrada" description={isCapitao ? "Crie tópicos como 'Pênalti', 'Faltas', 'Gol de goleiro', etc." : "O capitão ainda não cadastrou regras pra esse grupo."} />
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {regras.map((r) => (
            <AccordionItem key={r.id} value={r.id} className="rounded-2xl border border-border bg-card px-4">
              <AccordionTrigger className="text-sm font-bold">{r.titulo}</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.texto}</p>
                {isCapitao && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => abrirEdicao(r)}>Editar</Button>
                    {souCapitaoExato && (
                      <Button size="sm" variant="destructive" onClick={() => excluir(r)}>Excluir</Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>{editando ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título (ex: Pênalti)</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div><Label>Regra</Label><Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Ex: O pênalti só pode ser cobrado pelo goleiro do time adversário." /></div>
            <Button onClick={salvar} disabled={saving || !titulo.trim() || !texto.trim()} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function VaquinhasTab({ grupo, membros, isCapitao }: { grupo: any; membros: Membro[]; isCapitao: boolean }) {
  const { user } = useAuth();
  const [vaquinhas, setVaquinhas] = useState<any[]>([]);
  const [participantesPorVaquinha, setParticipantesPorVaquinha] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [criarOpen, setCriarOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: vs } = await (supabase as any).from("vaquinhas").select("*").eq("grupo_id", grupo.id).order("criado_em", { ascending: false });
    setVaquinhas(vs || []);
    if (vs && vs.length) {
      const ids = vs.map((v: any) => v.id);
      const { data: parts } = await (supabase as any).from("vaquinha_participantes").select("*").in("vaquinha_id", ids);
      const userIds: string[] = Array.from(new Set((parts || []).map((p: any) => p.user_id as string)));
      const { data: profs } = userIds.length ? await supabase.from("profiles").select("user_id, nome").in("user_id", userIds) : { data: [] as any[] };
      const grouped: Record<string, any[]> = {};
      (parts || []).forEach((p: any) => {
        const nome = (profs || []).find((x: any) => x.user_id === p.user_id)?.nome || "Jogador";
        (grouped[p.vaquinha_id] ||= []).push({ ...p, nome });
      });
      setParticipantesPorVaquinha(grouped);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [grupo.id]);

  const criar = async () => {
    if (!titulo.trim() || !descricao.trim() || !user) return;
    setSaving(true);
    try {
      const { data: nova, error } = await (supabase as any).from("vaquinhas").insert({
        grupo_id: grupo.id, titulo: titulo.trim(), descricao: descricao.trim(),
        valor_sugerido: valor ? +valor : null, criado_por: user.id,
      }).select("id").single();
      if (error) throw error;
      const vaquinhaId = nova.id;

      const rows = membros.map((m) => ({ vaquinha_id: vaquinhaId, user_id: m.user_id }));
      if (rows.length) {
        const { error: errParts } = await (supabase as any).from("vaquinha_participantes").insert(rows);
        if (errParts) throw errParts;
      }

      const notifs = membros.filter((m) => m.user_id !== user.id).map((m) => ({
        user_id: m.user_id,
        titulo: "💰 Nova vaquinha!",
        mensagem: `O capitão criou a vaquinha "${titulo.trim()}" no grupo "${grupo.nome}". Você topa participar?`,
        link: "/jogador/vaquinhas",
      }));
      if (notifs.length) await supabase.from("notificacoes").insert(notifs as never);

      toast.success("Vaquinha criada!");
      setCriarOpen(false); setTitulo(""); setDescricao(""); setValor("");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar vaquinha");
    } finally {
      setSaving(false);
    }
  };

  const confirmarPagamento = async (participanteId: string) => {
    const { error } = await (supabase as any).from("vaquinha_participantes").update({
      pagamento_status: "confirmado", confirmado_em: new Date().toISOString(),
    }).eq("id", participanteId);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado!");
    void load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-3">
      {isCapitao && (
        <Button onClick={() => setCriarOpen(true)} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova vaquinha
        </Button>
      )}

      {vaquinhas.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Nenhuma vaquinha ainda" description={isCapitao ? "Crie uma vaquinha pra dividir custos do grupo." : "Quando o capitão criar, aparece aqui."} />
      ) : (
        <div className="space-y-3">
          {vaquinhas.map((v) => {
            const participantes = participantesPorVaquinha[v.id] || [];
            const aceitos = participantes.filter((p) => p.status === "aceito");
            const confirmados = participantes.filter((p) => p.pagamento_status === "confirmado");
            const minhaLinha = participantes.find((p) => p.user_id === user?.id);
            return (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="font-bold">💰 {v.titulo}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.descricao}</p>
                {v.valor_sugerido && <p className="text-sm">Valor sugerido: <span className="font-bold">R$ {Number(v.valor_sugerido).toFixed(2)}</span></p>}

                {isCapitao ? (
                  <>
                    <div className="text-xs text-muted-foreground pt-1">
                      {aceitos.length} de {participantes.length} toparam · {confirmados.length} pagamentos confirmados
                    </div>
                    <div className="space-y-1 pt-1">
                      {participantes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 rounded bg-secondary/30 px-2 py-1.5 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold">{p.nome}</span>{" "}
                            <span className="text-muted-foreground">
                              {p.status === "aceito" ? "✅ topou" : p.status === "recusado" ? "❌ recusou" : "⏳ sem resposta"}
                              {p.pagamento_status === "informado" && ` · 💳 disse que pagou (${p.forma_pagamento || "não informou como"})`}
                              {p.pagamento_status === "confirmado" && " · ✅ pago confirmado"}
                            </span>
                          </div>
                          {p.pagamento_status === "informado" && (
                            <Button size="sm" onClick={() => confirmarPagamento(p.id)} className="shrink-0 bg-primary text-primary-foreground font-bold hover:bg-primary/90">Confirmar</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  minhaLinha && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Sua participação:{" "}
                      {minhaLinha.status === "aceito" ? "✅ você topou" : minhaLinha.status === "recusado" ? "❌ você recusou" : "⏳ responda na Caixinha do Time"}
                      {minhaLinha.pagamento_status === "confirmado" && " · pago ✅"}
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Nova vaquinha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Uniforme novo do time" /></div>
            <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Explica pra que é e como pagar (Pix, valor, prazo etc)" /></div>
            <div><Label>Valor sugerido por pessoa (opcional)</Label><Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 25.00" /></div>
            <Button onClick={criar} disabled={saving || !titulo.trim() || !descricao.trim()} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {saving ? "Criando..." : "Criar e notificar o grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigTab({ grupo, membros, isCapitao, souCapitaoExato, peladas, onChange, onDeleted }: { grupo: any; membros: Membro[]; isCapitao: boolean; souCapitaoExato: boolean; peladas: Pelada[]; onChange: () => void; onDeleted: () => void }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [nome, setNome] = useState(grupo.nome);
  const [duplicarOpen, setDuplicarOpen] = useState(false);
  const temAtiva = peladas.some((p) => p.status === "em_andamento");

  const salvar = async () => {
    const { error } = await supabase.from("grupos").update({ nome } as never).eq("id", grupo.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); onChange();
  };
  const regen = async () => {
    const { error } = await supabase.from("grupos").update({ codigo_convite: "" } as never).eq("id", grupo.id);
    if (error) return toast.error(error.message);
    const novo = "FZ-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    await supabase.from("grupos").update({ codigo_convite: novo } as never).eq("id", grupo.id);
    toast.success("Novo código gerado"); onChange();
  };
  const excluir = async () => {
    if (temAtiva) return toast.error("Existem peladas em andamento");
    if (!(await confirm({ title: "Excluir grupo", description: "Excluir grupo definitivamente? Essa ação não pode ser desfeita.", variant: "destructive", confirmLabel: "Excluir" }))) return;
    const { error } = await supabase.from("grupos").delete().eq("id", grupo.id);
    if (error) return toast.error(error.message);
    toast.success("Grupo excluído"); onDeleted();
  };

  if (!isCapitao) return <EmptyState icon={Settings} title="Apenas o capitão pode editar" />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div><Label>Nome do grupo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <Button onClick={salvar} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">Salvar alterações</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="text-sm font-bold">Código de convite</div>
        <div className="font-mono text-sm">{grupo.codigo_convite}</div>
        <Button variant="secondary" onClick={regen}>Regenerar código</Button>
      </div>
      {souCapitaoExato && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold"><FolderPlus className="h-4 w-4 text-primary" /> Duplicar grupo</div>
          <p className="text-xs text-muted-foreground">
            Cria um grupo novo já com as mesmas regras cadastradas — sem precisar configurar tudo de novo. Você escolhe se quer convidar membros também.
          </p>
          <Button variant="secondary" onClick={() => setDuplicarOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" /> Duplicar esse grupo
          </Button>
        </div>
      )}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <div className="text-sm font-bold text-destructive">Zona de perigo</div>
        <p className="text-xs text-muted-foreground">{temAtiva ? "Não é possível excluir com peladas em andamento." : "Esta ação não pode ser desfeita."}</p>
        <Button variant="destructive" onClick={excluir} disabled={temAtiva}><Trash2 className="mr-2 h-4 w-4" />Excluir grupo</Button>
      </div>

      <DuplicarGrupoModal
        open={duplicarOpen}
        onOpenChange={setDuplicarOpen}
        grupo={grupo}
        membros={membros}
        onDone={(novoGrupoId) => navigate({ to: "/grupos/$id", params: { id: novoGrupoId } })}
      />
    </div>
  );
}

function DuplicarGrupoModal({ open, onOpenChange, grupo, membros, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; grupo: any; membros: Membro[]; onDone: (novoGrupoId: string) => void;
}) {
  const { user } = useAuth();
  const [novoNome, setNovoNome] = useState(`Cópia de ${grupo.nome}`);
  const [incluirMembros, setIncluirMembros] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const outrosMembros = membros.filter((m) => m.user_id !== user?.id);

  useEffect(() => {
    if (open) { setNovoNome(`Cópia de ${grupo.nome}`); setIncluirMembros(false); setSelecionados(new Set()); }
  }, [open, grupo.nome]);

  const toggleTodos = () => {
    setSelecionados((prev) => prev.size === outrosMembros.length ? new Set() : new Set(outrosMembros.map((m) => m.user_id)));
  };

  const duplicar = async () => {
    if (!novoNome.trim() || !user || saving) return;
    setSaving(true);
    try {
      const novoCodigo = "FZ-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const { data: novoGrupo, error: errGrupo } = await supabase.from("grupos").insert({
        nome: novoNome.trim(), criado_por: user.id, codigo_convite: novoCodigo,
      } as never).select("id").single();
      if (errGrupo) throw errGrupo;
      const novoGrupoId = (novoGrupo as any).id;

      const { error: errMembro } = await supabase.from("grupo_membros").insert({
        grupo_id: novoGrupoId, user_id: user.id, papel: "capitao", status: "ativo",
      } as never);
      if (errMembro) throw errMembro;

      const { data: regrasOriginais } = await (supabase as any).from("grupo_regras").select("titulo, texto, ordem").eq("grupo_id", grupo.id);
      if (regrasOriginais && regrasOriginais.length > 0) {
        await (supabase as any).from("grupo_regras").insert(
          regrasOriginais.map((r: any) => ({ grupo_id: novoGrupoId, titulo: r.titulo, texto: r.texto, ordem: r.ordem, criado_por: user.id })) as never,
        );
      }

      if (incluirMembros && selecionados.size > 0) {
        const convites = Array.from(selecionados).map((convidado_id) => ({
          grupo_id: novoGrupoId, capitao_id: user.id, convidado_id,
        }));
        await supabase.from("convites_grupo").insert(convites as never);
      }

      toast.success(incluirMembros && selecionados.size > 0
        ? `Grupo duplicado! Convite enviado pra ${selecionados.size} pessoa(s).`
        : "Grupo duplicado!");
      onOpenChange(false);
      onDone(novoGrupoId);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao duplicar grupo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader><DialogTitle>Duplicar grupo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome do novo grupo</Label><Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">As regras cadastradas nesse grupo serão copiadas automaticamente pro novo.</p>

          <div className="flex items-center gap-2">
            <Checkbox checked={incluirMembros} onCheckedChange={(v) => setIncluirMembros(!!v)} id="incluir-membros" />
            <Label htmlFor="incluir-membros">Convidar membros pro novo grupo</Label>
          </div>

          {incluirMembros && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{selecionados.size} de {outrosMembros.length} selecionados</span>
                <button type="button" onClick={toggleTodos} className="text-xs font-bold text-primary">
                  {selecionados.size === outrosMembros.length ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              {outrosMembros.map((m) => (
                <label key={m.user_id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selecionados.has(m.user_id)}
                    onCheckedChange={(v) => {
                      setSelecionados((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(m.user_id); else next.delete(m.user_id);
                        return next;
                      });
                    }}
                  />
                  {m.profile?.nome || "Jogador"}
                </label>
              ))}
              {outrosMembros.length === 0 && <p className="text-xs text-muted-foreground">Nenhum outro membro nesse grupo ainda.</p>}
            </div>
          )}

          <Button onClick={duplicar} disabled={saving || !novoNome.trim()} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            {saving ? "Duplicando..." : "Duplicar grupo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdicionarMembroManualModal({ grupoId, onDone }: { grupoId: string; onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  const [loading, setLoading] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    try {
      const res = await criarMembroManual(grupoId, nome, posicao === "goleiro");
      setLinkGerado(res.linkConvite);
      toast.success("Membro adicionado ao grupo!");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar membro.");
    } finally {
      setLoading(false);
    }
  };

  const copiar = () => {
    if (!linkGerado) return;
    navigator.clipboard.writeText(linkGerado);
    toast.success("Link copiado!");
  };

  const outro = () => {
    setNome("");
    setPosicao("linha");
    setLinkGerado(null);
  };

  if (linkGerado) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          ⚠️ Copie o link agora! Ele não pode ser gerado novamente depois.
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Link de convite pessoal</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={linkGerado} className="font-mono text-xs" />
            <Button onClick={copiar} variant="secondary"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie esse link para o jogador. Ao abrir, ele vai completar o cadastro (email, senha e whatsapp) e já cai direto no grupo.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={outro}>Adicionar outro membro</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="mm-nome">Nome do jogador</Label>
        <Input id="mm-nome" required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João Silva" />
      </div>
      <div>
        <Label>Posição</Label>
        <RadioGroup value={posicao} onValueChange={(v) => setPosicao(v as "linha" | "goleiro")} className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-sm cursor-pointer">
            <RadioGroupItem value="linha" id="mm-linha" /> Jogador de linha
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-sm cursor-pointer">
            <RadioGroupItem value="goleiro" id="mm-goleiro" /> Goleiro 🧤
          </label>
        </RadioGroup>
      </div>
      <p className="text-xs text-muted-foreground">
        Vamos criar uma conta provisória e um link único para o jogador completar o cadastro. Ele já entra no grupo imediatamente e pode ser escalado nos sorteios.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          {loading ? "Adicionando..." : "Adicionar e gerar link"}
        </Button>
      </DialogFooter>
    </form>
  );
}
