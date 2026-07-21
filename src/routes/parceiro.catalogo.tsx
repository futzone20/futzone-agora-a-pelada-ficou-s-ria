import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/parceiro/catalogo")({ component: Cat });

function Cat() {
  const { user } = useAuth();
  const [parc, setParc] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [proporcao, setProporcao] = useState(400);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({ tipo:"produto", nome:"", descricao:"", regras:"", foto_url:"", valor_real:0, pontos_necessarios:0, quantidade_disponivel:"", ativo:true });

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("parceiros").select("*").eq("user_id", user.id).maybeSingle();
    if (!p) return; setParc(p);
    const { data: r } = await supabase.from("parceiros_recompensas").select("*").eq("parceiro_id", (p as any).id).order("criado_em", { ascending: false });
    setRecs(r ?? []);
    const { data: cfg } = await supabase.from("pontos_config").select("valor_pontos").eq("acao", "proporcao_pontos_reais").maybeSingle();
    if (cfg) setProporcao((cfg as any).valor_pontos);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const abrir = (r?: any) => {
    if (r) { setEdit(r); setForm({ ...r, quantidade_disponivel: r.quantidade_disponivel ?? "" }); }
    else { setEdit(null); setForm({ tipo:"produto", nome:"", descricao:"", regras:"", foto_url:"", valor_real:0, pontos_necessarios:0, quantidade_disponivel:"", ativo:true }); }
    setOpen(true);
  };

  const salvar = async () => {
    if (!parc) return;
    const payload = { ...form, parceiro_id: parc.id, quantidade_disponivel: form.quantidade_disponivel === "" ? null : Number(form.quantidade_disponivel) };
    delete (payload as any).pdv_categorias;
    const { error } = edit
      ? await supabase.from("parceiros_recompensas").update(payload as never).eq("id", edit.id)
      : await supabase.from("parceiros_recompensas").insert(payload as never);
    if (error) toast.error(error.message); else { setOpen(false); void load(); }
  };

  const toggle = async (r:any) => { await supabase.from("parceiros_recompensas").update({ ativo: !r.ativo } as never).eq("id", r.id); void load(); };

  if (!parc) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre seu perfil de parceiro primeiro.</div>;

  return (
    <div className="space-y-3">
      <Button onClick={()=>abrir()} className="w-full"><Plus className="h-4 w-4 mr-1"/>Nova recompensa</Button>
      {recs.map(r=>(
        <Card key={r.id} className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-bold">{r.nome}</div>
              <div className="text-xs text-muted-foreground">{r.tipo} · {r.pontos_necessarios} pts</div>
              <div className="text-xs">Resgatados: {r.quantidade_resgatada}{r.quantidade_disponivel !== null && ` / ${r.quantidade_disponivel}`}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Switch checked={r.ativo} onCheckedChange={()=>toggle(r)}/>
              <Button size="sm" variant="outline" onClick={()=>abrir(r)}>Editar</Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?"Editar":"Nova"} recompensa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={v=>setForm({...form,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
              <SelectItem value="produto">Produto</SelectItem><SelectItem value="servico">Serviço</SelectItem><SelectItem value="desconto">Desconto</SelectItem>
            </SelectContent></Select></div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao||""} onChange={e=>setForm({...form,descricao:e.target.value})}/></div>
            <div><Label>Regras</Label><Textarea value={form.regras||""} onChange={e=>setForm({...form,regras:e.target.value})}/></div>
            <div><Label>Foto URL</Label><Input value={form.foto_url||""} onChange={e=>setForm({...form,foto_url:e.target.value})}/></div>
            <div><Label>Valor de referência (interno) R$</Label><Input type="number" step="0.01" value={form.valor_real} onChange={e=>setForm({...form,valor_real:+e.target.value})}/></div>
            <div>
              <Label>Pontos MrFut para resgatar</Label>
              <Input type="number" value={form.pontos_necessarios} onChange={e=>setForm({...form,pontos_necessarios:+e.target.value})}/>
              <p className="text-xs text-muted-foreground mt-1">≈ R$ {(form.pontos_necessarios / proporcao).toFixed(2)} em valor de referência</p>
            </div>
            <div><Label>Quantidade (vazio = ilimitado)</Label><Input type="number" value={form.quantidade_disponivel} onChange={e=>setForm({...form,quantidade_disponivel:e.target.value})}/></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.ativo} onCheckedChange={v=>setForm({...form,ativo:v})}/></div>
            <Button onClick={salvar} className="w-full" disabled={!form.nome}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
