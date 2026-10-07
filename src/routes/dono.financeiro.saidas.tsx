import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { brl, carregarDespesasPeriodo, FORMAS_PAGAMENTO, formaLabel, hojeISO, inicioMesISO } from "@/lib/financeiro";

export const Route = createFileRoute("/dono/financeiro/saidas")({ component: SaidasPage });

const SEM = "nenhum";
const CATEGORIAS = ["Estoque / mercadoria", "Manutenção", "Aluguel", "Energia / água", "Salários", "Marketing", "Impostos", "Outros"];
// Formas em que o pagamento não é na hora (tem vencimento e baixa depois)
const FORMAS_A_PRAZO = ["cartao_credito", "boleto"];

type Linha = { key: number; descricao: string; quantidade: number; valor_unitario: number; fornecedor_item_id: string | null; produto_id: string; vincular_estoque: boolean };
const novaLinha = (key: number): Linha => ({ key, descricao: "", quantidade: 1, valor_unitario: 0, fornecedor_item_id: null, produto_id: SEM, vincular_estoque: false });
const FORM_VAZIO = () => ({
  fornecedor_id: SEM, descricao: "", categoria: CATEGORIAS[0], forma_pagamento: "pix", data_compra: hojeISO(),
  parcelado: false, num_parcelas: 2, primeiro_vencimento: hojeISO(), observacao: "", valor_total: 0,
});

function SaidasPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [ini, setIni] = useState(inicioMesISO);
  const [fim, setFim] = useState(hojeISO);
  const [desp, setDesp] = useState<{ parcelas: any[]; despesasAntigas: any[]; total: number; pagas: number; aPagar: number }>({ parcelas: [], despesasAntigas: [], total: 0, pagas: 0, aPagar: 0 });
  const [compras, setCompras] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [fornItens, setFornItens] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<any>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(FORM_VAZIO());
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    setDesp(await carregarDespesasPeriodo(a.id, ini, fim));
    const { data: c } = await supabase.from("saidas")
      .select("*, fornecedores(nome), saida_parcelas(*), saida_itens(*)")
      .eq("arena_id", a.id).order("data_compra", { ascending: false }).order("criado_em", { ascending: false }).limit(100);
    setCompras(c ?? []);
    const { data: f } = await supabase.from("fornecedores").select("id,nome").eq("arena_id", a.id).eq("ativo", true).order("nome");
    setFornecedores(f ?? []);
    const { data: fi } = await supabase.from("fornecedor_itens").select("*").eq("arena_id", a.id).eq("ativo", true).order("nome");
    setFornItens(fi ?? []);
    const { data: p } = await supabase.from("pdv_produtos").select("id,nome,codigo").eq("arena_id", a.id).order("nome");
    setProdutos(p ?? []);
  };
  useEffect(() => { void load(); }, [user?.id, ini, fim]);

  const aPrazo = FORMAS_A_PRAZO.includes(form.forma_pagamento);
  const credito = form.forma_pagamento === "cartao_credito";
  const itensDoFornecedor = useMemo(() => fornItens.filter(i => i.fornecedor_id === form.fornecedor_id), [fornItens, form.fornecedor_id]);
  const linhasValidas = linhas.filter(l => l.descricao.trim() && l.quantidade > 0);
  const totalCalculado = linhasValidas.length > 0
    ? linhasValidas.reduce((s, l) => s + l.quantidade * l.valor_unitario, 0)
    : Number(form.valor_total) || 0;
  const nParcelas = credito && form.parcelado ? Math.max(2, Math.trunc(Number(form.num_parcelas) || 2)) : 1;

  const abrirNova = () => { setForm(FORM_VAZIO()); setLinhas([]); setOpen(true); };

  const setLinha = (key: number, patch: Partial<Linha>) => setLinhas(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const escolherItemFornecedor = (key: number, itemId: string) => {
    if (itemId === SEM) { setLinha(key, { fornecedor_item_id: null }); return; }
    const it = fornItens.find(i => i.id === itemId);
    if (!it) return;
    setLinha(key, {
      fornecedor_item_id: it.id, descricao: it.nome, valor_unitario: Number(it.preco_referencia) || 0,
      produto_id: it.produto_id ?? SEM, vincular_estoque: !!it.produto_id,
    });
  };

  const salvar = async () => {
    if (!arena || !form.descricao.trim() || totalCalculado <= 0) return;
    setSalvando(true);
    const itens = linhasValidas.map(l => ({
      descricao: l.descricao.trim(), quantidade: Math.trunc(l.quantidade), valor_unitario: l.valor_unitario,
      fornecedor_item_id: l.fornecedor_item_id, produto_id: l.produto_id === SEM ? null : l.produto_id,
      vincular_estoque: l.produto_id !== SEM && l.vincular_estoque,
    }));
    const { error } = await supabase.rpc("criar_saida", {
      _arena_id: arena.id, _fornecedor_id: form.fornecedor_id === SEM ? null : form.fornecedor_id,
      _descricao: form.descricao.trim(), _categoria: form.categoria, _forma_pagamento: form.forma_pagamento,
      _data_compra: form.data_compra, _parcelado: credito && form.parcelado, _num_parcelas: nParcelas,
      _primeiro_vencimento: aPrazo ? form.primeiro_vencimento : form.data_compra,
      _ja_pago: !aPrazo, _observacao: form.observacao || null, _valor_total: totalCalculado, _itens: itens,
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    const entrouEstoque = itens.some(i => i.vincular_estoque);
    toast.success(entrouEstoque ? "Saída registrada e estoque atualizado" : "Saída registrada");
    setOpen(false); void load();
  };

  const pagar = async (parcelaId: string, pago: boolean) => {
    const { error } = await supabase.rpc("pagar_parcela_saida", { _parcela_id: parcelaId, _pago: pago });
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const { error } = await supabase.rpc("excluir_saida", { _saida_id: excluir.id });
    setExcluir(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saída excluída");
    void load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const parcelasOrdenadas = [...desp.parcelas].sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
  const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e => setIni(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Saídas no período</div><div className="text-rose-500 font-bold">{brl(desp.total)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Já pagas</div><div className="font-bold">{brl(desp.pagas)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">A pagar</div><div className="text-amber-500 font-bold">{brl(desp.aPagar)}</div></Card>
      </div>

      <Button onClick={abrirNova} className="w-full"><Plus className="h-4 w-4 mr-1" />Nova saída</Button>

      <Tabs defaultValue="parcelas">
        <TabsList className="w-full">
          <TabsTrigger value="parcelas" className="flex-1">Vencimentos do período</TabsTrigger>
          <TabsTrigger value="compras" className="flex-1">Compras</TabsTrigger>
        </TabsList>

        {/* Parcelas que vencem no período — é o que entra nas despesas do Financeiro */}
        <TabsContent value="parcelas" className="space-y-2">
          {parcelasOrdenadas.map(p => (
            <Card key={p.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{p.saidas?.descricao}</div>
                <div className="text-xs text-muted-foreground">
                  Vence {fmtData(p.vencimento)} · {p.saidas?.fornecedores?.nome ? p.saidas.fornecedores.nome + " · " : ""}{p.total_parcelas > 1 ? `parcela ${p.numero}/${p.total_parcelas}` : formaLabel(p.saidas?.forma_pagamento)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="font-bold text-rose-500">-{brl(Number(p.valor))}</div>
                {p.pago
                  ? <Button size="sm" variant="ghost" className="text-emerald-500" onClick={() => pagar(p.id, false)}><CheckCircle2 className="h-4 w-4 mr-1" />Paga</Button>
                  : <Button size="sm" variant="outline" onClick={() => pagar(p.id, true)}>Marcar paga</Button>}
              </div>
            </Card>
          ))}
          {desp.despesasAntigas.map(l => (
            <Card key={l.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="font-bold text-sm truncate">{l.descricao}</div><div className="text-xs text-muted-foreground">{fmtData(l.data_lancamento)} · lançamento manual antigo</div></div>
              <div className="font-bold text-rose-500">-{brl(Number(l.valor))}</div>
            </Card>
          ))}
          {parcelasOrdenadas.length === 0 && desp.despesasAntigas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nada vencendo neste período.</p>}
        </TabsContent>

        {/* Compras (visão por compra, com andamento das parcelas) */}
        <TabsContent value="compras" className="space-y-2">
          {compras.map(c => {
            const ps = [...(c.saida_parcelas ?? [])].sort((a: any, b: any) => a.numero - b.numero);
            const pagas = ps.filter((p: any) => p.pago).length;
            const finalizada = ps.length > 0 && pagas === ps.length;
            const aberta = expandida === c.id;
            return (
              <Card key={c.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-w-0 text-left flex-1" onClick={() => setExpandida(aberta ? null : c.id)}>
                    <div className="font-bold text-sm truncate">{c.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtData(c.data_compra)} · {c.fornecedores?.nome ? c.fornecedores.nome + " · " : ""}{formaLabel(c.forma_pagamento)}{c.num_parcelas > 1 ? ` em ${c.num_parcelas}x` : ""}
                    </div>
                    <div className={`text-[11px] mt-0.5 font-bold ${finalizada ? "text-emerald-500" : "text-amber-500"}`}>
                      {finalizada ? "Finalizada" : `${pagas}/${ps.length} parcela${ps.length > 1 ? "s" : ""} paga${pagas === 1 ? "" : "s"}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="font-bold text-rose-500">{brl(Number(c.valor_total))}</div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpandida(aberta ? null : c.id)}>{aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setExcluir(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {aberta && (
                  <div className="space-y-1.5 border-t pt-2">
                    {(c.saida_itens ?? []).length > 0 && (
                      <div className="text-xs space-y-0.5">
                        {c.saida_itens.map((i: any) => (
                          <div key={i.id} className="flex justify-between"><span>{i.quantidade}x {i.descricao}{i.vincular_estoque && <span className="text-emerald-500"> · entrou no estoque</span>}</span><span>{brl(Number(i.subtotal))}</span></div>
                        ))}
                      </div>
                    )}
                    {c.observacao && <div className="text-xs italic text-muted-foreground">{c.observacao}</div>}
                    {ps.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{p.total_parcelas > 1 ? `${p.numero}/${p.total_parcelas}` : "Pagamento"} · vence {fmtData(p.vencimento)}</span>
                        <span className="flex items-center gap-2">
                          {brl(Number(p.valor))}
                          {p.pago
                            ? <Button size="sm" variant="ghost" className="h-7 text-emerald-500" onClick={() => pagar(p.id, false)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Paga</Button>
                            : <Button size="sm" variant="outline" className="h-7" onClick={() => pagar(p.id, true)}>Marcar paga</Button>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {compras.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma compra registrada.</p>}
        </TabsContent>
      </Tabs>

      {/* Nova saída */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova saída</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fornecedor</Label>
              <Select value={form.fornecedor_id} onValueChange={v => { setForm({ ...form, fornecedor_id: v }); setLinhas(ls => ls.map(l => ({ ...l, fornecedor_item_id: null }))); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>Sem fornecedor</SelectItem>
                  {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Compra de bebidas" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent></Select>
              </div>
              <div><Label>Data da compra</Label><Input type="date" value={form.data_compra} onChange={e => setForm({ ...form, data_compra: e.target.value })} /></div>
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v, parcelado: v === "cartao_credito" ? form.parcelado : false })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FORMAS_PAGAMENTO).filter(([k]) => k !== "cashback").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {aPrazo && (
              <Card className="p-3 space-y-2 bg-muted/30">
                {credito && (
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Compra parcelada?</Label>
                    <Switch checked={form.parcelado} onCheckedChange={v => setForm({ ...form, parcelado: v })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {credito && form.parcelado && (
                    <div><Label>Nº de parcelas</Label><Input type="number" min={2} max={48} value={form.num_parcelas} onChange={e => setForm({ ...form, num_parcelas: +e.target.value })} /></div>
                  )}
                  <div className={credito && form.parcelado ? "" : "col-span-2"}>
                    <Label>{nParcelas > 1 ? "Vencimento da 1ª parcela" : "Data de vencimento"}</Label>
                    <Input type="date" value={form.primeiro_vencimento} onChange={e => setForm({ ...form, primeiro_vencimento: e.target.value })} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {nParcelas > 1
                    ? `${nParcelas}x de ${brl(totalCalculado / nParcelas)}, uma por mês. A compra só fica finalizada quando a última parcela for marcada como paga.`
                    : "Fica como \"a pagar\" até você marcar o pagamento."}
                </p>
              </Card>
            )}

            {/* Itens da compra (opcional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Itens da compra (opcional)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setLinhas(ls => [...ls, novaLinha(Date.now() + ls.length)])}><Plus className="h-3 w-3 mr-1" />Item</Button>
              </div>
              {linhas.map(l => (
                <Card key={l.key} className="p-2.5 space-y-2">
                  {itensDoFornecedor.length > 0 && (
                    <Select value={l.fornecedor_item_id ?? SEM} onValueChange={v => escolherItemFornecedor(l.key, v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Item do fornecedor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM}>Digitar manualmente</SelectItem>
                        {itensDoFornecedor.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Input placeholder="Descrição do item" value={l.descricao} onChange={e => setLinha(l.key, { descricao: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[11px]">Quantidade</Label><Input type="number" min={1} value={l.quantidade} onChange={e => setLinha(l.key, { quantidade: +e.target.value })} /></div>
                    <div><Label className="text-[11px]">Valor unitário</Label><Input type="number" step="0.01" value={l.valor_unitario || ""} onChange={e => setLinha(l.key, { valor_unitario: +e.target.value })} /></div>
                  </div>
                  <Select value={l.produto_id} onValueChange={v => setLinha(l.key, { produto_id: v, vincular_estoque: v !== SEM })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM}>Não vincular ao estoque</SelectItem>
                      {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {l.produto_id !== SEM && (
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={l.vincular_estoque} onCheckedChange={v => setLinha(l.key, { vincular_estoque: v === true })} />
                      Dar entrada de {l.quantidade || 0} un. no estoque e atualizar o preço de custo
                    </label>
                  )}
                  <div className="text-right"><Button type="button" size="sm" variant="ghost" className="text-rose-500 h-7" onClick={() => setLinhas(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="h-3 w-3 mr-1" />Remover</Button></div>
                </Card>
              ))}
              {linhasValidas.length === 0 && (
                <div><Label>Valor total</Label><Input type="number" step="0.01" value={form.valor_total || ""} onChange={e => setForm({ ...form, valor_total: +e.target.value })} /></div>
              )}
            </div>

            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm"><span>Total da saída</span><b className="text-rose-500">{brl(totalCalculado)}</b></div>
            <Button onClick={salvar} disabled={salvando || !form.descricao.trim() || totalCalculado <= 0} className="w-full">{salvando ? "Salvando..." : "Registrar saída"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={o => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{excluir?.descricao}"?</AlertDialogTitle>
            <AlertDialogDescription>A compra e todas as parcelas saem do financeiro. Se algum item deu entrada no estoque, essa quantidade é retirada de volta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-rose-600 hover:bg-rose-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
