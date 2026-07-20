import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/parceiro/")({ component: ParceiroPerfil });

function parseLatLng(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

function ParceiroPerfil() {
  const { user } = useAuth();
  const [parc, setParc] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome_estabelecimento:"", categoria:"outro", descricao:"", logo_url:"", foto_capa_url:"", endereco:"", cidade:"", estado:"", cep:"", google_maps_url:"", telefone:"", whatsapp:"" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("parceiros").select("*").eq("user_id", user.id).maybeSingle();
      if (data) { setParc(data); setForm(data); }
    })();
  }, [user?.id]);

  const salvar = async () => {
    if (!user) return;
    const coords = form.google_maps_url ? parseLatLng(form.google_maps_url) : null;
    const payload = { ...form, latitude: coords?.lat ?? form.latitude ?? null, longitude: coords?.lng ?? form.longitude ?? null };
    if (parc) {
      const { error } = await supabase.from("parceiros").update(payload as never).eq("id", parc.id);
      if (error) toast.error(error.message); else toast.success("Salvo");
    } else {
      const { data, error } = await supabase.from("parceiros").insert({ ...payload, user_id: user.id } as never).select().single();
      if (error) toast.error(error.message); else { setParc(data); toast.success("Perfil criado"); }
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-bold">Perfil do Parceiro</h3>
      <div><Label>Logo URL</Label><Input value={form.logo_url||""} onChange={e=>setForm({...form,logo_url:e.target.value})}/></div>
      <div><Label>Foto de capa URL</Label><Input value={form.foto_capa_url||""} onChange={e=>setForm({...form,foto_capa_url:e.target.value})}/></div>
      <div><Label>Nome do estabelecimento*</Label><Input value={form.nome_estabelecimento||""} onChange={e=>setForm({...form,nome_estabelecimento:e.target.value})}/></div>
      <div><Label>Categoria</Label>
        <Select value={form.categoria} onValueChange={v=>setForm({...form,categoria:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="restaurante">Restaurante</SelectItem><SelectItem value="loja_esportiva">Loja Esportiva</SelectItem><SelectItem value="academia">Academia</SelectItem><SelectItem value="bar">Bar</SelectItem><SelectItem value="outro">Outro</SelectItem>
        </SelectContent></Select>
      </div>
      <div><Label>Descrição ({(form.descricao||"").length}/500)</Label><Textarea maxLength={500} value={form.descricao||""} onChange={e=>setForm({...form,descricao:e.target.value})}/></div>
      <div><Label>Endereço</Label><Input value={form.endereco||""} onChange={e=>setForm({...form,endereco:e.target.value})}/></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Cidade</Label><Input value={form.cidade||""} onChange={e=>setForm({...form,cidade:e.target.value})}/></div>
        <div><Label>Estado</Label><Input maxLength={2} value={form.estado||""} onChange={e=>setForm({...form,estado:e.target.value.toUpperCase()})}/></div>
      </div>
      <div><Label>CEP</Label><Input value={form.cep||""} onChange={e=>setForm({...form,cep:e.target.value})}/></div>
      <div><Label>Google Maps URL</Label><Input value={form.google_maps_url||""} onChange={e=>setForm({...form,google_maps_url:e.target.value})}/></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Telefone</Label><Input value={form.telefone||""} onChange={e=>setForm({...form,telefone:e.target.value})}/></div>
        <div><Label>WhatsApp</Label><Input value={form.whatsapp||""} onChange={e=>setForm({...form,whatsapp:e.target.value})}/></div>
      </div>
      <Button onClick={salvar} className="w-full" disabled={!form.nome_estabelecimento}>Salvar Perfil</Button>
      {parc?.slug && <p className="text-xs text-center text-muted-foreground">URL: /jogador/parceiros/{parc.slug}</p>}
    </Card>
  );
}
