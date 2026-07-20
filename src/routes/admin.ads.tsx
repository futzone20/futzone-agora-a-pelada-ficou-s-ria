import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ads")({ component: Page });

function Page() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">ADS</h2>
      <Tabs defaultValue="anunciantes">
        <TabsList className="w-full"><TabsTrigger value="anunciantes" className="flex-1">Anunciantes</TabsTrigger><TabsTrigger value="campanhas" className="flex-1">Campanhas</TabsTrigger><TabsTrigger value="relatorios" className="flex-1">Relatórios</TabsTrigger></TabsList>
        <TabsContent value="anunciantes"><Anunciantes/></TabsContent>
        <TabsContent value="campanhas"><Campanhas/></TabsContent>
        <TabsContent value="relatorios"><Relatorios/></TabsContent>
      </Tabs>
    </div>
  );
}

function Anunciantes() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ nome: "", cnpj: "", contato_nome: "", contato_email: "", contato_whatsapp: "" });
  const load = async () => { const { data } = await supabase.from("ads_anunciantes").select("*").order("criado_em", { ascending: false }); setRows(data ?? []); };
  useEffect(() => { void load(); }, []);
  const criar = async () => {
    const { error } = await supabase.from("ads_anunciantes").insert(f as never);
    if (error) toast.error(error.message); else { setOpen(false); setF({ nome:"", cnpj:"", contato_nome:"", contato_email:"", contato_whatsapp:"" }); void load(); }
  };
  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Novo Anunciante</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Novo anunciante</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {["nome","cnpj","contato_nome","contato_email","contato_whatsapp"].map(k=>(
              <div key={k}><Label>{k}</Label><Input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></div>
            ))}
            <Button className="w-full" onClick={criar} disabled={!f.nome}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {rows.map(r=>(
        <Card key={r.id} className="p-3 flex justify-between">
          <div><div className="font-bold text-sm">{r.nome}</div><div className="text-xs text-muted-foreground">{r.contato_email} · {r.cnpj}</div></div>
          <Button size="sm" variant="outline" onClick={async()=>{await supabase.from("ads_anunciantes").update({ ativo: !r.ativo }).eq("id", r.id); void load();}}>{r.ativo?"Desativar":"Ativar"}</Button>
        </Card>
      ))}
    </div>
  );
}

