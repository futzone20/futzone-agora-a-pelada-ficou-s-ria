import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/goleiros/meu-perfil")({ component: Wrapper });

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><MeuPerfilGoleiro /></MobileShell>
    </RequireAuth>
  );
}

const TIPOS_QUADRA = [
  { v: "society", label: "Society" },
  { v: "futsal", label: "Futsal" },
  { v: "campo", label: "Campo" },
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Slot = { id?: string; dia_semana: number; horario_inicio: string; horario_fim: string; novo?: boolean };

function MeuPerfilGoleiro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [existiaAntes, setExistiaAntes] = useState(false);

  const [ativo, setAtivo] = useState(false);
  const [valorHora, setValorHora] = useState("");
  const [semCobranca, setSemCobranca] = useState(false);
  const [tipos, setTipos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsRemovidos, setSlotsRemovidos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: perfil } = await (supabase as any).from("goleiros_perfil").select("*").eq("user_id", user.id).maybeSingle();
      if (perfil) {
        setPerfilId(perfil.id);
        setExistiaAntes(true);
        setAtivo(!!perfil.ativo_catalogo);
        setValorHora(perfil.valor_hora ? String(perfil.valor_hora) : "");
        setSemCobranca(!perfil.valor_hora || Number(perfil.valor_hora) === 0);
        setTipos(perfil.tipos_quadra || []);
        setBio(perfil.bio || "");
        const { data: disp } = await (supabase as any).from("goleiros_disponibilidade").select("*").eq("goleiro_id", perfil.id).order("dia_semana");
        setSlots((disp || []).map((d: any) => ({ id: d.id, dia_semana: d.dia_semana, horario_inicio: d.horario_inicio?.slice(0, 5), horario_fim: d.horario_fim?.slice(0, 5) })));
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const toggleTipo = (v: string) => setTipos((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const addSlot = () => setSlots((arr) => [...arr, { dia_semana: 1, horario_inicio: "18:00", horario_fim: "22:00", novo: true }]);
  const updSlot = (idx: number, patch: Partial<Slot>) => setSlots((arr) => arr.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const removeSlot = (idx: number) => {
    const s = slots[idx];
    if (s.id) setSlotsRemovidos((r) => [...r, s.id!]);
    setSlots((arr) => arr.filter((_, i) => i !== idx));
  };

  const salvar = async () => {
    if (!user) return;
    if (ativo && tipos.length === 0) { toast.error("Escolha pelo menos um tipo de quadra."); return; }
    setSaving(true);

    const payload = {
      user_id: user.id,
      ativo_catalogo: ativo,
      valor_hora: semCobranca ? 0 : (Number(valorHora) || 0),
      tipos_quadra: tipos,
      bio: bio || null,
    };

    let idAtual = perfilId;
    if (existiaAntes && perfilId) {
      const { error } = await (supabase as any).from("goleiros_perfil").update(payload).eq("id", perfilId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await (supabase as any).from("goleiros_perfil").insert(payload).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      idAtual = data.id;
      setPerfilId(data.id);
      setExistiaAntes(true);
    }

    if (slotsRemovidos.length) {
      await (supabase as any).from("goleiros_disponibilidade").delete().in("id", slotsRemovidos);
      setSlotsRemovidos([]);
    }
    const novosSlots = slots.filter((s) => s.novo).map((s) => ({
      goleiro_id: idAtual, dia_semana: s.dia_semana, horario_inicio: s.horario_inicio, horario_fim: s.horario_fim,
    }));
    if (novosSlots.length) {
      const { error } = await (supabase as any).from("goleiros_disponibilidade").insert(novosSlots);
      if (error) toast.error(error.message);
    }
    // horários existentes editados
    for (const s of slots.filter((s) => s.id && !s.novo)) {
      await (supabase as any).from("goleiros_disponibilidade").update({
        dia_semana: s.dia_semana, horario_inicio: s.horario_inicio, horario_fim: s.horario_fim,
      }).eq("id", s.id);
    }

    toast.success(existiaAntes ? "Perfil de goleiro atualizado!" : "Perfil de goleiro criado! Você já pode aparecer no catálogo.");
    setSaving(false);
    // recarrega os slots do banco pra pegar ids novos
    const { data: disp } = await (supabase as any).from("goleiros_disponibilidade").select("*").eq("goleiro_id", idAtual).order("dia_semana");
    setSlots((disp || []).map((d: any) => ({ id: d.id, dia_semana: d.dia_semana, horario_inicio: d.horario_inicio?.slice(0, 5), horario_fim: d.horario_fim?.slice(0, 5) })));
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4 pb-8">
      <button onClick={() => navigate({ to: "/jogador/perfil" })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <h2 className="text-xl font-bold">🧤 Perfil profissional de goleiro</h2>
        <p className="text-sm text-muted-foreground">Apareça no catálogo pra capitães te chamarem pra jogar — cobrando ou não.</p>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="font-bold">Ativo no catálogo</div>
          <div className="text-xs text-muted-foreground">{ativo ? "Capitães conseguem te encontrar e convidar" : "Você fica invisível no catálogo público"}</div>
        </div>
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cobrar por hora?</Label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sem cobrança</span>
            <Switch checked={!semCobranca} onCheckedChange={(v) => setSemCobranca(!v)} />
            <span>Cobro</span>
          </div>
        </div>
        {!semCobranca && (
          <div>
            <Label>Valor por hora (R$)</Label>
            <Input type="number" min={0} step="0.01" value={valorHora} onChange={(e) => setValorHora(e.target.value)} placeholder="Ex: 50.00" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          O pagamento em si é combinado direto com o capitão, fora do app — esse valor é só o que aparece no seu perfil como referência.
        </p>
      </Card>

      <Card className="p-4 space-y-2">
        <Label>Tipos de quadra que você atende</Label>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS_QUADRA.map((t) => (
            <Button key={t.v} type="button" size="sm" variant={tipos.includes(t.v) ? "default" : "outline"} onClick={() => toggleTipo(t.v)}>
              {t.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <Label>Bio <span className="text-xs text-muted-foreground">({bio.length}/300)</span></Label>
        <Textarea maxLength={300} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte sua experiência, estilo de jogo, regiões que atende..." />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Disponibilidade semanal (opcional)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addSlot}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
        </div>
        {slots.length === 0 && <p className="text-xs text-muted-foreground">Sem horários fixos cadastrados. A agenda também bloqueia sozinha quando você aceita um convite ou confirma presença numa pelada.</p>}
        {slots.map((s, idx) => (
          <div key={s.id || `novo-${idx}`} className="flex items-center gap-2">
            <select
              value={s.dia_semana}
              onChange={(e) => updSlot(idx, { dia_semana: Number(e.target.value) })}
              className="flex-1 rounded-lg bg-secondary px-2 py-2 text-sm outline-none"
            >
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <Input type="time" value={s.horario_inicio} onChange={(e) => updSlot(idx, { horario_inicio: e.target.value })} className="w-28" />
            <Input type="time" value={s.horario_fim} onChange={(e) => updSlot(idx, { horario_fim: e.target.value })} className="w-28" />
            <button onClick={() => removeSlot(idx)} className="shrink-0 text-muted-foreground hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </Card>

      <Button onClick={salvar} disabled={saving} className="w-full bg-primary font-bold">
        {saving ? "Salvando..." : existiaAntes ? "Salvar alterações" : "Criar perfil de goleiro"}
      </Button>

      {existiaAntes && user?.id && (
        <button
          onClick={() => navigate({ to: "/goleiros/$id", params: { id: perfilId! } })}
          className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-primary"
        >
          Ver como aparece pros capitães <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
