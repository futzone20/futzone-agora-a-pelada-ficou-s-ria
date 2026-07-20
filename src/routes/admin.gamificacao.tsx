import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gamificacao")({ component: Page });

function Page() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Gamificação</h2>
      <Tabs defaultValue="pontos">
        <TabsList className="w-full"><TabsTrigger value="pontos" className="flex-1">Pontos</TabsTrigger><TabsTrigger value="selos" className="flex-1">Selos</TabsTrigger><TabsTrigger value="desafios" className="flex-1">Desafios</TabsTrigger><TabsTrigger value="config" className="flex-1">Config</TabsTrigger></TabsList>
        <TabsContent value="pontos"><Pontos/></TabsContent>
        <TabsContent value="selos"><Selos/></TabsContent>
        <TabsContent value="desafios"><Desafios/></TabsContent>
        <TabsContent value="config"><Config/></TabsContent>
      </Tabs>
    </div>
  );
}

function Pontos() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { void (async () => { const { data } = await supabase.from("pontos_config").select("*").order("acao"); setRows(data ?? []); })(); }, []);
  const save = async (r: any) => { const { error } = await supabase.from("pontos_config").update({ valor_pontos: r.valor_pontos, multiplicador_capitao: r.multiplicador_capitao, ativo: r.ativo }).eq("id", r.id); if (error) toast.error(error.message); else toast.success("Salvo"); };
  return (
    <div className="space-y-1">
      {rows.map((r,i)=>(
        <Card key={r.id} className="p-2 flex items-center gap-2">
          <div className="flex-1"><div className="text-sm font-bold">{r.acao}</div><div className="text-xs text-muted-foreground">{r.descricao}</div></div>
          <Input className="w-20 h-8" type="number" value={r.valor_pontos} onChange={e=>{const c=[...rows]; c[i].valor_pontos=+e.target.value; setRows(c);}}/>
          <Input className="w-20 h-8" type="number" step="0.1" value={r.multiplicador_capitao} onChange={e=>{const c=[...rows]; c[i].multiplicador_capitao=+e.target.value; setRows(c);}}/>
          <Button size="sm" variant={r.ativo?"default":"outline"} onClick={()=>{const c=[...rows]; c[i].ativo=!r.ativo; setRows(c); save(c[i]);}}>{r.ativo?"On":"Off"}</Button>
          <Button size="sm" onClick={()=>save(r)}>Salvar</Button>
        </Card>
      ))}
    </div>
  );
}

function Selos() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => { const { data } = await supabase.from("selos").select("*").order("nome"); setRows(data ?? []); };
  useEffect(() => { void load(); }, []);
  const toggle = async (r:any) => { await supabase.from("selos").update({ ativo: !r.ativo }).eq("id", r.id); void load(); };
  return (
    <div className="space-y-1">
      {rows.map(r=>(
        <Card key={r.id} className="p-2 flex items-center gap-2">
          <div className="text-2xl">{r.icone_emoji}</div>
          <div className="flex-1"><div className="text-sm font-bold">{r.nome}</div><div className="text-xs text-muted-foreground">{r.condicao_campo} ≥ {r.condicao_valor}</div></div>
          <Button size="sm" variant={r.ativo?"default":"outline"} onClick={()=>toggle(r)}>{r.ativo?"On":"Off"}</Button>
        </Card>
      ))}
    </div>
  );
}

function Desafios() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => { const { data } = await supabase.from("desafios").select("*").order("titulo"); setRows(data ?? []); };
  useEffect(() => { void load(); }, []);
  const toggle = async (r:any) => { await supabase.from("desafios").update({ ativo: !r.ativo }).eq("id", r.id); void load(); };
  return (
    <div className="space-y-1">
      {rows.map(r=>(
        <Card key={r.id} className="p-2 flex items-center gap-2">
          <div className="flex-1"><div className="text-sm font-bold">{r.titulo}</div><div className="text-xs text-muted-foreground">{r.acao_alvo} ×{r.quantidade_alvo} → {r.pontos_recompensa}pts</div></div>
          <Button size="sm" variant={r.ativo?"default":"outline"} onClick={()=>toggle(r)}>{r.ativo?"On":"Off"}</Button>
        </Card>
      ))}
    </div>
  );
}

function Config() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { void (async () => { const { data } = await supabase.from("admin_config").select("*").order("chave"); setRows(data ?? []); })(); }, []);
  const save = async (r:any) => { const { error } = await supabase.from("admin_config").update({ valor: r.valor, atualizado_em: new Date().toISOString() }).eq("id", r.id); if (error) toast.error(error.message); else toast.success("Salvo"); };
  return (
    <div className="space-y-1">
      {rows.map((r,i)=>(
        <Card key={r.id} className="p-2">
          <Label className="text-xs">{r.chave}</Label>
          <div className="text-xs text-muted-foreground mb-1">{r.descricao}</div>
          <div className="flex gap-2">
            <Input value={r.valor} onChange={e=>{const c=[...rows]; c[i].valor=e.target.value; setRows(c);}}/>
            <Button size="sm" onClick={()=>save(r)}>Salvar</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
