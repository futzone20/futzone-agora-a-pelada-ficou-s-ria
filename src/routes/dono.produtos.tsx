import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Plus, History, Calculator } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/produtos")({ component: ProdutosPage });

function brl(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PFORM_VAZIO = { nome: "", categoria_id: "", preco: 0, preco_custo: 0, estoque_atual: 0, estoque_minimo: 0, foto_url: "" };

function ProdutosPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [novaCat, setNovaCat] = useState("");
  const [openProd, setOpenProd] = useState(false);
  const [pForm, setPForm] = useState<any>(PFORM_VAZIO);
  const [filtroCat, setFiltroCat] = useState("todas");

  // Reposição de estoque (novo custo + histórico)
  const [repProduto, setRepProduto] = useState<any>(null);
  const [repForm, setRepForm] = useState({ preco_custo: 0, preco_venda: 0, quantidade: 0, observacao: "" });

  // Histórico de custo
  const [histProduto, setHistProduto] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);

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
    const proxCod = cats.length === 0 ? 10 : Math.max(...cats.map(c => c.codigo)) + 10;
    const { error } = await supabase.from("pdv_categorias").insert({ arena_id: arena.id, nome: novaCat, codigo: proxCod } as never);
    if (error) toast.error(error.message); else { setNovaCat(""); void load(); }
  };

  const toggleCat = async (c: any) => { await supabase.from("pdv_categorias").update({ ativo: !c.ativo } as never).eq("id", c.id); void load(); };

  // ---- Calculadora de preço sugerido (markup por divisor) ----
  // precoVenda = custo / (1 - (cartao + imposto + margem)/100)
  const precoSugerido = (custo: number) => {
    if (!arena) return 0;
    const pct = (Number(arena.taxa_cartao_pct) || 0) + (Number(arena.imposto_pct) || 0) + (Number(arena.margem_lucro_pct) || 0);
    if (pct >= 100) return 0; // combinação inválida, evita divisão por zero/negativo
    return custo / (1 - pct / 100);
  };

  const criarProd = async () => {
    if (!arena || !pForm.categoria_id) return;
    const proxCod = prods.length === 0 ? 10 : Math.max(...prods.map((p: any) => p.codigo)) + 10;
    const { data: novo, error } = await supabase.from("pdv_produtos").insert({
      nome: pForm.nome, categoria_id: pForm.categoria_id, preco: pForm.preco, preco_custo: pForm.preco_custo,
      estoque_atual: pForm.estoque_atual, estoque_minimo: pForm.estoque_minimo, foto_url: pForm.foto_url,
      arena_id: arena.id, codigo: proxCod,
    } as never).select().single();
    if (error || !novo) { toast.error(error?.message || "Erro ao criar produto"); return; }
    if (Number(pForm.preco_custo) > 0) {
      await supabase.from("pdv_produtos_custo_historico").insert({
        produto_id: (novo as any).id, arena_id: arena.id, preco_custo: pForm.preco_custo, preco_venda: pForm.preco,
        quantidade_reposta: pForm.estoque_atual, observacao: "Cadastro inicial", registrado_por: user!.id,
      } as never);
    }
    setOpenProd(false); setPForm(PFORM_VAZIO); void load();
  };

  const toggleProd = async (p: any) => { await supabase.from("pdv_produtos").update({ ativo: !p.ativo } as never).eq("id", p.id); void load(); };

  const ajustar = async (p: any) => {
    const v = prompt(`Ajuste de estoque para ${p.nome} (use + ou -):`); if (!v) return;
    const delta = parseInt(v, 10); if (isNaN(delta)) return;
    await supabase.from("pdv_produtos").update({ estoque_atual: Math.max(0, p.estoque_atual + delta) } as never).eq("id", p.id);
    void load();
  };

  const abrirReposicao = (p: any) => {
    setRepProduto(p);
    setRepForm({ preco_custo: Number(p.preco_custo) || 0, preco_venda: Number(p.preco) || 0, quantidade: 0, observacao: "" });
  };

  const confirmarReposicao = async () => {
    if (!repProduto || !arena) return;
    const novoEstoque = repProduto.estoque_atual + (Number(repForm.quantidade) || 0);
    const { error } = await supabase.from("pdv_produtos").update({
      preco_custo: repForm.preco_custo, preco: repForm.preco_venda, estoque_atual: novoEstoque,
    } as never).eq("id", repProduto.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("pdv_produtos_custo_historico").insert({
      produto_id: repProduto.id, arena_id: arena.id, preco_custo: repForm.preco_custo, preco_venda: repForm.preco_venda,
      quantidade_reposta: repForm.quantidade, observacao: repForm.observacao || null, registrado_por: user!.id,
    } as never);
    toast.success("Estoque e custo atualizados");
    setRepProduto(null); void load();
  };

  const verHistorico = async (p: any) => {
    setHistProduto(p);
    const { data } = await supabase.from("pdv_produtos_custo_historico").select("*").eq("produto_id", p.id).order("criado_em", { ascending: false });
    setHistorico(data ?? []);
  };

  const sugeridoNovo = useMemo(() => precoSugerido(Number(pForm.preco_custo) || 0), [pForm.preco_custo, arena]);
  const sugeridoRep = useMemo(() => precoSugerido(Number(repForm.preco_custo) || 0), [repForm.preco_custo, arena]);

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const prodsFiltrados = prods.filter(p => filtroCat === "todas" || p.categoria_id === filtroCat);

  return (
    <Tabs defaultValue="produtos">
      <TabsList className="w-full"><TabsTrigger value="produtos" className="flex-1">Produtos</TabsTrigger><TabsTrigger value="categorias" className="flex-1">Categorias</TabsTrigger></TabsList>

      <TabsContent value="categorias" className="space-y-3">
        <Card className="p-3 flex gap-2"><Input placeholder="Nome da categoria" value={novaCat} onChange={e => setNovaCat(e.target.value)} /><Button onClick={criarCat}><Plus className="h-4 w-4" /></Button></Card>
        {cats.map(c => (
          <Card key={c.id} className="p-3 flex justify-between items-center">
            <div><div className="font-bold">{c.codigo} - {c.nome}</div></div>
            <Switch checked={c.ativo} onCheckedChange={() => toggleCat(c)} />
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="produtos" className="space-y-3">
        <div className="flex gap-2">
          <Select value={filtroCat} onValueChange={setFiltroCat}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent></Select>
          <Dialog open={openProd} onOpenChange={setOpenProd}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /></Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Categoria</Label><Select value={pForm.categoria_id} onValueChange={v => setPForm({ ...pForm, categoria_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Nome</Label><Input value={pForm.nome} onChange={e => setPForm({ ...pForm, nome: e.target.value })} /></div>
                <div><Label>Foto URL</Label><Input value={pForm.foto_url} onChange={e => setPForm({ ...pForm, foto_url: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Preço de custo</Label><Input type="number" step="0.01" value={pForm.preco_custo} onChange={e => setPForm({ ...pForm, preco_custo: +e.target.value })} /></div>
                  <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={pForm.preco} onChange={e => setPForm({ ...pForm, preco: +e.target.value })} /></div>
                </div>
                {Number(pForm.preco_custo) > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground"><Calculator className="h-3.5 w-3.5" />Preço sugerido: <b className="text-foreground">{brl(sugeridoNovo)}</b></div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPForm({ ...pForm, preco: Number(sugeridoNovo.toFixed(2)) })}>Usar</Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Estoque</Label><Input type="number" value={pForm.estoque_atual} onChange={e => setPForm({ ...pForm, estoque_atual: +e.target.value })} /></div>
                  <div><Label>Mínimo</Label><Input type="number" value={pForm.estoque_minimo} onChange={e => setPForm({ ...pForm, estoque_minimo: +e.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">Cálculo considera as % de cartão, imposto e margem definidas em Arena.</p>
                <Button onClick={criarProd} disabled={!pForm.nome || !pForm.categoria_id} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {prodsFiltrados.map(p => {
          const margemAtual = Number(p.preco) > 0 ? ((Number(p.preco) - Number(p.preco_custo)) / Number(p.preco)) * 100 : 0;
          return (
            <Card key={p.id} className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{p.codigo} - {p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.pdv_categorias?.nome}</div>
                  <div className="text-xs mt-0.5">Custo {brl(p.preco_custo)} · Venda <b>{brl(p.preco)}</b> {Number(p.preco) > 0 && <span className="text-muted-foreground">({margemAtual.toFixed(0)}% margem)</span>}</div>
                  <div className={`text-xs mt-1 ${p.estoque_atual <= p.estoque_minimo ? "text-rose-500 font-bold" : ""}`}>Estoque: {p.estoque_atual} (mín {p.estoque_minimo})</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Switch checked={p.ativo} onCheckedChange={() => toggleProd(p)} />
                  <Button size="sm" variant="outline" onClick={() => ajustar(p)}>Ajuste</Button>
                  <Button size="sm" variant="outline" onClick={() => abrirReposicao(p)}>Repor estoque</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => verHistorico(p)}><History className="h-3 w-3 mr-1" />Histórico</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </TabsContent>

      {/* Reposição de estoque com novo preço de custo */}
      <Dialog open={!!repProduto} onOpenChange={o => !o && setRepProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Repor estoque — {repProduto?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Ao repor o estoque você pode registrar um novo preço de custo (ex: comprou por um valor diferente desta vez). O histórico anterior fica salvo para comparação.</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Novo preço de custo</Label><Input type="number" step="0.01" value={repForm.preco_custo} onChange={e => setRepForm({ ...repForm, preco_custo: +e.target.value })} /></div>
              <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={repForm.preco_venda} onChange={e => setRepForm({ ...repForm, preco_venda: +e.target.value })} /></div>
            </div>
            {Number(repForm.preco_custo) > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Calculator className="h-3.5 w-3.5" />Preço sugerido: <b className="text-foreground">{brl(sugeridoRep)}</b></div>
                <Button type="button" size="sm" variant="outline" onClick={() => setRepForm({ ...repForm, preco_venda: Number(sugeridoRep.toFixed(2)) })}>Usar</Button>
              </div>
            )}
            <div><Label>Quantidade recebida</Label><Input type="number" value={repForm.quantidade} onChange={e => setRepForm({ ...repForm, quantidade: +e.target.value })} /></div>
            <div><Label>Observação (opcional)</Label><Input value={repForm.observacao} onChange={e => setRepForm({ ...repForm, observacao: e.target.value })} placeholder="Ex: compra no fornecedor X" /></div>
            <Button onClick={confirmarReposicao} className="w-full">Confirmar reposição</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de preço de custo */}
      <Dialog open={!!histProduto} onOpenChange={o => !o && setHistProduto(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de custo — {histProduto?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {historico.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro ainda.</p>}
            {historico.map((h, i) => {
              const anterior = historico[i + 1];
              const variacao = anterior ? ((Number(h.preco_custo) - Number(anterior.preco_custo)) / Number(anterior.preco_custo)) * 100 : null;
              return (
                <Card key={h.id} className="p-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold">Custo {brl(h.preco_custo)}</span>
                    {variacao !== null && (
                      <span className={variacao > 0 ? "text-rose-500" : variacao < 0 ? "text-emerald-500" : "text-muted-foreground"}>
                        {variacao > 0 ? "▲" : variacao < 0 ? "▼" : ""} {Math.abs(variacao).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.preco_venda != null && <>Venda {brl(h.preco_venda)} · </>}
                    {h.quantidade_reposta != null && <>+{h.quantidade_reposta} un · </>}
                    {new Date(h.criado_em).toLocaleDateString("pt-BR")}
                  </div>
                  {h.observacao && <div className="text-xs mt-0.5">{h.observacao}</div>}
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