function Campanhas() {
  const [rows, setRows] = useState<any[]>([]);
  const [anun, setAnun] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [criativoFor, setCriativoFor] = useState<any>(null);
  const [f, setF] = useState<any>({ anunciante_id:"", nome:"", tipo:"banner", status:"rascunho", segmentacao_tipo:"nacional", segmentacao_valor:{}, publico_alvo:"todos", telas:[], frequencia_exibicao:5, data_inicio:"", data_fim:"" });
  const [cf, setCf] = useState<any>({ tipo:"imagem", url_arquivo:"", url_destino:"" });
  const load = async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("ads_campanhas").select("*, ads_anunciantes(nome)").order("criado_em", { ascending: false }),
      supabase.from("ads_anunciantes").select("id,nome"),
    ]);
    setRows(c ?? []); setAnun(a ?? []);
  };
  useEffect(() => { void load(); }, []);
  const criar = async () => {
    const { error } = await supabase.from("ads_campanhas").insert(f as never);
    if (error) toast.error(error.message); else { setOpen(false); void load(); }
  };
  const addCriativo = async () => {
    const { error } = await supabase.from("ads_criativos").insert({ ...cf, campanha_id: criativoFor.id } as never);
    if (error) toast.error(error.message); else { setCriativoFor(null); setCf({ tipo:"imagem", url_arquivo:"", url_destino:"" }); toast.success("Criativo adicionado"); }
  };
  const setStatus = async (id: string, status: string) => { await supabase.from("ads_campanhas").update({ status }).eq("id", id); void load(); };

  const telas = ["home","feed","ranking","peladas","parceiros","goleiros"];
  const toggleTela = (t:string) => setF((p:any)=>({ ...p, telas: p.telas.includes(t) ? p.telas.filter((x:string)=>x!==t) : [...p.telas, t] }));

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Nova Campanha</Button></DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Anunciante</Label><Select value={f.anunciante_id} onValueChange={v=>setF({...f,anunciante_id:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{anun.map(a=><SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Nome</Label><Input value={f.nome} onChange={e=>setF({...f,nome:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Tipo</Label><Select value={f.tipo} onValueChange={v=>setF({...f,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                {["banner","video","popup","patrocinio_pelada"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent></Select></div>
              <div><Label>Público</Label><Select value={f.publico_alvo} onValueChange={v=>setF({...f,publico_alvo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                {["todos","jogadores","capitaes","donos_quadra"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent></Select></div>
              <div><Label>Segmentação</Label><Select value={f.segmentacao_tipo} onValueChange={v=>setF({...f,segmentacao_tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                {["nacional","estado","cidade","regional"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent></Select></div>
              <div><Label>Frequência/dia</Label><Input type="number" value={f.frequencia_exibicao} onChange={e=>setF({...f,frequencia_exibicao:+e.target.value})}/></div>
              <div><Label>Início</Label><Input type="date" value={f.data_inicio} onChange={e=>setF({...f,data_inicio:e.target.value})}/></div>
              <div><Label>Fim</Label><Input type="date" value={f.data_fim} onChange={e=>setF({...f,data_fim:e.target.value})}/></div>
            </div>
            {f.segmentacao_tipo !== "nacional" && <div><Label>Valores ({f.segmentacao_tipo}, vírgula)</Label><Input placeholder="SP,RJ ou São Paulo,Rio" onChange={e=>setF({...f, segmentacao_valor: { [f.segmentacao_tipo+"s"]: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) }})}/></div>}
            <div><Label>Telas</Label><div className="flex flex-wrap gap-1">{telas.map(t=><Button key={t} type="button" size="sm" variant={f.telas.includes(t)?"default":"outline"} onClick={()=>toggleTela(t)}>{t}</Button>)}</div></div>
            <Button onClick={criar} className="w-full" disabled={!f.nome || !f.anunciante_id || !f.data_inicio || !f.data_fim}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {rows.map(r=>(
        <Card key={r.id} className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-sm">{r.nome} <span className="text-xs text-muted-foreground">({r.tipo})</span></div>
              <div className="text-xs text-muted-foreground">{r.ads_anunciantes?.nome} · {r.data_inicio} → {r.data_fim} · {r.publico_alvo}</div>
              <div className="text-xs">Status: <span className="font-mono">{r.status}</span></div>
            </div>
            <div className="flex flex-col gap-1">
              <Select value={r.status} onValueChange={v=>setStatus(r.id, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue/></SelectTrigger><SelectContent>
                  {["rascunho","ativa","pausada","encerrada"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={()=>setCriativoFor(r)}>+ Criativo</Button>
            </div>
          </div>
        </Card>
      ))}
      <Dialog open={!!criativoFor} onOpenChange={o=>!o&&setCriativoFor(null)}>
        <DialogContent><DialogHeader><DialogTitle>Novo criativo</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Select value={cf.tipo} onValueChange={v=>setCf({...cf,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
              <SelectItem value="imagem">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="html">HTML</SelectItem>
            </SelectContent></Select>
            <div><Label>URL do arquivo</Label><Input value={cf.url_arquivo} onChange={e=>setCf({...cf,url_arquivo:e.target.value})}/></div>
            <div><Label>URL destino (clique)</Label><Input value={cf.url_destino} onChange={e=>setCf({...cf,url_destino:e.target.value})}/></div>
            <Button onClick={addCriativo} className="w-full" disabled={!cf.url_arquivo}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Relatorios() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { void (async () => {
    const { data: camps } = await supabase.from("ads_campanhas").select("id,nome");
    const out: any[] = [];
    for (const c of camps ?? []) {
      const [{ count: imp }, { count: cli }] = await Promise.all([
        supabase.from("ads_impressoes").select("*", { count: "exact", head: true }).eq("campanha_id", c.id),
        supabase.from("ads_cliques").select("*", { count: "exact", head: true }).eq("campanha_id", c.id),
      ]);
      out.push({ ...c, imp: imp ?? 0, cli: cli ?? 0, ctr: imp ? ((cli??0)/imp*100).toFixed(2)+"%" : "0%" });
    }
    setRows(out);
  })(); }, []);
  const csv = () => {
    const txt = "campanha,impressoes,cliques,ctr\n" + rows.map(r=>`"${r.nome}",${r.imp},${r.cli},${r.ctr}`).join("\n");
    const u = URL.createObjectURL(new Blob([txt], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download="ads.csv"; a.click();
  };
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={csv}>Exportar CSV</Button>
      {rows.map(r=>(
        <Card key={r.id} className="p-3 flex justify-between"><div className="font-bold text-sm">{r.nome}</div><div className="text-xs">{r.imp} imp · {r.cli} clk · CTR {r.ctr}</div></Card>
      ))}
    </div>
  );
}
