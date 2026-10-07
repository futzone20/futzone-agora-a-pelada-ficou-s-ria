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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, History, Calculator, Settings, ImageOff, Boxes, TrendingUp, Wallet, Pencil, Trash2 } from "lucide-react";
import { ProdutoFotoPicker } from "@/components/ProdutoFotoPicker";
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

  // Edição e exclusão de produto
  const [editProduto, setEditProduto] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(PFORM_VAZIO);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluirProduto, setExcluirProduto] = useState<any>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);

  // Configurações de precificação (taxa de cartão, imposto, margem, modo automático/manual)
  const [precifForm, setPrecifForm] = useState({ taxa_cartao_pct: 4, imposto_pct: 6, margem_lucro_pct: 30, modo_precificacao: "manual" });
  const [salvandoPrecif, setSalvandoPrecif] = useState(false);

  // Inventário — itens já vendidos (pra total vendido + histórico por data)
  const [itensVendidos, setItensVendidos] = useState<any[]>([]);
  const [openHistoricoVendas, setOpenHistoricoVendas] = useState(false);

  const carregarItensVendidos = async (arenaId: string) => {
    const { data } = await supabase
      .from("pdv_itens_venda")
      .select("*, pdv_vendas!inner(arena_id, criado_em), pdv_produtos(nome)")
      .eq("pdv_vendas.arena_id", arenaId)
      .order("criado_em", { foreignTable: "pdv_vendas", ascending: false });
    setItensVendidos(data ?? []);
  };

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    setPrecifForm({
      taxa_cartao_pct: Number((a as any).taxa_cartao_pct) || 0,
      imposto_pct: Number((a as any).imposto_pct) || 0,
      margem_lucro_pct: Number((a as any).margem_lucro_pct) || 0,
      modo_precificacao: (a as any).modo_precificacao || "manual",
    });
    const { data: c } = await supabase.from("pdv_categorias").select("*").eq("arena_id", a.id).order("codigo");
    setCats(c ?? []);
    const { data: p } = await supabase.from("pdv_produtos").select("*, pdv_categorias(nome)").eq("arena_id", a.id).order("codigo");
    setProds(p ?? []);
    await carregarItensVendidos(a.id);
  };
  useEffect(() => { void load(); }, [user?.id]);

  // ---- Inventário: custo em estoque, potencial de venda e total já vendido ----
  const custoEstoque = useMemo(() => prods.reduce((s, p: any) => s + Number(p.preco_custo) * Number(p.estoque_atual), 0), [prods]);
  const potencialVenda = useMemo(() => prods.reduce((s, p: any) => s + Number(p.preco) * Number(p.estoque_atual), 0), [prods]);
  const totalVendido = useMemo(() => itensVendidos.reduce((s, i: any) => s + Number(i.subtotal), 0), [itensVendidos]);
  const vendasPorData = useMemo(() => {
    const mapa = new Map<string, { data: string; itens: any[]; total: number }>();
    itensVendidos.forEach((i: any) => {
      const d = i.pdv_vendas?.criado_em ? new Date(i.pdv_vendas.criado_em) : null;
      const chave = d ? d.toLocaleDateString("pt-BR") : "Data desconhecida";
      if (!mapa.has(chave)) mapa.set(chave, { data: chave, itens: [], total: 0 });
      const g = mapa.get(chave)!;
      g.itens.push(i);
      g.total += Number(i.subtotal);
    });
    return Array.from(mapa.values());
  }, [itensVendidos]);

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

  const salvarPrecif = async () => {
    if (!arena) return;
    setSalvandoPrecif(true);
    const { error } = await supabase.from("arenas").update({
      taxa_cartao_pct: precifForm.taxa_cartao_pct, imposto_pct: precifForm.imposto_pct,
      margem_lucro_pct: precifForm.margem_lucro_pct, modo_precificacao: precifForm.modo_precificacao,
    } as never).eq("id", arena.id);
    setSalvandoPrecif(false);
    if (error) { toast.error(error.message); return; }
    setArena({ ...arena, ...precifForm });
    toast.success("Configurações de precificação salvas");
  };

  // Atualiza o preço de custo; se o modo for automático, já recalcula o preço de venda sugerido
  const setCustoNovoProd = (v: number) => {
    const automatico = arena?.modo_precificacao === "automatico";
    setPForm((f: any) => ({ ...f, preco_custo: v, preco: automatico ? Number(precoSugerido(v).toFixed(2)) : f.preco }));
  };
  const setCustoReposicao = (v: number) => {
    const automatico = arena?.modo_precificacao === "automatico";
    setRepForm(f => ({ ...f, preco_custo: v, preco_venda: automatico ? Number(precoSugerido(v).toFixed(2)) : f.preco_venda }));
  };

  const criarProd = async () => {
    if (!arena || !pForm.categoria_id) return;
    // Código do produto começa com o código da categoria (ex: categoria 10 →
    // produtos 1001, 1002...), assim dá pra digitar só o início (o código da
    // categoria) na busca do PDV e já aparecerem todos os produtos dela.
    const cat = cats.find(c => c.id === pForm.categoria_id);
    if (!cat) { toast.error("Selecione uma categoria"); return; }
    const base = cat.codigo * 100;
    const doCategoria = prods.filter((p: any) => p.categoria_id === pForm.categoria_id);
    const proxCod = doCategoria.length === 0 ? base + 1 : Math.max(...doCategoria.map((p: any) => p.codigo)) + 1;
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

  const abrirEdicao = (p: any) => {
    setEditProduto(p);
    setEditForm({
      nome: p.nome, categoria_id: p.categoria_id, preco: Number(p.preco) || 0, preco_custo: Number(p.preco_custo) || 0,
      estoque_atual: p.estoque_atual, estoque_minimo: p.estoque_minimo, foto_url: p.foto_url || "",
    });
  };

  const salvarEdicao = async () => {
    if (!editProduto || !editForm.nome.trim()) return;
    setSalvandoEdicao(true);
    const { error } = await supabase.from("pdv_produtos").update({
      nome: editForm.nome.trim(), preco: editForm.preco, preco_custo: editForm.preco_custo,
      estoque_atual: Math.max(0, Math.trunc(Number(editForm.estoque_atual) || 0)),
      estoque_minimo: Math.max(0, Math.trunc(Number(editForm.estoque_minimo) || 0)),
      foto_url: editForm.foto_url || null,
    } as never).eq("id", editProduto.id);
    setSalvandoEdicao(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Produto atualizado");
    setEditProduto(null); void load();
  };

  const confirmarExclusao = async () => {
    if (!excluirProduto) return;
    setExcluindo(true);
    const { error } = await supabase.from("pdv_produtos").delete().eq("id", excluirProduto.id);
    setExcluindo(false);
    if (error) {
      // 23503 = violação de chave estrangeira: o produto já aparece em vendas/comandas
      if ((error as any).code === "23503") {
        toast.error("Este produto já tem vendas registradas e não pode ser excluído. Desative-o (chave verde) para ele sumir do PDV.");
      } else {
        toast.error(error.message);
      }
      setExcluirProduto(null);
      return;
    }
    toast.success("Produto excluído");
    setExcluirProduto(null); void load();
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
      <TabsList className="w-full">
        <TabsTrigger value="produtos" className="flex-1">Produtos</TabsTrigger>
        <TabsTrigger value="categorias" className="flex-1">Categorias</TabsTrigger>
        <TabsTrigger value="inventario" className="flex-1">Inventário</TabsTrigger>
        <TabsTrigger value="precificacao" className="flex-1">Precificação</TabsTrigger>
      </TabsList>

      <TabsContent value="inventario" className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Boxes className="h-3.5 w-3.5" />Valor em estoque (custo)</div>
            <div className="text-xl font-bold">{brl(custoEstoque)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Quanto já está investido no estoque atual.</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" />Potencial se vender tudo</div>
            <div className="text-xl font-bold text-emerald-500">{brl(potencialVenda)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Lucro potencial: {brl(potencialVenda - custoEstoque)}</p>
          </Card>
          <Card className="p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setOpenHistoricoVendas(true)}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Wallet className="h-3.5 w-3.5" />Total já vendido</div>
            <div className="text-xl font-bold text-primary">{brl(totalVendido)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Toque para ver o histórico por data</p>
          </Card>
        </div>

        <Dialog open={openHistoricoVendas} onOpenChange={setOpenHistoricoVendas}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Histórico de vendas — {brl(totalVendido)}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {vendasPorData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registrada ainda.</p>}
              {vendasPorData.map(g => (
                <Card key={g.data} className="p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-sm">{g.data}</span>
                    <span className="font-bold text-emerald-500">{brl(g.total)}</span>
                  </div>
                  <div className="space-y-1">
                    {g.itens.map((i: any) => (
                      <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                        <span>{i.quantidade}x {i.pdv_produtos?.nome ?? "Produto removido"}</span>
                        <span>{brl(i.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="precificacao" className="space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold flex items-center gap-1.5"><Settings className="h-4 w-4" />Cálculo do preço sugerido</h3>
              <p className="text-xs text-muted-foreground">Usado pra calcular o preço de venda ideal de cada produto a partir do custo.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Taxa do cartão (%)</Label><Input type="number" step="0.01" value={precifForm.taxa_cartao_pct} onChange={e => setPrecifForm({ ...precifForm, taxa_cartao_pct: +e.target.value })} /></div>
            <div><Label>Imposto (%)</Label><Input type="number" step="0.01" value={precifForm.imposto_pct} onChange={e => setPrecifForm({ ...precifForm, imposto_pct: +e.target.value })} /></div>
            <div><Label>Margem de lucro (%)</Label><Input type="number" step="0.01" value={precifForm.margem_lucro_pct} onChange={e => setPrecifForm({ ...precifForm, margem_lucro_pct: +e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="font-bold text-sm">Calcular preço de venda automaticamente</div>
              <p className="text-xs text-muted-foreground">
                {precifForm.modo_precificacao === "automatico"
                  ? "Ligado: ao informar o preço de custo, o preço de venda já preenche sozinho com base nas %. Você ainda pode editar manualmente se quiser."
                  : "Desligado: o preço de venda sugerido aparece como referência (com botão \"Usar\"), mas você digita o valor final."}
              </p>
            </div>
            <Switch
              checked={precifForm.modo_precificacao === "automatico"}
              onCheckedChange={v => setPrecifForm({ ...precifForm, modo_precificacao: v ? "automatico" : "manual" })}
            />
          </div>
          <Button onClick={salvarPrecif} disabled={salvandoPrecif} className="w-full">{salvandoPrecif ? "Salvando..." : "Salvar configurações"}</Button>
        </Card>
      </TabsContent>

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
                <ProdutoFotoPicker value={pForm.foto_url} nomeSugestao={pForm.nome} onChange={url => setPForm({ ...pForm, foto_url: url })} />
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Preço de custo</Label><Input type="number" step="0.01" value={pForm.preco_custo} onChange={e => setCustoNovoProd(+e.target.value)} /></div>
                  <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={pForm.preco} onChange={e => setPForm({ ...pForm, preco: +e.target.value })} /></div>
                </div>
                {Number(pForm.preco_custo) > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground"><Calculator className="h-3.5 w-3.5" />Preço sugerido: <b className="text-foreground">{brl(sugeridoNovo)}</b></div>
                    {arena.modo_precificacao !== "automatico" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setPForm({ ...pForm, preco: Number(sugeridoNovo.toFixed(2)) })}>Usar</Button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Estoque</Label><Input type="number" value={pForm.estoque_atual} onChange={e => setPForm({ ...pForm, estoque_atual: +e.target.value })} /></div>
                  <div><Label>Mínimo</Label><Input type="number" value={pForm.estoque_minimo} onChange={e => setPForm({ ...pForm, estoque_minimo: +e.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {arena.modo_precificacao === "automatico"
                    ? "Preço de venda calculado automaticamente a partir do custo (você pode ajustar manualmente também). Configure as % na aba Precificação."
                    : "Cálculo considera as % de cartão, imposto e margem definidas na aba Precificação."}
                </p>
                <Button onClick={criarProd} disabled={!pForm.nome || !pForm.categoria_id} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {prodsFiltrados.map(p => {
          const margemAtual = Number(p.preco) > 0 ? ((Number(p.preco) - Number(p.preco_custo)) / Number(p.preco)) * 100 : 0;
          return (
            <Card key={p.id} className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-2.5 min-w-0">
                  <div className="h-12 w-12 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                    {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" /> : <ImageOff className="h-5 w-5 text-muted-foreground/50" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{p.codigo} - {p.nome}</div>
                    <div className="text-xs text-muted-foreground">{p.pdv_categorias?.nome}</div>
                    <div className="text-xs mt-0.5">Custo {brl(p.preco_custo)} · Venda <b>{brl(p.preco)}</b> {Number(p.preco) > 0 && <span className="text-muted-foreground">({margemAtual.toFixed(0)}% margem)</span>}</div>
                    <div className={`text-xs mt-1 ${p.estoque_atual <= p.estoque_minimo ? "text-rose-500 font-bold" : ""}`}>Estoque: {p.estoque_atual} (mín {p.estoque_minimo})</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Switch checked={p.ativo} onCheckedChange={() => toggleProd(p)} />
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(p)}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => abrirReposicao(p)}>Repor estoque</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => verHistorico(p)}><History className="h-3 w-3 mr-1" />Histórico</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-rose-500 hover:text-rose-500" onClick={() => setExcluirProduto(p)}><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </TabsContent>

      {/* Edição de produto */}
      <Dialog open={!!editProduto} onOpenChange={o => !o && setEditProduto(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar produto — {editProduto?.codigo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <ProdutoFotoPicker value={editForm.foto_url} nomeSugestao={editForm.nome} onChange={url => setEditForm({ ...editForm, foto_url: url })} />
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Preço de custo</Label><Input type="number" step="0.01" value={editForm.preco_custo} onChange={e => setEditForm({ ...editForm, preco_custo: +e.target.value })} /></div>
              <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={editForm.preco} onChange={e => setEditForm({ ...editForm, preco: +e.target.value })} /></div>
            </div>
            {Number(editForm.preco_custo) > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Calculator className="h-3.5 w-3.5" />Preço sugerido: <b className="text-foreground">{brl(precoSugerido(Number(editForm.preco_custo) || 0))}</b></div>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditForm({ ...editForm, preco: Number(precoSugerido(Number(editForm.preco_custo) || 0).toFixed(2)) })}>Usar</Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Estoque atual</Label><Input type="number" value={editForm.estoque_atual} onChange={e => setEditForm({ ...editForm, estoque_atual: +e.target.value })} /></div>
              <div><Label>Mínimo</Label><Input type="number" value={editForm.estoque_minimo} onChange={e => setEditForm({ ...editForm, estoque_minimo: +e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Para corrigir o estoque (contagem, perda, quebra), é só alterar o número em "Estoque atual". Para compra nova com custo diferente, use "Repor estoque".</p>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao || !editForm.nome.trim()} className="w-full">{salvandoEdicao ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de produto */}
      <AlertDialog open={!!excluirProduto} onOpenChange={o => !o && setExcluirProduto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluirProduto?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto some do cadastro e do PDV. Se ele já tiver vendas registradas, a exclusão não é permitida — nesse caso, desative-o pela chave verde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={excluindo} onClick={(e) => { e.preventDefault(); void confirmarExclusao(); }} className="bg-rose-600 hover:bg-rose-700">{excluindo ? "Excluindo..." : "Excluir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reposição de estoque com novo preço de custo */}
      <Dialog open={!!repProduto} onOpenChange={o => !o && setRepProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Repor estoque — {repProduto?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Ao repor o estoque você pode registrar um novo preço de custo (ex: comprou por um valor diferente desta vez). O histórico anterior fica salvo para comparação.</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Novo preço de custo</Label><Input type="number" step="0.01" value={repForm.preco_custo} onChange={e => setCustoReposicao(+e.target.value)} /></div>
              <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={repForm.preco_venda} onChange={e => setRepForm({ ...repForm, preco_venda: +e.target.value })} /></div>
            </div>
            {Number(repForm.preco_custo) > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Calculator className="h-3.5 w-3.5" />Preço sugerido: <b className="text-foreground">{brl(sugeridoRep)}</b></div>
                {arena?.modo_precificacao !== "automatico" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setRepForm({ ...repForm, preco_venda: Number(sugeridoRep.toFixed(2)) })}>Usar</Button>
                )}
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
