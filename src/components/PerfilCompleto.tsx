import { useEffect, useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const SKILL_KEYS = ["velocidade","drible","passe","chute","resistencia","posicionamento"] as const;
const SKILL_LABELS: Record<typeof SKILL_KEYS[number], string> = {
  velocidade: "⚡ Velocidade", drible: "✨ Drible", passe: "🎯 Passe",
  chute: "💥 Chute", resistencia: "🫁 Resistência", posicionamento: "🧠 Posicionamento",
};
type SkillKey = typeof SKILL_KEYS[number];

const skillColor = (v: number) => v >= 4 ? "bg-green-500" : v >= 2.5 ? "bg-yellow-500" : "bg-red-500";
const nivelLabel = (m: number) => m >= 4.5 ? "Elite" : m >= 4 ? "Acima da média" : m >= 3 ? "Bom" : m >= 2 ? "Em evolução" : "Iniciante";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export function PerfilCompleto() {
  const { user, updateUser } = useAuth();
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
  const [meusGrupos, setMeusGrupos] = useState<any[]>([]);
  const [grupoSel, setGrupoSel] = useState("");
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
      const { data: prof } = await supabase.from("profiles").select("pontos_total").eq("user_id", user.id).maybeSingle();
      setPontos(prof?.pontos_total || 0);
      const { data: of } = await supabase.from("ofensivas").select("*").eq("user_id", user.id).maybeSingle();
      setOfensiva(of);
      const { data: h } = await supabase.from("pontos_historico").select("*").eq("user_id", user.id).order("criado_em", { ascending: false }).limit(10);
      setHistorico(h || []);
      const { data: ts } = await supabase.from("temporadas_snapshot")
        .select("*, temporadas!inner(numero,data_inicio,data_fim)").eq("user_id", user.id).order("criado_em");
      setTemporadas(ts || []);
      const { data: inds } = await supabase.from("convites_indicacao").select("*").eq("indicador_id", user.id);
      setIndicacoes(inds || []);
      const { data: gms } = await supabase.from("grupo_membros").select("grupo_id, grupos!inner(id,nome,codigo_convite)").eq("user_id", user.id).eq("status","ativo");
      const gs = (gms || []).map((x: any) => x.grupos);
      setMeusGrupos(gs);
      if (gs[0]) setGrupoSel(gs[0].id);
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

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col items-center text-center space-y-2">
        <AvatarUpload size={96} />
        <h2 className="text-2xl font-bold mt-2">{user?.nome}</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{tituloRole}</span>
        {(user?.cidade || user?.estado) && <p className="text-sm text-muted-foreground">{user?.cidade}{user?.cidade && user?.estado ? ", " : ""}{user?.estado}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados Pessoais</h3>
        <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
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

      <IndicacoesBox indicacoes={indicacoes} meusGrupos={meusGrupos} grupoSel={grupoSel} setGrupoSel={setGrupoSel} userId={user?.id} isCapitao={user?.role === "capitao"} />

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
    </div>
  );
}

function IndicacoesBox({ indicacoes, meusGrupos, grupoSel, setGrupoSel, userId, isCapitao }: any) {
  const [codigo, setCodigo] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !grupoSel) return;
    void (async () => {
      const { data } = await supabase.from("convites_indicacao")
        .select("codigo_unico").eq("indicador_id", userId).eq("grupo_id", grupoSel).maybeSingle();
      setCodigo(data?.codigo_unico || null);
    })();
  }, [userId, grupoSel]);
  const totalJogou = indicacoes.filter((i: any) => i.jogou_primeira_pelada).length;
  const link = codigo && typeof window !== "undefined" ? `${window.location.origin}/convite/${codigo}` : "";
  const copy = () => { if (link) { navigator.clipboard.writeText(link); toast.success("Link copiado"); } };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Minhas Indicações</h3>
      {isCapitao && <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary font-bold">👑 Você ganha pontos em dobro por cada indicação!</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/30 p-2 text-center"><div className="text-[10px] uppercase text-muted-foreground">Bem-sucedidas</div><div className="text-xl font-extrabold text-primary">{totalJogou}</div></div>
        <div className="rounded-xl bg-secondary/30 p-2 text-center"><div className="text-[10px] uppercase text-muted-foreground">Pontos ganhos</div><div className="text-xl font-extrabold">{totalJogou * (isCapitao ? 60 : 30)}</div></div>
      </div>
      {meusGrupos.length > 0 && (
        <div>
          <Label className="text-xs">Grupo</Label>
          <Select value={grupoSel} onValueChange={setGrupoSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{meusGrupos.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
          </Select>
          {link && (
            <div className="flex gap-2 mt-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button size="sm" variant="secondary" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}
      <div className="space-y-1">
        {indicacoes.length === 0 ? <p className="text-xs text-muted-foreground">Você ainda não fez indicações.</p> :
          indicacoes.map((i: any) => {
            const status = i.jogou_primeira_pelada ? "⚽ Jogou — +30 pts" : i.cadastrou ? "✅ Cadastrou" : "🔗 Link gerado";
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
