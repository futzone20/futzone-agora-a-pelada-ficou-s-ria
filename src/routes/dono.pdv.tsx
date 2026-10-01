import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContagemCaixa, totalContagem, type ContagemDetalhe } from "@/components/ContagemCaixa";
import { ComandaDialog } from "@/components/ComandaDialog";
import { Minus, Plus, ShoppingCart, Trash, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, History, Receipt, CheckCircle2, AlertTriangle, ImageOff, Search, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/pdv")({ component: PDV });

type Item = { produto: any; qtd: number };

function brl(n: number) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const FORMAS_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_debito: "Débito", cartao_credito: "Crédito", cashback: "Cashback",
};

function PDV() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [carrinho, setCarrinho] = useState<Item[]>([]);
  const [openPag, setOpenPag] = useState(false);
  const [forma, setForma] = useState("dinheiro");
  const [buscaUser, setBuscaUser] = useState("");
  const [userPag, setUserPag] = useState<any>(null);
  const [saldoUser, setSaldoUser] = useState(0);
  const [valorRecebido, setValorRecebido] = useState("");
  const [usuariosBusca, setUsuariosBusca] = useState<any[]>([]);
  const [recibo, setRecibo] = useState<any>(null);

  // ----- Livro caixa -----
  const [caixa, setCaixa] = useState<any>(null);
  const [checandoCaixa, setChecandoCaixa] = useState(true);
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [openAbertura, setOpenAbertura] = useState(false);
  const [contagemAbertura, setContagemAbertura] = useState<ContagemDetalhe>({});
  const [obsAbertura, setObsAbertura] = useState("");
  const [openMov, setOpenMov] = useState<"sangria" | "reforco" | null>(null);
  const [movValor, setMovValor] = useState(0);
  const [movDesc, setMovDesc] = useState("");
  const [openFechamento, setOpenFechamento] = useState(false);
  const [contagemFechamento, setContagemFechamento] = useState<ContagemDetalhe>({});
  const [obsFechamento, setObsFechamento] = useState("");
  const [resultadoFechamento, setResultadoFechamento] = useState<any>(null);
  const [openHistorico, setOpenHistorico] = useState(false);
  const [historicoSessoes, setHistoricoSessoes] = useState<any[]>([]);

  // ----- Comandas -----
  const [comandas, setComandas] = useState<any[]>([]);
  const [openNovaComanda, setOpenNovaComanda] = useState(false);
  const [novaComandaTipo, setNovaComandaTipo] = useState<"grupo" | "separada">("separada");
  const [novaComandaNome, setNovaComandaNome] = useState("");
  const [comandaAberta, setComandaAberta] = useState<any>(null);
  const [aba, setAba] = useState("produtos");

  const abrirComanda = (c: any) => { setComandaAberta(c); setAba("produtos"); };

  // ----- Máscara do valor em caixa -----
  const [mostrarCaixa, setMostrarCaixa] = useState(true);
  useEffect(() => {
    try { setMostrarCaixa(localStorage.getItem("pdv_mostrar_valor_caixa") !== "0"); } catch { /* ignore */ }
  }, []);
  const toggleMostrarCaixa = () => setMostrarCaixa(v => {
    const next = !v;
    try { localStorage.setItem("pdv_mostrar_valor_caixa", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });

  const loadComandas = async (arenaId: string) => {
    const { data } = await supabase.from("pdv_comandas").select("*").eq("arena_id", arenaId).order("status").order("aberta_em", { ascending: false });
    setComandas(data ?? []);
  };

  const abrirNovaComanda = async () => {
    if (!arena || !user || !novaComandaNome.trim()) return;
    const { data, error } = await supabase.from("pdv_comandas").insert({
      arena_id: arena.id, tipo: novaComandaTipo, nome: novaComandaNome.trim(), operador_abertura_id: user.id,
    } as never).select().single();
    if (error || !data) { toast.error(error?.message || "Erro ao abrir comanda"); return; }
    setOpenNovaComanda(false); setNovaComandaNome(""); setNovaComandaTipo("separada");
    await loadComandas(arena.id);
    setComandaAberta(data);
  };

  const loadCaixa = async (arenaId: string) => {
    setChecandoCaixa(true);
    const { data } = await supabase.from("caixa_sessoes").select("*").eq("arena_id", arenaId).eq("status", "aberto").maybeSingle();
    setCaixa(data ?? null);
    if (data) {
      const { data: m } = await supabase.from("caixa_movimentos").select("*").eq("caixa_sessao_id", (data as any).id).order("criado_em");
      setMovimentos(m ?? []);
    } else {
      setMovimentos([]);
    }
    setChecandoCaixa(false);
  };

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    const { data: p } = await supabase.from("pdv_produtos").select("*, pdv_categorias(nome, codigo)").eq("arena_id", a.id).eq("ativo", true).order("codigo");
    setProdutos(p ?? []);
    await loadCaixa(a.id);
    await loadComandas(a.id);
  };
  useEffect(() => { void load(); }, [user?.id]);

  // Dinheiro físico esperado na gaveta agora (abertura + vendas em dinheiro + reforços - sangrias)
  const dinheiroCalculado = useMemo(() => {
    const base = Number(caixa?.valor_abertura) || 0;
    const ajustes = movimentos.reduce((s, m) => {
      if (m.tipo === "venda" && m.forma_pagamento === "dinheiro") return s + Number(m.valor);
      if (m.tipo === "reforco") return s + Number(m.valor);
      if (m.tipo === "sangria") return s - Number(m.valor);
      return s;
    }, 0);
    return base + ajustes;
  }, [caixa, movimentos]);

  const resumoPorForma = useMemo(() => {
    const r: Record<string, number> = {};
    movimentos.filter(m => m.tipo === "venda").forEach(m => { r[m.forma_pagamento] = (r[m.forma_pagamento] || 0) + Number(m.valor); });
    return r;
  }, [movimentos]);

  const abrirCaixa = async () => {
    if (!arena || !user) return;
    const total = totalContagem(contagemAbertura);
    const { data, error } = await supabase.from("caixa_sessoes").insert({
      arena_id: arena.id, operador_abertura_id: user.id, valor_abertura: total, abertura_detalhe: contagemAbertura, observacoes: obsAbertura || null,
    } as never).select().single();
    if (error || !data) { toast.error(error?.message || "Erro ao abrir caixa"); return; }
    await supabase.from("caixa_movimentos").insert({
      caixa_sessao_id: (data as any).id, arena_id: arena.id, tipo: "abertura", forma_pagamento: "dinheiro", valor: total,
      descricao: "Abertura de caixa", operador_id: user.id,
    } as never);
    toast.success("Caixa aberto");
    setOpenAbertura(false); setContagemAbertura({}); setObsAbertura("");
    await loadCaixa(arena.id);
  };

  const registrarMovimento = async () => {
    if (!arena || !user || !caixa || !openMov || movValor <= 0) return;
    await supabase.from("caixa_movimentos").insert({
      caixa_sessao_id: caixa.id, arena_id: arena.id, tipo: openMov, forma_pagamento: "dinheiro", valor: movValor,
      descricao: movDesc || (openMov === "sangria" ? "Sangria" : "Reforço"), operador_id: user.id,
    } as never);
    toast.success(openMov === "sangria" ? "Sangria registrada" : "Reforço registrado");
    setOpenMov(null); setMovValor(0); setMovDesc("");
    await loadCaixa(arena.id);
  };

  const confirmarFechamento = async () => {
    if (!arena || !user || !caixa) return;
    const contado = totalContagem(contagemFechamento);
    const diferenca = contado - dinheiroCalculado;
    const { error } = await supabase.from("caixa_sessoes").update({
      status: "fechado", fechado_em: new Date().toISOString(), operador_fechamento_id: user.id,
      valor_calculado_fechamento: dinheiroCalculado, valor_contado_fechamento: contado, diferenca,
      fechamento_detalhe: contagemFechamento, observacoes: [caixa.observacoes, obsFechamento].filter(Boolean).join(" | ") || null,
    } as never).eq("id", caixa.id);
    if (error) { toast.error(error.message); return; }
    setResultadoFechamento({ calculado: dinheiroCalculado, contado, diferenca, resumo: resumoPorForma });
    setOpenFechamento(false); setContagemFechamento({}); setObsFechamento("");
    await loadCaixa(arena.id);
  };

  const verHistorico = async () => {
    if (!arena) return;
    const { data } = await supabase.from("caixa_sessoes").select("*").eq("arena_id", arena.id).eq("status", "fechado").order("fechado_em", { ascending: false }).limit(30);
    setHistoricoSessoes(data ?? []);
    setOpenHistorico(true);
  };

  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    const lista: string[] = [];
    produtos.forEach((p: any) => { const n = p.pdv_categorias?.nome; if (n && !vistas.has(n)) { vistas.add(n); lista.push(n); } });
    return lista;
  }, [produtos]);

  const filtrados = useMemo(() => {
    let base = produtos;
    if (categoriaFiltro !== "todas") base = base.filter((p: any) => p.pdv_categorias?.nome === categoriaFiltro);
    const q = busca.trim().toLowerCase(); if (!q) return base;
    const n = Number(q);
    if (!isNaN(n)) {
      if (q.length <= 2) return base.filter((p: any) => p.pdv_categorias?.codigo === n);
      return base.filter((p: any) => p.codigo === n);
    }
    return base.filter((p: any) => p.nome.toLowerCase().includes(q));
  }, [produtos, busca, categoriaFiltro]);

  const add = (p: any) => {
    if (!caixa) { toast.error("Abra o caixa antes de vender"); return; }
    if (p.estoque_atual <= 0) { toast.error("Sem estoque"); return; }
    setCarrinho(c => {
      const ex = c.find(i => i.produto.id === p.id);
      if (ex) { if (ex.qtd >= p.estoque_atual) { toast.error("Estoque insuficiente"); return c; } return c.map(i => i.produto.id === p.id ? { ...i, qtd: i.qtd + 1 } : i); }
      return [...c, { produto: p, qtd: 1 }];
    });
  };
  const dec = (id: string) => setCarrinho(c => c.map(i => i.produto.id === id ? { ...i, qtd: i.qtd - 1 } : i).filter(i => i.qtd > 0));
  const del = (id: string) => setCarrinho(c => c.filter(i => i.produto.id !== id));
  const total = carrinho.reduce((s, i) => s + Number(i.produto.preco) * i.qtd, 0);

  const buscarUser = async () => {
    const q = buscaUser.trim(); if (!q) return;
    const { data } = await supabase.from("profiles").select("user_id,nome,whatsapp,foto_url").or(`nome.ilike.%${q}%,whatsapp.ilike.%${q}%`).limit(5);
    setUsuariosBusca(data ?? []);
  };

  const selecionarUser = async (u: any) => {
    setUserPag(u);
    const { data } = await supabase.from("cashback_saldo").select("saldo").eq("user_id", u.user_id).eq("arena_id", arena.id).maybeSingle();
    setSaldoUser(Number(data?.saldo ?? 0));
  };

  const finalizar = async () => {
    if (!arena || !user || !caixa) return;
    let cashUtil = 0;
    if (forma === "cashback") {
      if (!userPag) { toast.error("Selecione usuário"); return; }
      if (saldoUser < total) { toast.error("Saldo insuficiente"); return; }
      cashUtil = total;
    }
    const { data: venda, error } = await supabase.from("pdv_vendas").insert({
      arena_id: arena.id, usuario_id: userPag?.user_id ?? null, total, forma_pagamento: forma,
      cashback_utilizado: cashUtil, operador_id: user.id, caixa_sessao_id: caixa.id,
    } as never).select().single();
    if (error || !venda) { toast.error(error?.message || "Erro"); return; }
    const itens = carrinho.map(i => ({ venda_id: (venda as any).id, produto_id: i.produto.id, quantidade: i.qtd, preco_unitario: i.produto.preco, subtotal: Number(i.produto.preco) * i.qtd }));
    const { error: e2 } = await supabase.from("pdv_itens_venda").insert(itens as never);
    if (e2) { toast.error(e2.message); return; }
    await supabase.from("caixa_movimentos").insert({
      caixa_sessao_id: caixa.id, arena_id: arena.id, tipo: "venda", forma_pagamento: forma, valor: total,
      venda_id: (venda as any).id, operador_id: user.id, descricao: `Venda #${(venda as any).id.slice(0, 8)}`,
    } as never);
    setRecibo({ venda, itens: carrinho, total });
    setCarrinho([]); setOpenPag(false); setForma("dinheiro"); setUserPag(null); setBuscaUser(""); setSaldoUser(0); setValorRecebido("");
    await load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;
  if (checandoCaixa) return <div className="text-center text-sm text-muted-foreground py-8">Carregando caixa...</div>;

  // ----- Caixa fechado: tela de abertura -----
  if (!caixa) {
    return (
      <div className="space-y-3">
        <Card className="p-6 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-bold">Caixa fechado</h3>
            <p className="text-sm text-muted-foreground">Abra o caixa informando o valor inicial para começar a vender.</p>
          </div>
          <Button onClick={() => setOpenAbertura(true)} className="w-full"><Unlock className="h-4 w-4 mr-2" />Abrir caixa</Button>
          <Button variant="ghost" size="sm" onClick={verHistorico}><History className="h-4 w-4 mr-2" />Ver histórico de caixas</Button>
        </Card>

        <Dialog open={openAbertura} onOpenChange={setOpenAbertura}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Abertura de caixa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Conte o dinheiro físico que está colocando na gaveta (fundo de troco).</p>
              <ContagemCaixa value={contagemAbertura} onChange={setContagemAbertura} />
              <div><Label>Observações (opcional)</Label><Input value={obsAbertura} onChange={e => setObsAbertura(e.target.value)} /></div>
              <Button onClick={abrirCaixa} className="w-full">Confirmar abertura — {brl(totalContagem(contagemAbertura))}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <HistoricoCaixaDialog open={openHistorico} onOpenChange={setOpenHistorico} sessoes={historicoSessoes} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 flex items-center justify-between gap-2 bg-emerald-500/10 border-emerald-500/30">
        <div className="text-sm">
          <div className="font-bold flex items-center gap-1.5"><Unlock className="h-3.5 w-3.5 text-emerald-500" />Caixa aberto</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            Desde {new Date(caixa.aberto_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Em caixa: <b className="text-foreground">{mostrarCaixa ? brl(dinheiroCalculado) : "R$ ••••••"}</b>
            <button type="button" onClick={toggleMostrarCaixa} title={mostrarCaixa ? "Ocultar valor" : "Mostrar valor"} className="text-muted-foreground hover:text-foreground">
              {mostrarCaixa ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setOpenMov("reforco")}><ArrowUpCircle className="h-3.5 w-3.5 mr-1" />Reforço</Button>
          <Button size="sm" variant="outline" onClick={() => setOpenMov("sangria")}><ArrowDownCircle className="h-3.5 w-3.5 mr-1" />Sangria</Button>
          <Button size="sm" variant="destructive" onClick={() => setOpenFechamento(true)}><Lock className="h-3.5 w-3.5 mr-1" />Fechar</Button>
        </div>
      </Card>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="w-full">
          <TabsTrigger value="produtos" className="flex-1">Produtos</TabsTrigger>
          <TabsTrigger value="abertas" className="flex-1">Comandas abertas</TabsTrigger>
          <TabsTrigger value="fechadas" className="flex-1">Comandas fechadas</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos">
          {comandaAberta ? (
            <ComandaDialog
              comanda={comandaAberta}
              produtos={produtos}
              arena={arena}
              user={user}
              caixa={caixa}
              onClose={() => setComandaAberta(null)}
              onChanged={() => { void loadComandas(arena.id); void load(); }}
            />
          ) : (
            <div className="grid lg:grid-cols-[1fr_320px] gap-3 items-start">
              {/* Produtos — lado principal, estilo PDV */}
              <div className="space-y-2 min-w-0">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar produto por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>

                {categorias.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("todas")}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${categoriaFiltro === "todas" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                    >Todas</button>
                    {categorias.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoriaFiltro(c)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${categoriaFiltro === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                      >{c}</button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filtrados.map(p => {
                    const noCart = carrinho.find(i => i.produto.id === p.id)?.qtd;
                    const baixo = p.estoque_atual <= p.estoque_minimo;
                    const semEstoque = p.estoque_atual <= 0;
                    return (
                      <Card
                        key={p.id}
                        className={`p-2 cursor-pointer overflow-hidden relative transition-opacity ${baixo ? "border-rose-500/40" : ""} ${semEstoque ? "opacity-50" : "hover:border-primary/50"}`}
                        onClick={() => add(p)}
                      >
                        <div className="aspect-square rounded-md bg-muted mb-1.5 overflow-hidden flex items-center justify-center">
                          {p.foto_url ? (
                            <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                          )}
                        </div>
                        {noCart ? <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center">{noCart}</span> : null}
                        <div className="text-[11px] text-muted-foreground">{p.codigo} · {p.pdv_categorias?.nome}</div>
                        <div className="font-bold text-sm truncate leading-tight">{p.nome}</div>
                        <div className="text-emerald-500 font-bold text-sm">{brl(Number(p.preco))}</div>
                        <div className={`text-[11px] ${baixo ? "text-rose-500" : "text-muted-foreground"}`}>Est: {p.estoque_atual}</div>
                      </Card>
                    );
                  })}
                  {filtrados.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>}
                </div>
              </div>

              {/* Pedido — painel lateral fixo */}
              <Card className="p-3 lg:sticky lg:top-4 bg-card shadow-lg">
                <div className="flex items-center gap-2 mb-2"><ShoppingCart className="h-4 w-4" /><b>Pedido {carrinho.length > 0 ? `(${carrinho.length})` : ""}</b></div>
                {carrinho.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Toque em um produto para adicionar ao pedido.</p>
                ) : (
                  <>
                    <div className="max-h-[50vh] overflow-y-auto">
                      {carrinho.map(i => (
                        <div key={i.produto.id} className="flex items-center justify-between py-1 text-sm">
                          <span className="truncate flex-1">{i.produto.nome}</span>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => dec(i.produto.id)}><Minus className="h-3 w-3" /></Button>
                            <span className="w-6 text-center">{i.qtd}</span>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => add(i.produto)}><Plus className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del(i.produto.id)}><Trash className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t mt-2 pt-2 flex justify-between font-bold"><span>Total</span><span>{brl(total)}</span></div>
                    <Button onClick={() => setOpenPag(true)} className="w-full mt-2">Finalizar</Button>
                  </>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="abertas" className="space-y-3">
          <Dialog open={openNovaComanda} onOpenChange={setOpenNovaComanda}>
            <DialogContent>
              <DialogHeader><DialogTitle>Abrir comanda</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button type="button" variant={novaComandaTipo === "separada" ? "default" : "outline"} className="flex-1" onClick={() => setNovaComandaTipo("separada")}>Separada</Button>
                  <Button type="button" variant={novaComandaTipo === "grupo" ? "default" : "outline"} className="flex-1" onClick={() => setNovaComandaTipo("grupo")}>Grupo</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {novaComandaTipo === "separada" ? "Pagamento único ao fechar — ideal pra uma mesa/cliente só." : "Divide o valor total entre várias pessoas ao fechar."}
                </p>
                <div><Label>Nome / identificação</Label><Input value={novaComandaNome} onChange={e => setNovaComandaNome(e.target.value)} placeholder={novaComandaTipo === "grupo" ? "Ex: Grupo pelada sexta" : "Ex: Mesa 3"} /></div>
                <Button onClick={abrirNovaComanda} disabled={!novaComandaNome.trim()} className="w-full"><Receipt className="h-4 w-4 mr-1" />Abrir comanda</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setOpenNovaComanda(true)} className="w-full"><Receipt className="h-4 w-4 mr-1" />Abrir nova comanda</Button>

          {comandas.filter(c => c.status !== "fechada").length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comanda aberta.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
            {comandas.filter(c => c.status !== "fechada").map(c => (
              <Card key={c.id} className="aspect-square p-3 cursor-pointer flex flex-col justify-between hover:border-primary/50 transition-colors" onClick={() => abrirComanda(c)}>
                <div>
                  <Receipt className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <div className="font-bold text-sm leading-tight line-clamp-2">{c.nome}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.tipo === "grupo" ? "Grupo" : "Separada"}{c.num_pessoas ? ` · ${c.num_pessoas}p` : ""}</div>
                </div>
                {c.travada ? (
                  <span className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Aguardando</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Aberta</span>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="fechadas" className="space-y-3">
          {comandas.filter(c => c.status === "fechada").length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comanda fechada ainda.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
            {comandas.filter(c => c.status === "fechada").map(c => (
              <Card key={c.id} className="aspect-square p-3 cursor-pointer flex flex-col justify-between hover:border-primary/50 transition-colors" onClick={() => abrirComanda(c)}>
                <div>
                  <Receipt className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <div className="font-bold text-sm leading-tight line-clamp-2">{c.nome}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.tipo === "grupo" ? "Grupo" : "Separada"}{c.num_pessoas ? ` · ${c.num_pessoas}p` : ""}</div>
                </div>
                <span className="text-[11px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Fechada</span>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openPag} onOpenChange={setOpenPag}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento — {brl(total)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="cartao_debito">Débito</SelectItem><SelectItem value="cartao_credito">Crédito</SelectItem><SelectItem value="cashback">Cashback</SelectItem>
              </SelectContent></Select>
            </div>
            {forma === "dinheiro" && (
              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <Label>Valor recebido do cliente</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} />
                {valorRecebido !== "" && (
                  Number(valorRecebido) >= total ? (
                    <div className="text-sm font-semibold text-emerald-600">Troco: {brl(Number(valorRecebido) - total)}</div>
                  ) : (
                    <div className="text-sm font-semibold text-rose-500">Falta {brl(total - Number(valorRecebido))}</div>
                  )
                )}
              </div>
            )}
            {forma === "cashback" && (
              <div className="space-y-2">
                <div className="flex gap-2"><Input placeholder="Nome ou WhatsApp" value={buscaUser} onChange={e => setBuscaUser(e.target.value)} /><Button onClick={buscarUser}>Buscar</Button></div>
                {usuariosBusca.map(u => <div key={u.user_id} className="p-2 border rounded cursor-pointer hover:bg-muted" onClick={() => selecionarUser(u)}>{u.nome}</div>)}
                {userPag && <div className="p-2 bg-muted rounded text-sm"><b>{userPag.nome}</b> — saldo {brl(saldoUser)}{saldoUser < total && <div className="text-rose-500 text-xs">Saldo insuficiente</div>}</div>}
              </div>
            )}
            <Button onClick={finalizar} className="w-full" disabled={forma === "cashback" && (!userPag || saldoUser < total)}>Confirmar venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recibo} onOpenChange={o => !o && setRecibo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Venda registrada ✓</DialogTitle></DialogHeader>
          {recibo && <div className="space-y-2">
            {recibo.itens.map((i: any, k: number) => <div key={k} className="flex justify-between text-sm"><span>{i.qtd}x {i.produto.nome}</span><span>{brl(Number(i.produto.preco) * i.qtd)}</span></div>)}
            <div className="border-t pt-2 font-bold flex justify-between"><span>Total</span><span>{brl(recibo.total)}</span></div>
            <Button onClick={() => setRecibo(null)} className="w-full">Nova venda</Button>
          </div>}
        </DialogContent>
      </Dialog>

      {/* Sangria / Reforço */}
      <Dialog open={!!openMov} onOpenChange={o => !o && setOpenMov(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{openMov === "sangria" ? "Sangria (retirar dinheiro)" : "Reforço (adicionar dinheiro)"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={movValor || ""} onChange={e => setMovValor(+e.target.value)} /></div>
            <div><Label>Motivo (opcional)</Label><Input value={movDesc} onChange={e => setMovDesc(e.target.value)} placeholder={openMov === "sangria" ? "Ex: depósito no banco" : "Ex: troco adicional"} /></div>
            <Button onClick={registrarMovimento} disabled={movValor <= 0} className="w-full">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fechamento de caixa */}
      <Dialog open={openFechamento} onOpenChange={setOpenFechamento}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fechamento de caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Card className="p-3 space-y-1 text-sm">
              <div className="font-bold text-xs text-muted-foreground mb-1">RESUMO DO DIA</div>
              <div className="flex justify-between"><span>Abertura</span><span>{brl(caixa.valor_abertura)}</span></div>
              {Object.entries(resumoPorForma).map(([f, v]) => (
                <div key={f} className="flex justify-between"><span>Vendas — {FORMAS_LABEL[f] || f}</span><span>{brl(v as number)}</span></div>
              ))}
              {movimentos.filter(m => m.tipo === "reforco").length > 0 && <div className="flex justify-between"><span>Reforços</span><span>+{brl(movimentos.filter(m => m.tipo === "reforco").reduce((s, m) => s + Number(m.valor), 0))}</span></div>}
              {movimentos.filter(m => m.tipo === "sangria").length > 0 && <div className="flex justify-between"><span>Sangrias</span><span>-{brl(movimentos.filter(m => m.tipo === "sangria").reduce((s, m) => s + Number(m.valor), 0))}</span></div>}
              <div className="border-t pt-1 flex justify-between font-bold"><span>Dinheiro esperado na gaveta</span><span>{brl(dinheiroCalculado)}</span></div>
            </Card>
            <p className="text-xs text-muted-foreground">Agora conte o dinheiro físico que está na gaveta:</p>
            <ContagemCaixa value={contagemFechamento} onChange={setContagemFechamento} />
            {(() => {
              const contado = totalContagem(contagemFechamento);
              const dif = contado - dinheiroCalculado;
              return (
                <div className={`text-sm font-bold text-center rounded-lg p-2 ${dif === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                  {dif === 0 ? "Caixa bate certinho ✓" : dif > 0 ? `Sobra de ${brl(dif)}` : `Falta de ${brl(Math.abs(dif))}`}
                </div>
              );
            })()}
            <div><Label>Observações (opcional)</Label><Input value={obsFechamento} onChange={e => setObsFechamento(e.target.value)} /></div>
            <Button onClick={confirmarFechamento} variant="destructive" className="w-full">Confirmar fechamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resultado do fechamento */}
      <Dialog open={!!resultadoFechamento} onOpenChange={o => !o && setResultadoFechamento(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Caixa fechado ✓</DialogTitle></DialogHeader>
          {resultadoFechamento && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Esperado</span><span>{brl(resultadoFechamento.calculado)}</span></div>
              <div className="flex justify-between"><span>Contado</span><span>{brl(resultadoFechamento.contado)}</span></div>
              <div className={`flex justify-between font-bold ${resultadoFechamento.diferenca === 0 ? "text-emerald-500" : "text-rose-500"}`}>
                <span>Diferença</span><span>{brl(resultadoFechamento.diferenca)}</span>
              </div>
              <Button onClick={() => setResultadoFechamento(null)} className="w-full">OK</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <HistoricoCaixaDialog open={openHistorico} onOpenChange={setOpenHistorico} sessoes={historicoSessoes} />
      <div className="text-center"><Button variant="ghost" size="sm" onClick={verHistorico}><History className="h-4 w-4 mr-2" />Histórico de caixas</Button></div>
    </div>
  );
}

function HistoricoCaixaDialog({ open, onOpenChange, sessoes }: { open: boolean; onOpenChange: (v: boolean) => void; sessoes: any[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico de caixas</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {sessoes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum caixa fechado ainda.</p>}
          {sessoes.map(s => (
            <Card key={s.id} className="p-2.5 text-sm">
              <div className="flex justify-between font-bold">
                <span>{new Date(s.aberto_em).toLocaleDateString("pt-BR")}</span>
                <span className={Number(s.diferenca) === 0 ? "text-emerald-500" : "text-rose-500"}>
                  {Number(s.diferenca) === 0 ? "Bateu certinho" : `Dif. ${brl(s.diferenca)}`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(s.aberto_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às {s.fechado_em ? new Date(s.fechado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                {" · "}Abertura {brl(s.valor_abertura)} · Fechamento {brl(s.valor_contado_fechamento)}
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
