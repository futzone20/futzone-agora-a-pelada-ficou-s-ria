import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/produtos")({ component: ProdutosPage });

function ProdutosPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [novaCat, setNovaCat] = useState("");
  const [openProd, setOpenProd] = useState(false);
  const [pForm, setPForm] = useState<any>({ nome:"", categoria_id:"", preco:0, estoque_atual:0, estoque_minimo:0, foto_url:"" });
  const [filtroCat, setFiltroCat] = useState("todas");

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    const { data: c } = await supabase.from("pdv_categorias").select("*").eq("arena_id", a.id).order("codigo");
    setCats(c ?? []);
    const { data: p } = await supabase.from("pdv_produtos").select("*, pdv_categorias(nome)").eq("arena_id", a.id).order("codigo");
    setProds(p ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const criarCat = async () => {
    if (!arena || !novaCat) return;
    const proxCod = cats.length === 0 ? 10 : Math.max(...cats.map(c=>c.codigo)) + 10;
    const { error } = await supabase.from("pdv_categorias").insert({ arena_id: arena.id, nome: novaCat, codigo: proxCod } as never);
    if (error) toast.error(error.message); else { setNovaCat(""); void load(); }
  };

  const toggleCat = async (c:any) => { await supabase.from("pdv_categorias").update({ ativo: !c.ativo } as never).eq("id", c.id); void load(); };

  const criarProd = async () => {
    if (!arena || !pForm.categoria_id) return;
    const { error } = await supabase.from("pdv_produtos").insert({ ...pForm, arena_id: arena.id, codigo: 0 } as never);
    if (error) toast.error(error.message); else { setOpenProd(false); setPForm({ nome:"", categoria_id:"", preco:0, estoque_atual:0, estoque_minimo:0, foto_url:"" }); void load(); }
  };

  const toggleProd = async (p:any) => { await supabase.from("pdv_produtos").update({ ativo: !p.ativo } as never).eq("id", p.id); void load(); };

  const ajustar = async (p:any) => {
    const v = prompt(`Ajuste de estoque para ${p.nome} (use + ou -):`); if (!v) return;
    const delta = parseInt(v, 10); if (isNaN(delta)) return;
    await supabase.from("pdv_produtos").update({ estoque_atual: Math.max(0, p.estoque_atual + delta) } as never).eq("id", p.id);
    void load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const prodsFiltrados = prods.filter(p => filtroCat === "todas" || p.categoria_id === filtroCat);

  return (
    <Tabs defaultValue="produtos">
      <TabsList className="w-full"><TabsTrigger value="produtos" className="flex-1">Produtos</TabsTrigger><TabsTrigger value="categorias" className="flex-1">Categorias</TabsTrigger></TabsList>

      <TabsContent value="categorias" className="space-y-3">
        <Card className="p-3 flex gap-2"><Input placeholder="Nome da categoria" value={novaCat} onChange={e=>setNovaCat(e.target.value)}/><Button onClick={criarCat}><Plus className="h-4 w-4"/></Button></Card>
        {cats.map(c=>(
          <Card key={c.id} className="p-3 flex justify-between items-center">
            <div><div className="font-bold">{c.codigo} - {c.nome}</div></div>
            <Switch checked={c.ativo} onCheckedChange={()=>toggleCat(c)}/>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="produtos" className="space-y-3">
        <div className="flex gap-2">
          <Select value={filtroCat} onValueChange={setFiltroCat}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>{cats.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent></Select>
          <Dialog open={openProd} onOpenChange={setOpenProd}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4"/></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Categoria</Label><Select value={pForm.categoria_id} onValueChange={v=>setPForm({...pForm,categoria_id:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{cats.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Nome</Label><Input value={pForm.nome} onChange={e=>setPForm({...pForm,nome:e.target.value})}/></div>
                <div><Label>Foto URL</Label><Input value={pForm.foto_url} onChange={e=>setPForm({...pForm,foto_url:e.target.value})}/></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Preço</Label><Input type="number" step="0.01" value={pForm.preco} onChange={e=>setPForm({...pForm,preco:+e.target.value})}/></div>
                  <div><Label>Estoque</Label><Input type="number" value={pForm.estoque_atual} onChange={e=>setPForm({...pForm,estoque_atual:+e.target.value})}/></div>
                  <div><Label>Mínimo</Label><Input type="number" value={pForm.estoque_minimo} onChange={e=>setPForm({...pForm,estoque_minimo:+e.target.value})}/></div>
                </div>
                <Button onClick={criarProd} disabled={!pForm.nome||!pForm.categoria_id} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {prodsFiltrados.map(p=>(
          <Card key={p.id} className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{p.codigo} - {p.nome}</div>
                <div className="text-xs text-muted-foreground">{p.pdv_categorias?.nome} · R$ {Number(p.preco).toFixed(2)}</div>
                <div className={`text-xs mt-1 ${p.estoque_atual<=p.estoque_minimo?"text-rose-500 font-bold":""}`}>Estoque: {p.estoque_atual} (mín {p.estoque_minimo})</div>
              </div>
              <div className="flex flex-col items-end gap-2"><Switch checked={p.ativo} onCheckedChange={()=>toggleProd(p)}/><Button size="sm" variant="outline" onClick={()=>ajustar(p)}>Ajuste</Button></div>
            </div>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
