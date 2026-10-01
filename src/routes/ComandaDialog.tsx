import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash2, CheckCircle2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

function brl(n: number) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const FORMAS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Débito" },
  { value: "cartao_credito", label: "Crédito" },
];

interface Props {
  comanda: any;
  produtos: any[];
  arena: any;
  user: any;
  caixa: any;
  onClose: () => void;
  onChanged: () => void;
}

export function ComandaDialog({ comanda: comandaInicial, produtos, arena, user, caixa, onClose, onChanged }: Props) {
  const [comanda, setComanda] = useState(comandaInicial);
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [novoParticipante, setNovoParticipante] = useState("");
  const [numPessoasInput, setNumPessoasInput] = useState("");
  const [dividindo, setDividindo] = useState(false);
  const [forma, setForma] = useState("dinheiro");
  const [salvando, setSalvando] = useState(false);

  const carregarItens = async () => {
    const { data } = await supabase.from("pdv_comanda_itens").select("*, pdv_produtos(nome)").eq("comanda_id", comanda.id).order("criado_em");
    setItens(data ?? []);
  };
  const carregarParticipantes = async () => {
    const { data } = await supabase.from("pdv_comanda_participantes").select("*").eq("comanda_id", comanda.id).order("pago").order("criado_em");
    setParticipantes(data ?? []);
  };
  useEffect(() => { void carregarItens(); void carregarParticipantes(); }, [comanda.id]);

  const total = useMemo(() => itens.reduce((s, i) => s + Number(i.subtotal), 0), [itens]);
  const cota = comanda.num_pessoas ? total / comanda.num_pessoas : 0;
  const pagoSum = participantes.filter(p => p.pago).length * cota;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase(); if (!q) return produtos;
    return produtos.filter((p: any) => p.nome.toLowerCase().includes(q) || String(p.codigo) === q);
  }, [produtos, busca]);

  const addItem = async (produto: any) => {
    if (produto.estoque_atual <= 0) { toast.error("Sem estoque"); return; }
    const existente = itens.find(i => i.produto_id === produto.id);
    if (existente) {
      await supabase.from("pdv_comanda_itens").update({ quantidade: existente.quantidade + 1, subtotal: Number(produto.preco) * (existente.quantidade + 1) } as never).eq("id", existente.id);
    } else {
      await supabase.from("pdv_comanda_itens").insert({ comanda_id: comanda.id, produto_id: produto.id, quantidade: 1, preco_unitario: produto.preco, subtotal: Number(produto.preco) } as never);
    }
    void carregarItens();
  };

  const decItem = async (item: any) => {
    if (item.quantidade <= 1) { await supabase.from("pdv_comanda_itens").delete().eq("id", item.id); }
    else { await supabase.from("pdv_comanda_itens").update({ quantidade: item.quantidade - 1, subtotal: Number(item.preco_unitario) * (item.quantidade - 1) } as never).eq("id", item.id); }
    void carregarItens();
  };

  const removerItem = async (item: any) => { await supabase.from("pdv_comanda_itens").delete().eq("id", item.id); void carregarItens(); };

  const criarVendaFinal = async (formaPagamento: string): Promise<boolean> => {
    if (!arena || !user || !caixa || itens.length === 0) return false;
    const { data: venda, error } = await supabase.from("pdv_vendas").insert({
      arena_id: arena.id, usuario_id: null, total, forma_pagamento: formaPagamento, cashback_utilizado: 0, operador_id: user.id,
    } as never).select().single();
    if (error || !venda) { toast.error(error?.message || "Erro ao finalizar comanda (verifique o estoque)"); return false; }
    const itensVenda = itens.map(i => ({ venda_id: (venda as any).id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal }));
    const { error: e2 } = await supabase.from("pdv_itens_venda").insert(itensVenda as never);
    if (e2) { toast.error(e2.message); return false; }
    await supabase.from("caixa_movimentos").insert({
      caixa_sessao_id: caixa.id, arena_id: arena.id, tipo: "venda", forma_pagamento: formaPagamento, valor: total,
      venda_id: (venda as any).id, operador_id: user.id, descricao: `Comanda "${comanda.nome}"`,
    } as never);
    await supabase.from("pdv_comandas").update({
      status: "fechada", baixa_dada: true, forma_pagamento: formaPagamento, venda_id: (venda as any).id,
      caixa_sessao_id: caixa.id, operador_fechamento_id: user.id, fechada_em: new Date().toISOString(),
    } as never).eq("id", comanda.id);
    return true;
  };

  const finalizarSeparada = async () => {
    if (!caixa) { toast.error("Abra o caixa antes de finalizar"); return; }
    setSalvando(true);
    const ok = await criarVendaFinal(forma);
    setSalvando(false);
    if (ok) { toast.success("Comanda fechada"); onChanged(); onClose(); }
  };

  const iniciarDivisao = async () => {
    const n = parseInt(numPessoasInput, 10);
    if (!n || n < 1) { toast.error("Informe quantas pessoas estão no grupo"); return; }
    const { error } = await supabase.from("pdv_comandas").update({ travada: true, num_pessoas: n } as never).eq("id", comanda.id);
    if (error) { toast.error(error.message); return; }
    setComanda({ ...comanda, travada: true, num_pessoas: n });
    setDividindo(false);
  };

  const addParticipante = async () => {
    if (!novoParticipante.trim()) return;
    if (participantes.length >= (comanda.num_pessoas || 0)) { toast.error(`Já tem ${comanda.num_pessoas} pessoas adicionadas`); return; }
    await supabase.from("pdv_comanda_participantes").insert({ comanda_id: comanda.id, nome: novoParticipante.trim() } as never);
    setNovoParticipante("");
    void carregarParticipantes();
  };

  const togglePago = async (p: any) => {
    await supabase.from("pdv_comanda_participantes").update({ pago: !p.pago, pago_em: !p.pago ? new Date().toISOString() : null } as never).eq("id", p.id);
    void carregarParticipantes();
  };

  const removerParticipante = async (id: string) => { await supabase.from("pdv_comanda_participantes").delete().eq("id", id); void carregarParticipantes(); };

  const todosPagos = comanda.num_pessoas > 0 && participantes.length === comanda.num_pessoas && participantes.every(p => p.pago);

  const confirmarBaixaGrupo = async () => {
    if (!caixa) { toast.error("Abra o caixa antes de finalizar"); return; }
    setSalvando(true);
    const ok = await criarVendaFinal("dividido");
    setSalvando(false);
    if (ok) { toast.success("Comanda fechada — todos pagaram"); onChanged(); onClose(); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
        <DialogHeader><DialogTitle>{comanda.nome} {comanda.tipo === "grupo" ? "(grupo)" : "(separada)"}</DialogTitle></DialogHeader>

        {comanda.status === "fechada" ? (
          <div className="rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-bold text-center p-4 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />Comanda fechada — {brl(total)}
          </div>
        ) : (
          <div className="space-y-3">
            {!comanda.travada && (
              <>
                <Input placeholder="Buscar produto por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                  {filtrados.map((p: any) => (
                    <button key={p.id} type="button" onClick={() => addItem(p)} className="text-left border border-border rounded-lg p-1.5 hover:bg-muted">
                      <div className="text-[11px] font-bold truncate">{p.nome}</div>
                      <div className="text-[11px] text-emerald-500">{brl(Number(p.preco))}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="space-y-1">
              {itens.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum item lançado ainda.</p>}
              {itens.map(i => (
                <div key={i.id} className="flex items-center justify-between text-sm py-1">
                  <span className="truncate flex-1">{i.pdv_produtos?.nome}</span>
                  {!comanda.travada ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => decItem(i)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center">{i.quantidade}</span>
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => addItem(produtos.find((p: any) => p.id === i.produto_id) || { id: i.produto_id, preco: i.preco_unitario, estoque_atual: 0 })}><Plus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerItem(i)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{i.quantidade}x</span>
                  )}
                  <span className="w-16 text-right">{brl(i.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>Total</span><span>{brl(total)}</span>
            </div>

            {comanda.tipo === "separada" && (
              <div className="space-y-2 pt-1">
                <div><Label>Forma de pagamento</Label><Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={finalizarSeparada} disabled={itens.length === 0 || salvando} className="w-full"><Wallet className="h-4 w-4 mr-1" />Finalizar e cobrar — {brl(total)}</Button>
              </div>
            )}

            {comanda.tipo === "grupo" && !comanda.travada && (
              <div className="space-y-2 pt-1">
                {!dividindo ? (
                  <Button onClick={() => setDividindo(true)} disabled={itens.length === 0} className="w-full"><Users className="h-4 w-4 mr-1" />Finalizar e dividir a conta</Button>
                ) : (
                  <div className="flex gap-2">
                    <Input type="number" min={1} placeholder="Quantas pessoas no grupo?" value={numPessoasInput} onChange={e => setNumPessoasInput(e.target.value)} />
                    <Button onClick={iniciarDivisao}>Dividir</Button>
                  </div>
                )}
              </div>
            )}

            {comanda.tipo === "grupo" && comanda.travada && (
              <div className="space-y-3 pt-1">
                <Card className="p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Total</span><b>{brl(total)}</b></div>
                  <div className="flex justify-between"><span>{comanda.num_pessoas} pessoas · valor individual</span><b>{brl(cota)}</b></div>
                  <div className="border-t border-border pt-1 flex justify-between"><span className="text-emerald-500">Pago</span><span className="text-emerald-500 font-bold">{brl(pagoSum)}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500">Restante</span><span className="text-amber-500 font-bold">{brl(total - pagoSum)}</span></div>
                </Card>
                {participantes.length < comanda.num_pessoas && (
                  <div className="flex gap-2">
                    <Input placeholder="Nome do participante" value={novoParticipante} onChange={e => setNovoParticipante(e.target.value)} onKeyDown={e => e.key === "Enter" && addParticipante()} />
                    <Button type="button" onClick={addParticipante}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
                <div className="space-y-1.5">
                  {participantes.map(p => (
                    <div key={p.id} className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${p.pago ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <Checkbox checked={p.pago} onCheckedChange={() => togglePago(p)} />
                        <span className={p.pago ? "" : "font-bold"}>{p.nome}</span>
                      </label>
                      <span className="text-xs text-muted-foreground">{brl(cota)}</span>
                      {!p.pago && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerParticipante(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  ))}
                </div>
                <Button onClick={confirmarBaixaGrupo} disabled={!todosPagos || salvando} className="w-full">
                  {todosPagos ? `Confirmar baixa — ${brl(total)}` : `Faltam ${comanda.num_pessoas - participantes.filter(p => p.pago).length} pagar`}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
