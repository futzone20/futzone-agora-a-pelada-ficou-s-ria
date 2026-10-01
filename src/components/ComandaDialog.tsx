import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash2, CheckCircle2, Users, Wallet, ImageOff, ArrowLeft, Receipt, Banknote } from "lucide-react";
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
  const [novoParticipanteValor, setNovoParticipanteValor] = useState("");
  const [numPessoasInput, setNumPessoasInput] = useState("");
  const [dividindo, setDividindo] = useState(false);
  const [forma, setForma] = useState("dinheiro");
  const [salvando, setSalvando] = useState(false);
  const [valorRecebido, setValorRecebido] = useState("");
  const [rascunhoValores, setRascunhoValores] = useState<Record<string, string>>({});
  const [trocoAberto, setTrocoAberto] = useState<Record<string, boolean>>({});
  const [trocoValor, setTrocoValor] = useState<Record<string, string>>({});

  // Recarrega a comanda do banco (não só itens/participantes): sem isso, se
  // o dono dividir a conta, sair de tela e reabrir essa comanda a partir de
  // um snapshot antigo (a lista de comandas aberta antes da divisão), o
  // diálogo reiniciava do zero como se "travada"/"num_pessoas" nunca
  // tivessem sido definidos — fazendo parecer que ninguém tinha pago ainda.
  const carregarComanda = async () => {
    const { data } = await supabase.from("pdv_comandas").select("*").eq("id", comanda.id).maybeSingle();
    if (data) setComanda(data);
  };
  const carregarItens = async () => {
    const { data } = await supabase.from("pdv_comanda_itens").select("*, pdv_produtos(nome)").eq("comanda_id", comanda.id).order("criado_em");
    setItens(data ?? []);
  };
  const carregarParticipantes = async () => {
    const { data } = await supabase.from("pdv_comanda_participantes").select("*").eq("comanda_id", comanda.id).order("pago").order("criado_em");
    setParticipantes(data ?? []);
  };
  useEffect(() => { void carregarComanda(); void carregarItens(); void carregarParticipantes(); }, [comanda.id]);

  const total = useMemo(() => itens.reduce((s, i) => s + Number(i.subtotal), 0), [itens]);
  const cota = comanda.num_pessoas ? total / comanda.num_pessoas : 0;

  // Quem já pagou tem o valor travado (persistido no momento do pagamento —
  // ver togglePago). O que falta pagar nunca é um valor fixo: é sempre o
  // que ainda resta dividido entre quem falta, recalculado a cada pagamento
  // ou edição manual — assim nunca sobra nem falta e ninguém "esquece" de
  // recalcular quando um amigo paga mais ou menos que a parte igual.
  const pagoSum = participantes.filter(p => p.pago).reduce((s, p) => s + Number(p.valor_cota ?? cota), 0);
  const restante = Math.max(0, total - pagoSum);
  const naoPagos = participantes.filter(p => !p.pago);
  const naoPagosManual = naoPagos.filter(p => p.valor_cota != null);
  const somaManualNaoPagos = naoPagosManual.reduce((s, p) => s + Number(p.valor_cota), 0);
  const naoPagosAuto = naoPagos.filter(p => p.valor_cota == null);
  const restanteAuto = Math.max(0, restante - somaManualNaoPagos);
  const valorAutoCada = naoPagosAuto.length > 0 ? restanteAuto / naoPagosAuto.length : 0;

  // Valor "efetivo" de cada participante: travado se já pago, manual se
  // editado, senão a divisão automática do que resta entre quem falta.
  const valorDe = (p: any) => {
    if (p.valor_cota != null) return Number(p.valor_cota);
    if (p.pago) return cota;
    return valorAutoCada;
  };
  const somaTotalParticipantes = pagoSum + naoPagos.reduce((s, p) => s + valorDe(p), 0);

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
    onChanged(); // a lista de comandas (fora deste diálogo) precisa saber que travou, senão reabre do zero
  };

  const addParticipante = async () => {
    if (!novoParticipante.trim()) return;
    if (participantes.length >= (comanda.num_pessoas || 0)) { toast.error(`Já tem ${comanda.num_pessoas} pessoas adicionadas`); return; }
    // Sem valor digitado = automático (divide o que resta); só trava um
    // valor fixo se o dono realmente digitou um aqui.
    const valor = novoParticipanteValor.trim() ? Number(novoParticipanteValor) : null;
    const { error } = await supabase.from("pdv_comanda_participantes").insert({ comanda_id: comanda.id, nome: novoParticipante.trim(), valor_cota: valor } as never);
    if (error) { toast.error(error.message); return; }
    setNovoParticipante(""); setNovoParticipanteValor("");
    void carregarParticipantes();
  };

  const togglePago = async (p: any) => {
    const marcandoComoPago = !p.pago;
    const payload: Record<string, any> = { pago: marcandoComoPago, pago_em: marcandoComoPago ? new Date().toISOString() : null };
    // Trava o valor no exato momento em que marca como pago — senão, ao
    // marcar o próximo como pago, o valor dele recalcularia e o histórico
    // do que essa pessoa realmente pagou mudaria sozinho depois.
    if (marcandoComoPago && p.valor_cota == null) payload.valor_cota = Number(valorDe(p).toFixed(2));
    const { error } = await supabase.from("pdv_comanda_participantes").update(payload as never).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    void carregarParticipantes();
  };

  // Permite ajustar o valor de cada um a qualquer momento (antes de marcar
  // como pago) — um amigo pode cobrir mais, outro menos. Nunca deixa passar
  // do que ainda falta (ninguém pode "pagar" mais do que resta da conta) —
  // o resto sempre recalcula sozinho entre quem ainda não editou o valor.
  const atualizarValorParticipante = async (p: any, novoValor: string) => {
    if (novoValor.trim() === "") {
      // Campo limpo = volta a ser automático (divide o que resta).
      const { error } = await supabase.from("pdv_comanda_participantes").update({ valor_cota: null } as never).eq("id", p.id);
      if (error) { toast.error(error.message); return; }
      void carregarParticipantes();
      return;
    }
    let valor = Number(novoValor);
    if (Number.isNaN(valor) || valor < 0) { toast.error("Valor inválido"); void carregarParticipantes(); return; }
    // O teto é o que resta, descontando o que outras pessoas (que também
    // não pagaram ainda) já tiverem com valor manual travado.
    const outrosManuaisSoma = naoPagosManual.filter(x => x.id !== p.id).reduce((s, x) => s + Number(x.valor_cota), 0);
    const teto = Math.max(0, restante - outrosManuaisSoma);
    if (valor > teto + 0.009) {
      toast.error(`Não dá pra cobrar mais do que falta (${brl(teto)})`);
      valor = Number(teto.toFixed(2));
    }
    const { error } = await supabase.from("pdv_comanda_participantes").update({ valor_cota: valor } as never).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    void carregarParticipantes();
  };

  const removerParticipante = async (id: string) => {
    const { error } = await supabase.from("pdv_comanda_participantes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void carregarParticipantes();
  };

  const todosPagos = comanda.num_pessoas > 0 && participantes.length === comanda.num_pessoas && participantes.every(p => p.pago);
  const diferencaSoma = total - somaTotalParticipantes;

  const confirmarBaixaGrupo = async () => {
    if (!caixa) { toast.error("Abra o caixa antes de finalizar"); return; }
    setSalvando(true);
    const ok = await criarVendaFinal("dividido");
    setSalvando(false);
    if (ok) { toast.success("Comanda fechada — todos pagaram"); onChanged(); onClose(); }
  };

  const cabecalho = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
      <div>
        <div className="font-bold flex items-center gap-1.5"><Receipt className="h-4 w-4 text-muted-foreground" />{comanda.nome}</div>
        <div className="text-xs text-muted-foreground">{comanda.tipo === "grupo" ? "Grupo" : "Separada"}{comanda.num_pessoas ? ` · ${comanda.num_pessoas} pessoas` : ""}</div>
      </div>
    </div>
  );

  if (comanda.status === "fechada") {
    return (
      <div className="space-y-3">
        {cabecalho}
        <div className="rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-bold text-center p-4 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />Comanda fechada — {brl(total)}
        </div>
        <div className="space-y-1">
          {itens.map(i => (
            <div key={i.id} className="flex items-center justify-between text-sm py-1">
              <span className="truncate flex-1">{i.quantidade}x {i.pdv_produtos?.nome}</span>
              <span className="w-16 text-right">{brl(i.subtotal)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cabecalho}
      <div className="grid lg:grid-cols-[1fr_320px] gap-3 items-start">
        {/* Produtos — mesmo estilo de grade com foto da tela principal do PDV */}
        <div className="space-y-2 min-w-0">
          {!comanda.travada ? (
            <>
              <Input placeholder="Buscar produto por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {filtrados.map((p: any) => (
                  <Card key={p.id} className="p-2 cursor-pointer overflow-hidden hover:border-primary/50" onClick={() => addItem(p)}>
                    <div className="aspect-square rounded-md bg-muted mb-1.5 overflow-hidden flex items-center justify-center">
                      {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" /> : <ImageOff className="h-6 w-6 text-muted-foreground/50" />}
                    </div>
                    <div className="font-bold text-sm truncate leading-tight">{p.nome}</div>
                    <div className="text-emerald-500 font-bold text-sm">{brl(Number(p.preco))}</div>
                  </Card>
                ))}
                {filtrados.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>}
              </div>
            </>
          ) : (
            <Card className="p-4 text-center text-sm text-muted-foreground">Comanda travada para divisão — os itens não podem mais ser alterados.</Card>
          )}
        </div>

        {/* Painel fixo — itens lançados e fechamento da comanda */}
        <Card className="p-3 lg:sticky lg:top-4 bg-card shadow-lg space-y-3">
          <div className="flex items-center gap-2"><Receipt className="h-4 w-4" /><b>Comanda {itens.length > 0 ? `(${itens.length})` : ""}</b></div>

          <div className="space-y-1 max-h-[35vh] overflow-y-auto">
            {itens.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum item lançado ainda.</p>}
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
              <Button onClick={finalizarSeparada} disabled={itens.length === 0 || salvando} className="w-full"><Wallet className="h-4 w-4 mr-1" />Finalizar e cobrar — {brl(total)}</Button>
            </div>
          )}

          {comanda.tipo === "grupo" && !comanda.travada && (
            <div className="space-y-2 pt-1">
              {!dividindo ? (
                <Button onClick={() => setDividindo(true)} disabled={itens.length === 0} className="w-full"><Users className="h-4 w-4 mr-1" />Finalizar e dividir a conta</Button>
              ) : (
                <div className="flex gap-2">
                  <Input type="number" min={1} placeholder="Quantas pessoas?" value={numPessoasInput} onChange={e => setNumPessoasInput(e.target.value)} />
                  <Button onClick={iniciarDivisao}>Dividir</Button>
                </div>
              )}
            </div>
          )}

          {comanda.tipo === "grupo" && comanda.travada && (
            <div className="space-y-3 pt-1">
              <Card className="p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>{comanda.num_pessoas} pessoas · parte igual seria</span><b>{brl(cota)}</b></div>
                <div className="border-t border-border pt-1 flex justify-between"><span className="text-emerald-500">Pago</span><span className="text-emerald-500 font-bold">{brl(pagoSum)}</span></div>
                <div className="flex justify-between"><span className="text-amber-500">Restante</span><span className="text-amber-500 font-bold">{brl(restante)}</span></div>
                {Math.abs(diferencaSoma) >= 0.01 && (
                  <div className="text-[11px] text-rose-500 pt-1 border-t border-border">
                    Valores manuais somam acima do total — {brl(-diferencaSoma)} sobrando.
                  </div>
                )}
              </Card>
              {participantes.length < comanda.num_pessoas && (
                <div className="flex gap-2">
                  <Input placeholder="Nome do participante" value={novoParticipante} onChange={e => setNovoParticipante(e.target.value)} onKeyDown={e => e.key === "Enter" && addParticipante()} className="flex-1" />
                  <Input type="number" step="0.01" placeholder={brl(cota)} value={novoParticipanteValor} onChange={e => setNovoParticipanteValor(e.target.value)} className="w-24" onKeyDown={e => e.key === "Enter" && addParticipante()} />
                  <Button type="button" onClick={addParticipante}><Plus className="h-4 w-4" /></Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground -mt-1">Por padrão o que falta é dividido igual entre quem não pagou — edite o valor se alguém for pagar mais ou menos (o resto recalcula sozinho).</p>
              <div className="space-y-1.5">
                {participantes.map(p => (
                  <div key={p.id} className="space-y-1">
                    <div className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${p.pago ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                        <Checkbox checked={p.pago} onCheckedChange={() => togglePago(p)} />
                        <span className={`truncate ${p.pago ? "" : "font-bold"}`}>{p.nome}</span>
                      </label>
                      {p.pago ? (
                        <span className="text-xs text-muted-foreground shrink-0">{brl(valorDe(p))}</span>
                      ) : (
                        <>
                          <Input
                            type="number" step="0.01"
                            className="h-7 w-20 text-right text-xs shrink-0"
                            value={rascunhoValores[p.id] !== undefined ? rascunhoValores[p.id] : valorDe(p).toFixed(2)}
                            onChange={e => setRascunhoValores(r => ({ ...r, [p.id]: e.target.value }))}
                            onBlur={e => { void atualizarValorParticipante(p, e.target.value); setRascunhoValores(r => { const n = { ...r }; delete n[p.id]; return n; }); }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Calcular troco" onClick={() => setTrocoAberto(t => ({ ...t, [p.id]: !t[p.id] }))}><Banknote className="h-3 w-3" /></Button>
                        </>
                      )}
                      {!p.pago && <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => removerParticipante(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                    {!p.pago && trocoAberto[p.id] && (
                      <div className="rounded-lg bg-muted p-2 ml-1 space-y-1.5">
                        <Label className="text-[11px]">Troco pra {p.nome} (deve {brl(valorDe(p))})</Label>
                        <Input
                          type="number" step="0.01" placeholder="Valor recebido em dinheiro" className="h-7 text-xs"
                          value={trocoValor[p.id] ?? ""} onChange={e => setTrocoValor(v => ({ ...v, [p.id]: e.target.value }))}
                        />
                        {trocoValor[p.id] && (
                          Number(trocoValor[p.id]) >= valorDe(p) ? (
                            <div className="text-xs font-semibold text-emerald-600">Troco: {brl(Number(trocoValor[p.id]) - valorDe(p))}</div>
                          ) : (
                            <div className="text-xs font-semibold text-rose-500">Falta {brl(valorDe(p) - Number(trocoValor[p.id]))}</div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={confirmarBaixaGrupo} disabled={!todosPagos || salvando} className="w-full">
                {todosPagos ? `Confirmar baixa — ${brl(total)}` : `Faltam ${comanda.num_pessoas - participantes.filter(p => p.pago).length} pagar`}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
