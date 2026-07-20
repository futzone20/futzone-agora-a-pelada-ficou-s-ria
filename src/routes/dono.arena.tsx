import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/arena")({ component: ArenaPage });

const DIAS = [["seg","Seg"],["ter","Ter"],["qua","Qua"],["qui","Qui"],["sex","Sex"],["sab","Sáb"],["dom","Dom"]];

function ArenaPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", cnpj_cpf: "", endereco: "", cidade: "", estado: "", cep: "", telefone: "", whatsapp: "", logo_url: "", foto_capa_url: "", horario_funcionamento: {} });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
      if (data) { setArena(data); setForm(data); }
    })();
  }, [user?.id]);

  const setDia = (d: string, k: string, v: any) => {
    setForm({ ...form, horario_funcionamento: { ...(form.horario_funcionamento||{}), [d]: { ...(form.horario_funcionamento?.[d]||{}), [k]: v } } });
  };

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    if (arena) {
      const { error } = await supabase.from("arenas").update({ ...form, atualizado_em: new Date().toISOString() } as never).eq("id", arena.id);
      if (error) toast.error(error.message); else toast.success("Arena atualizada");
    } else {
      const { data, error } = await supabase.from("arenas").insert({ ...form, user_id: user.id } as never).select().single();
      if (error) toast.error(error.message); else { setArena(data); toast.success("Arena criada"); }
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-bold">Dados da Arena</h3>
        <div><Label>Nome*</Label><Input value={form.nome||""} onChange={e=>setForm({...form,nome:e.target.value})}/></div>
        <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf||""} onChange={e=>setForm({...form,cnpj_cpf:e.target.value})}/></div>
        <div><Label>Endereço</Label><Input value={form.endereco||""} onChange={e=>setForm({...form,endereco:e.target.value})}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Cidade</Label><Input value={form.cidade||""} onChange={e=>setForm({...form,cidade:e.target.value})}/></div>
          <div><Label>Estado</Label><Input maxLength={2} value={form.estado||""} onChange={e=>setForm({...form,estado:e.target.value.toUpperCase()})}/></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>CEP</Label><Input value={form.cep||""} onChange={e=>setForm({...form,cep:e.target.value})}/></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp||""} onChange={e=>setForm({...form,whatsapp:e.target.value})}/></div>
        </div>
        <div><Label>URL da Logo</Label><Input value={form.logo_url||""} onChange={e=>setForm({...form,logo_url:e.target.value})}/></div>
        <div><Label>URL da Foto de Capa</Label><Input value={form.foto_capa_url||""} onChange={e=>setForm({...form,foto_capa_url:e.target.value})}/></div>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-bold">Horário de funcionamento</h3>
        {DIAS.map(([d,lbl])=>{
          const h = form.horario_funcionamento?.[d] || {};
          return (
            <div key={d} className="flex items-center gap-2">
              <div className="w-12 font-bold">{lbl}</div>
              <Switch checked={!!h.ativo} onCheckedChange={v=>setDia(d,"ativo",v)}/>
              <Input type="time" className="w-28" disabled={!h.ativo} value={h.abre||""} onChange={e=>setDia(d,"abre",e.target.value)}/>
              <Input type="time" className="w-28" disabled={!h.ativo} value={h.fecha||""} onChange={e=>setDia(d,"fecha",e.target.value)}/>
            </div>
          );
        })}
      </Card>

      <Button onClick={salvar} disabled={saving || !form.nome} className="w-full">{saving?"Salvando...":"Salvar"}</Button>
      {arena?.slug && <p className="text-xs text-center text-muted-foreground">Slug: {arena.slug}</p>}
    </div>
  );
}
