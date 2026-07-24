import { useEffect, useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CentralMensagensCard } from "@/components/CentralMensagensCard";
import {
  Copy, ArrowLeft, ChevronRight, User, Radar as RadarIcon, Flame, Star,
  MessageCircle, UserPlus, Settings, MapPin, Pencil, Shirt, LogOut, Clock, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { calcularResumoJogadorPelada, type ResumoJogadorPelada } from "@/lib/resumoJogadorPelada";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const SKILL_KEYS = ["velocidade","drible","passe","chute","resistencia","posicionamento"] as const;
const SKILL_LABELS: Record<typeof SKILL_KEYS[number], string> = {
  velocidade: "⚡ Velocidade", drible: "✨ Drible", passe: "🎯 Passe",
  chute: "💥 Chute", resistencia: "🫁 Resistência", posicionamento: "🧠 Posicionamento",
};
type SkillKey = typeof SKILL_KEYS[number];
type Secao = "dados" | "skills" | "ofensiva" | "pontos" | "whatsapp" | "indicar" | "conta" | "historico" | null;

const skillColor = (v: number) => v >= 4 ? "bg-green-500" : v >= 2.5 ? "bg-yellow-500" : "bg-red-500";
const nivelLabel = (m: number) => m >= 4.5 ? "Elite" : m >= 4 ? "Acima da média" : m >= 3 ? "Bom" : m >= 2 ? "Em evolução" : "Iniciante";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export function PerfilCompleto() {
  const { user, updateUser, signOut } = useAuth();
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>(null);
  const [form, setForm] = useState({
    nome: "", whatsapp: "", nascimento: "", cidade: "", estado: "",
    peso: "", altura: "", posicao: "linha", bio: "",
  });
  const [skills, setSkills] = useState<Record<SkillKey, number>>({ velocidade:3,drible:3,passe:3,chute:3,resistencia:3,posicionamento:3 });
  const [skillsMeta, setSkillsMeta] = useState({ total: 0, peso: 1 });
  const [pontos, setPontos] = useState(0);
  const [ofensiva, setOfensiva] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [whatsapp, setWhatsapp] = useState<{ conectado: boolean; numero: string | null }>({ conectado: false, numero: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      nome: user.nome || "", whatsapp: user.whatsapp || "", nascimento: user.nascimento || "",
      cidade: user.cidade || "", estado: user.estado || "",
      peso: user.peso?.toString() || "", altura: user.altura?.toString() || "",
      posicao: user.posicao || "linha", bio: user.bio || "",
    });
    void (async () => {
      const { data: sk } = await supabase.from("skills")
        .select("velocidade,drible,passe,chute,resistencia,posicionamento,total_avaliacoes_recebidas,peso_capitao_atual")
        .eq("user_id", user.id).maybeSingle();
      if (sk) {
        setSkills(sk as any);
        setSkillsMeta({ total: (sk as any).total_avaliacoes_recebidas || 0, peso: (sk as any).peso_capitao_atual ?? 1 });
      }
      const { data: prof } = await supabase.from("profiles").select("pontos_total, whatsapp_conectado, whatsapp_numero").eq("user_id", user.id).maybeSingle();
      setPontos((prof as any)?.pontos_total || 0);
      setWhatsapp({ conectado: !!(prof as any)?.whatsapp_conectado, numero: (prof as any)?.whatsapp_numero || null });
      const { data: of } = await supabase.from("ofensivas").select("*").eq("user_id", user.id).maybeSingle();
      setOfensiva(of);
      const { data: h } = await supabase.from("pontos_historico").select("*").eq("user_id", user.id).order("criado_em", { ascending: false }).limit(10);
      setHistorico(h || []);
      const { data: ts } = await supabase.from("temporadas_snapshot")
        .select("*, temporadas!inner(numero,data_inicio,data_fim)").eq("user_id", user.id).order("criado_em");
      setTemporadas(ts || []);
      const { data: inds } = await supabase.from("convites_indicacao").select("*").eq("indicador_id", user.id);
      setIndicacoes(inds || []);
    })();
  }, [user?.id]);

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      await updateUser({
        nome: form.nome.trim(),
        whatsapp: form.whatsapp,
        nascimento: form.nascimento || "",
        cidade: form.cidade || null,
        estado: form.estado || null,
        peso: form.peso ? Number(form.peso) : null,
        altura: form.altura ? Number(form.altura) : null,
        posicao: form.posicao,
        bio: form.bio || null,
      });
      toast.success("✅ Perfil atualizado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const media = SKILL_KEYS.reduce((a, k) => a + (skills[k] || 0), 0) / SKILL_KEYS.length;
  const radarData = SKILL_KEYS.map((k) => ({ skill: SKILL_LABELS[k].split(" ")[1], valor: skills[k] || 0 }));
  const pctCap = Math.round((skillsMeta.peso || 0) * 100);
  const marcos = [5, 10, 20, 50];
  const seq = ofensiva?.sequencia_atual || 0;
  const proxMarco = marcos.find((m) => m > seq) || seq;
  const tituloRole = user?.role === "capitao" ? "👑 Capitão" : user?.role === "dono" ? "🏟️ Dono de Quadra" : user?.role === "parceiro" ? "🤝 Parceiro" : "🎮 Jogador";
  const ultimoPonto = historico[0];

  // ===================== SUB-TELAS =====================
  if (secaoAtiva) {
    return (
      <div className="space-y-4 pb-20">
        <button onClick={() => setSecaoAtiva(null)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {secaoAtiva === "dados" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados Pessoais</h3>
            <div className="flex justify-center"><AvatarUpload size={96} /></div>
            <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label>Seu @</Label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <span className="font-bold text-primary">@{user?.handle}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">O @ é definido no cadastro e não pode ser alterado depois.</p>
            </div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
            <div><Label>Data de nascimento</Label><Input type="date" value={form.nascimento} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Peso (kg)</Label><Input type="number" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} /></div>
              <div><Label>Altura (cm)</Label><Input type="number" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} /></div>
            </div>
            <div>
              <Label>Posição preferida</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[["linha","⚽ Linha"],["goleiro","🧤 Goleiro"],["ambos","🔄 Ambos"]].map(([v, l]) => (
                  <Button key={v} type="button" size="sm" variant={form.posicao === v ? "default" : "outline"} onClick={() => setForm({ ...form, posicao: v })}>{l}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Bio <span className="text-xs text-muted-foreground">({form.bio.length}/200)</span></Label>
              <Textarea maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Conte algo sobre você..." />
            </div>
            <Button onClick={save} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold">{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        )}

        {secaoAtiva === "skills" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Minhas Skills</h3>
            <div className="text-center">
              <div className="text-4xl font-extrabold text-primary">{media.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">{nivelLabel(media)}</div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} />
                  <Radar dataKey="valor" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SKILL_KEYS.map((k) => (
                <div key={k} className="rounded-lg bg-secondary/30 p-2">
                  <div className="flex justify-between text-xs"><span>{SKILL_LABELS[k]}</span><span className="font-bold">{skills[k]}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full ${skillColor(skills[k])}`} style={{ width: `${(skills[k] / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Baseado em {skillsMeta.total} avaliações · 👑 Capitão: {pctCap}% | 👥 Companheiros: {100 - pctCap}%
            </div>
            <p className="text-[11px] text-muted-foreground italic">Suas skills são definidas pelo Capitão e atualizadas pelas avaliações dos seus companheiros após cada pelada.</p>
          </div>
        )}

        {secaoAtiva === "ofensiva" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2 text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Minha Ofensiva</h3>
            <div className="text-5xl font-extrabold">{seq > 5 ? "🔥" : ""} {seq}</div>
            <div className="text-xs text-muted-foreground">peladas consecutivas · maior: {ofensiva?.maior_sequencia || 0}</div>
            {proxMarco > seq && (
              <>
                <Progress value={(seq / proxMarco) * 100} />
                <div className="text-xs text-muted-foreground">Faltam {proxMarco - seq} peladas para o próximo marco ({proxMarco})</div>
              </>
            )}
          </div>
        )}

        {secaoAtiva === "pontos" && (
          <>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">⭐ Meus Pontos</h3>
              <div className="text-3xl font-extrabold text-primary text-center">{pontos}</div>
              <div className="space-y-1 mt-2">
                {historico.length === 0 ? <p className="text-xs text-muted-foreground text-center">Sem histórico ainda.</p> :
                  historico.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded bg-secondary/30 px-2 py-1.5 text-xs">
                      <span className="flex-1">{h.descricao_legivel || h.acao}</span>
                      <span className={h.valor_pontos >= 0 ? "font-bold text-green-500" : "font-bold text-red-500"}>{h.valor_pontos > 0 ? "+" : ""}{h.valor_pontos}</span>
                    </div>
                  ))
                }
              </div>
            </div>
            {temporadas.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico de Temporadas</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temporadas.map((t) => ({ nome: `T${t.temporadas?.numero}`, nivel: Number(t.nivel_geral_fim) || 0 }))}>
                      <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="nivel" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {secaoAtiva === "whatsapp" && <CentralMensagensCard />}

        {secaoAtiva === "indicar" && (
          <IndicacoesBox indicacoes={indicacoes} userId={user?.id} isCapitao={user?.role === "capitao"} />
        )}

        {secaoAtiva === "conta" && <ContaPreferenciasBox signOut={signOut} />}

        {secaoAtiva === "historico" && <HistoricoPeladasBox userId={user?.id} />}
      </div>
    );
  }

  // ===================== HUB =====================
  return (
    <div className="space-y-4 pb-20">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <Button variant="outline" size="sm" onClick={() => setSecaoAtiva("dados")} className="absolute right-4 top-4 shrink-0">
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar perfil
        </Button>
        <div className="flex items-start gap-4 pr-1">
          <div className="shrink-0"><AvatarUpload size={80} /></div>
          <div className="min-w-0 flex-1 pt-1 pr-20">
            <h2 className="break-words text-2xl font-bold">{user?.nome}</h2>
            {user?.handle && <p className="text-sm font-medium text-primary">@{user.handle}</p>}
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{tituloRole}</span>
            {(user?.cidade || user?.estado) && (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {user?.cidade}{user?.cidade && user?.estado ? ", " : ""}{user?.estado}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="text-2xl font-black text-primary">{media.toFixed(1)}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Skill Geral</div>
          <div className="text-xs font-bold text-primary">{nivelLabel(media)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="text-2xl font-black">{pontos.toLocaleString("pt-BR")}</div>
          <div className="text-[10px] uppercase text-muted-foreground">XP Total</div>
          <div className="text-xs font-bold text-muted-foreground">XP</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-black">🔥 {seq}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Ofensiva</div>
          <div className="text-xs font-bold text-muted-foreground">Maior: {ofensiva?.maior_sequencia || 0}</div>
        </div>
      </div>

      <MenuRow
        icon={User} titulo="Dados pessoais" subtitulo="Suas informações e posição preferida"
        preview={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-[10px] font-black text-muted-foreground"><Shirt className="h-5 w-5" /></div>}
        onClick={() => setSecaoAtiva("dados")}
      />
      <MenuRow
        icon={RadarIcon} titulo="Minhas skills" subtitulo="Acompanhe seu desempenho"
        preview={<div className="text-sm font-bold text-primary">{media.toFixed(1)}</div>}
        onClick={() => setSecaoAtiva("skills")}
      />
      <MenuRow
        icon={Flame} titulo="Minha ofensiva" subtitulo="Sequência de peladas e metas"
        preview={
          <div className="w-24 shrink-0 text-right">
            <div className="text-sm font-bold">🔥 {seq}</div>
            {proxMarco > seq && <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${(seq / proxMarco) * 100}%` }} /></div>}
          </div>
        }
        onClick={() => setSecaoAtiva("ofensiva")}
      />
      <MenuRow
        icon={Star} titulo="Meus pontos" subtitulo="Histórico de pontos e conquistas"
        preview={
          <div className="text-right">
            <div className="text-sm font-bold text-primary">⭐ {pontos}{ultimoPonto && ultimoPonto.valor_pontos > 0 ? ` +${ultimoPonto.valor_pontos}` : ""}</div>
            <div className="text-[10px] text-muted-foreground">Últimas atividades</div>
          </div>
        }
        onClick={() => setSecaoAtiva("pontos")}
      />
      <MenuRow
        icon={MessageCircle} titulo="Central de mensagens" subtitulo="Conecte seu WhatsApp"
        preview={
          <div className="text-right">
            <div className={`text-xs font-bold ${whatsapp.conectado ? "text-primary" : "text-muted-foreground"}`}>{whatsapp.conectado ? "🟢 Conectado" : "Não conectado"}</div>
            {whatsapp.numero && <div className="text-[10px] text-muted-foreground">{whatsapp.numero}</div>}
          </div>
        }
        onClick={() => setSecaoAtiva("whatsapp")}
      />
      <MenuRow
        icon={UserPlus} titulo="Indique um amigo" subtitulo="Convide e ganhe bônus exclusivos"
        preview={<div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">🎁 Ativo</div>}
        onClick={() => setSecaoAtiva("indicar")}
      />
      <MenuRow
        icon={CalendarDays} titulo="Histórico de peladas" subtitulo="Minutos jogados e avaliações por partida"
        onClick={() => setSecaoAtiva("historico")}
      />
      <MenuRow
        icon={Settings} titulo="Conta e preferências" subtitulo="Segurança, privacidade e configurações"
        onClick={() => setSecaoAtiva("conta")}
      />
    </div>
  );
}

function MenuRow({ icon: Icon, titulo, subtitulo, preview, onClick }: { icon: any; titulo: string; subtitulo: string; preview?: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{titulo}</div>
        <div className="text-xs text-muted-foreground">{subtitulo}</div>
      </div>
      {preview}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ContaPreferenciasBox({ signOut }: { signOut: () => Promise<void> }) {
  const { user } = useAuth();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [trocando, setTrocando] = useState(false);

  const trocarSenha = async () => {
    if (novaSenha.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");
    if (novaSenha !== confirmaSenha) return toast.error("As senhas não coincidem.");
    setTrocando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setTrocando(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    setNovaSenha(""); setConfirmaSenha("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Conta</h3>
        <div><Label>E-mail</Label><Input value={user?.email || ""} disabled /></div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Trocar senha</h3>
        <div><Label>Nova senha</Label><Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
        <div><Label>Confirmar nova senha</Label><Input type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} /></div>
        <Button onClick={trocarSenha} disabled={trocando} className="w-full bg-primary text-primary-foreground font-bold">
          {trocando ? "Salvando..." : "Atualizar senha"}
        </Button>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-destructive">Sair</h3>
        <p className="text-xs text-muted-foreground">Você precisa entrar de novo com seu e-mail e senha depois disso.</p>
        <Button variant="destructive" onClick={() => void signOut()} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sair da conta
        </Button>
      </div>
    </div>
  );
}

function HistoricoPeladasBox({ userId }: { userId: string | undefined }) {
  const [peladas, setPeladas] = useState<{ id: string; nome_pelada: string; data: string; grupo_nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);
  const [resumos, setResumos] = useState<Record<string, ResumoJogadorPelada | null>>({});

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      setLoading(true);
      const { data: tj } = await supabase.from("time_jogadores").select("pelada_id").eq("user_id", userId);
      const peladaIds = Array.from(new Set((tj || []).map((x: any) => x.pelada_id as string)));
      if (!peladaIds.length) { setPeladas([]); setLoading(false); return; }
      const { data: ps } = await supabase.from("peladas").select("id, nome_pelada, data, grupo_id, status").in("id", peladaIds).eq("status", "encerrada").order("data", { ascending: false });
      const grupoIds = Array.from(new Set((ps || []).map((p: any) => p.grupo_id)));
      const { data: gs } = grupoIds.length ? await supabase.from("grupos").select("id, nome").in("id", grupoIds) : { data: [] as any[] };
      const gMap: Record<string, string> = {};
      (gs || []).forEach((g: any) => { gMap[g.id] = g.nome; });
      setPeladas((ps || []).map((p: any) => ({ id: p.id, nome_pelada: p.nome_pelada, data: p.data, grupo_nome: gMap[p.grupo_id] || "Grupo" })));
      setLoading(false);
    })();
  }, [userId]);

  const abrir = async (peladaId: string) => {
    if (aberta === peladaId) { setAberta(null); return; }
    setAberta(peladaId);
    if (!resumos[peladaId] && userId) {
      const r = await calcularResumoJogadorPelada(peladaId, userId);
      setResumos((prev) => ({ ...prev, [peladaId]: r }));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico de Peladas</h3>
      <p className="text-xs text-muted-foreground">Clique numa pelada pra ver seus minutos jogados e as notas que você recebeu.</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : peladas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não jogou nenhuma pelada.</p>
      ) : (
        <div className="space-y-2">
          {peladas.map((p) => {
            const r = resumos[p.id];
            const estaAberta = aberta === p.id;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
                <button onClick={() => abrir(p.id)} className="flex w-full items-center justify-between p-3 text-left">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{p.nome_pelada}</div>
                    <div className="text-xs text-muted-foreground">{p.grupo_nome} · {p.data.split("-").reverse().join("/")}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${estaAberta ? "rotate-90" : ""}`} />
                </button>
                {estaAberta && (
                  <div className="border-t border-border p-3">
                    {!r ? (
                      <p className="text-xs text-muted-foreground">Carregando resumo...</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-secondary/40 p-2">
                          <div className="flex items-center justify-center gap-1 text-sm font-bold"><Clock className="h-3.5 w-3.5 text-primary" /> {r.minutosJogados}</div>
                          <div className="text-[10px] text-muted-foreground">minutos jogados</div>
                        </div>
                        <div className="rounded-lg bg-secondary/40 p-2">
                          <div className="text-sm font-bold">⭐ {r.notaLances.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground">nota (lances)</div>
                        </div>
                        <div className="rounded-lg bg-secondary/40 p-2">
                          <div className="text-sm font-bold">{r.notaAvaliacoes != null ? `⭐ ${r.notaAvaliacoes.toFixed(1)}` : "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{r.totalAvaliacoes > 0 ? `avaliação (${r.totalAvaliacoes})` : "sem avaliação"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IndicacoesBox({ indicacoes, userId, isCapitao }: any) {
  const [codigo, setCodigo] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await (supabase as any).rpc("criar_codigo_indicacao", {
        _user_id: userId, _grupo_id: null, _tipo: isCapitao ? "capitao" : "jogador",
      });
      setCodigo(typeof data === "string" ? data : null);
    })();
  }, [userId, isCapitao]);
  const totalJogou = indicacoes.filter((i: any) => i.jogou_primeira_pelada).length;
  const totalCadastrou = indicacoes.filter((i: any) => i.cadastrou).length;
  const link = codigo && typeof window !== "undefined" ? `${window.location.origin}/indicar/${codigo}` : "";
  const copy = () => { if (link) { navigator.clipboard.writeText(link); toast.success("Link copiado"); } };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Indique um amigo pro MrFut</h3>
      <p className="text-xs text-muted-foreground">
        Esse link é pessoal e não coloca ninguém em nenhum grupo automaticamente — é só pra trazer gente nova pro app.
        Depois, qualquer capitão pode buscar o @ da pessoa e convidar ela pra um grupo, separadamente.
      </p>
      {isCapitao && <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary font-bold">👑 Como capitão, você ganha um bônus extra por cada indicação!</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/30 p-2 text-center"><div className="text-[10px] uppercase text-muted-foreground">Se cadastraram</div><div className="text-xl font-extrabold">{totalCadastrou}</div></div>
        <div className="rounded-xl bg-secondary/30 p-2 text-center"><div className="text-[10px] uppercase text-muted-foreground">Jogaram (bem-sucedidas)</div><div className="text-xl font-extrabold text-primary">{totalJogou}</div></div>
      </div>
      {link && (
        <div className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button size="sm" variant="secondary" onClick={copy}><Copy className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="space-y-1">
        {indicacoes.length === 0 ? <p className="text-xs text-muted-foreground">Você ainda não fez indicações.</p> :
          indicacoes.map((i: any) => {
            const status = i.jogou_primeira_pelada ? "⚽ Jogou" : i.cadastrou ? "✅ Cadastrou" : "🔗 Link gerado";
            return (
              <div key={i.id} className="flex justify-between rounded bg-secondary/30 px-2 py-1.5 text-xs">
                <span className="font-mono">{i.codigo_unico}</span>
                <span className="text-muted-foreground">{status}</span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
