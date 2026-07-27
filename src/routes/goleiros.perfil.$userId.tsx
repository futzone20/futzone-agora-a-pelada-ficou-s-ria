import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Star, Trophy, Shield, Target, ArrowLeft, Send, LogIn, ChevronDown, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/goleiros/perfil/$userId")({ component: GoleiroPerfilPublico });

const SKILLS_LABELS: { key: string; label: string; emoji: string }[] = [
  { key: "reflexo", label: "Reflexo", emoji: "⚡" },
  { key: "seguranca", label: "Segurança", emoji: "🧤" },
  { key: "jogo_aereo", label: "Jogo aéreo", emoji: "🕊️" },
  { key: "saida_pes", label: "Saída com os pés", emoji: "🦶" },
  { key: "posicionamento", label: "Posicionamento", emoji: "📍" },
  { key: "comando_area", label: "Comando de área", emoji: "📣" },
];

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function GoleiroPerfilPublico() {
  const { userId: identificador } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const [disp, setDisp] = useState<any[]>([]);
  const [dispAberta, setDispAberta] = useState(false);
  const [peladas, setPeladas] = useState<any[]>([]);
  const [openConvite, setOpenConvite] = useState(false);
  const [form, setForm] = useState<any>({ pelada_id: "", data: "", horario_inicio: "", horario_fim: "", arena_nome: "", valor_combinado: "", mensagem: "" });

  useEffect(() => {
    (async () => {
      let userIdReal = identificador;
      // Link no formato /goleiros/perfil/@handle — resolve o @handle pro user_id de verdade.
      if (identificador.startsWith("@")) {
        const { data: prof, error: errProf } = await (supabase as any)
          .from("profiles").select("user_id").eq("handle", identificador.slice(1)).maybeSingle();
        if (errProf || !prof) { setErro(true); setLoading(false); return; }
        userIdReal = (prof as any).user_id;
      }
      const { data, error } = await (supabase as any).rpc("goleiro_perfil_publico", { _user_id: userIdReal });
      if (error || !data?.perfil) { setErro(true); setLoading(false); return; }
      setDados(data);
      if (data.marketplace?.id) {
        const { data: d } = await supabase.from("goleiros_disponibilidade").select("*").eq("goleiro_id", data.marketplace.id).order("dia_semana");
        setDisp(d ?? []);
      }
      setLoading(false);
    })();
  }, [identificador]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("peladas").select("id, nome_pelada, data, horario_inicio, horario_fim, local_nome").eq("criado_por", user.id).in("status", ["aguardando", "confirmada"]).order("data", { ascending: false }).limit(20);
      setPeladas(data ?? []);
    })();
  }, [user?.id]);

  const selectPelada = (pid: string) => {
    const p = peladas.find((x) => x.id === pid); if (!p) return;
    setForm({ ...form, pelada_id: pid, data: p.data, horario_inicio: p.horario_inicio, horario_fim: p.horario_fim || p.horario_inicio, arena_nome: p.local_nome });
  };

  const enviarConvite = async () => {
    if (!user || !dados?.marketplace?.id) return;
    const { error } = await supabase.from("goleiros_convites").insert({
      pelada_id: form.pelada_id || null, capitao_id: user.id, goleiro_id: dados.marketplace.id,
      data: form.data, horario_inicio: form.horario_inicio, horario_fim: form.horario_fim,
      arena_nome: form.arena_nome, valor_combinado: form.valor_combinado ? Number(form.valor_combinado) : null,
      mensagem: form.mensagem || null,
    } as never);
    if (error) toast.error(error.message); else { toast.success("Convite enviado!"); setOpenConvite(false); }
  };

  const Voltar = () => (
    <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowLeft className="h-4 w-4" /> Voltar
    </button>
  );

  if (loading) return <div className="p-4 space-y-4"><Voltar /><p className="text-center text-sm text-muted-foreground py-8">Carregando...</p></div>;
  if (erro || !dados) return <div className="p-4 space-y-4"><Voltar /><p className="text-center text-sm text-muted-foreground py-8">Perfil não encontrado.</p></div>;

  const { perfil, jogando_agora, skills, carreira, marketplace, selos } = dados;
  const nivel = skills?.nivel_geral ?? 3;
  const totalAvaliacoes = skills?.total_avaliacoes_recebidas ?? 0;

  const partidas = carreira?.partidas_jogadas ?? 0;
  const vitorias = carreira?.vitorias ?? 0;
  const empates = carreira?.empates ?? 0;
  const derrotas = carreira?.derrotas ?? 0;
  const golsSofridos = carreira?.gols_sofridos_carreira ?? 0;
  const semSofrerGol = carreira?.jogos_sem_sofrer_gol ?? 0;
  const mediaGolsSofridos = partidas > 0 ? (golsSofridos / partidas).toFixed(2) : "—";

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-3">
      <Voltar />
      <Card className="p-4 flex gap-4 items-center">
        <div className="relative w-20 h-20 shrink-0 rounded-full bg-muted overflow-hidden">
          {perfil.foto_url && <img src={perfil.foto_url} className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">🧤 {perfil.nome}</h1>
            {jogando_agora && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Jogando agora
              </span>
            )}
          </div>
          {perfil.handle && <p className="text-sm font-medium text-primary">@{perfil.handle}</p>}
          <p className="text-sm text-muted-foreground">{perfil.cidade}{perfil.estado && `/${perfil.estado}`}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold">{nivel.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({totalAvaliacoes})</span>
          </div>
          {selos?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {selos.map((s: any) => (
                <span key={s.codigo} title={s.nome} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {s.emoji} {s.nome}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {perfil.bio && (
        <Card className="p-4">
          <p className="text-sm">{perfil.bio}</p>
        </Card>
      )}

      {/* Catálogo: tipos de quadra, preço, bio profissional, convite e disponibilidade */}
      {marketplace?.ativo_catalogo && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-wrap">{marketplace.tipos_quadra?.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
            {marketplace.valor_hora ? (
              <div className="text-emerald-500 font-bold text-lg">R$ {Number(marketplace.valor_hora).toFixed(2)}/h</div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">Sem cobrança fixa</div>
            )}
          </div>
          {marketplace.bio && <p className="text-sm">{marketplace.bio}</p>}

          {/* Disponibilidade — acordião fechado por padrão */}
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setDispAberta((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-bold"
            >
              <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Disponibilidade</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dispAberta ? "rotate-180" : ""}`} />
            </button>
            {dispAberta && (
              <div className="border-t border-border px-3 py-2">
                {disp.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">Sem horários fixos cadastrados.</p>
                ) : disp.map((d) => (
                  <div key={d.id} className="text-sm flex justify-between py-1">
                    <span>{DIAS[d.dia_semana]}</span>
                    <span>{d.horario_inicio?.slice(0, 5)} – {d.horario_fim?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {marketplace.id && (
            !user ? (
              <Button onClick={() => navigate({ to: "/login" })} className="w-full bg-primary font-bold">
                <LogIn className="h-4 w-4 mr-1.5" /> Fazer login para contratar
              </Button>
            ) : (
              <Dialog open={openConvite} onOpenChange={setOpenConvite}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary font-bold"><Send className="h-4 w-4 mr-1.5" /> Convidar para pelada</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Convidar {perfil.nome}</DialogTitle>
                    <DialogDescription>Escolha a pelada, data e horário pra enviar o convite.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {peladas.length > 0 && (
                      <div>
                        <Label>Pelada</Label>
                        <Select value={form.pelada_id} onValueChange={selectPelada}>
                          <SelectTrigger><SelectValue placeholder="Sua pelada" /></SelectTrigger>
                          <SelectContent>{peladas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_pelada} — {p.data}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Início</Label><Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} /></div>
                      <div><Label>Fim</Label><Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} /></div>
                    </div>
                    <div><Label>Arena</Label><Input value={form.arena_nome} onChange={(e) => setForm({ ...form, arena_nome: e.target.value })} /></div>
                    <div><Label>Valor (opcional)</Label><Input type="number" step="0.01" value={form.valor_combinado} onChange={(e) => setForm({ ...form, valor_combinado: e.target.value })} /></div>
                    <div><Label>Mensagem</Label><Textarea maxLength={200} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} /></div>
                    <Button onClick={enviarConvite} className="w-full" disabled={!form.data || !form.horario_inicio}>Enviar Convite</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )
          )}
        </Card>
      )}

      {/* Nível geral + skills */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Nível de Goleiro</h3>
          <div className="text-2xl font-extrabold text-primary">{nivel.toFixed(1)}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalAvaliacoes > 0
            ? `Baseado em ${totalAvaliacoes} avaliaç${totalAvaliacoes === 1 ? "ão" : "ões"} de quem jogou com ele`
            : "Ainda sem avaliações — nível inicial padrão"}
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
          {SKILLS_LABELS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.emoji} {s.label}</span>
              <span className="font-bold">{(skills?.[s.key] ?? 3).toFixed?.(0) ?? skills?.[s.key] ?? 3}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Carreira */}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold flex items-center gap-1.5"><Trophy className="h-4 w-4 text-primary" /> Carreira</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-extrabold">{partidas}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Partidas</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-green-500">{vitorias}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Vitórias</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-yellow-500">{empates}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Empates</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-red-500">{derrotas}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Derrotas</div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Target className="h-3.5 w-3.5" /> Gols sofridos na carreira</span>
          <span className="font-bold">{golsSofridos} <span className="text-xs font-normal text-muted-foreground">({mediaGolsSofridos}/partida)</span></span>
        </div>
        {partidas > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">🧱 Partidas sem sofrer gol</span>
            <span className="font-bold">{semSofrerGol} <span className="text-xs font-normal text-muted-foreground">de {partidas}</span></span>
          </div>
        )}
        {partidas === 0 && (
          <p className="text-xs text-muted-foreground">
            Carreira contada a partir de agora — partidas jogadas antes dessa atualização não entram na conta.
          </p>
        )}
      </Card>
    </div>
  );
}
