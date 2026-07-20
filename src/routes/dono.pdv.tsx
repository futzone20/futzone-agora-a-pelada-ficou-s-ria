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
import { Minus, Plus, ShoppingCart, Trash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/pdv")({ component: PDV });

type Item = { produto: any; qtd: number };

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function PDV() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Item[]>([]);
  const [openPag, setOpenPag] = useState(false);
  const [forma, setForma] = useState("dinheiro");
  const [buscaUser, setBuscaUser] = useState("");
  const [userPag, setUserPag] = useState<any>(null);
  const [saldoUser, setSaldoUser] = useState(0);
  const [usuariosBusca, setUsuariosBusca] = useState<any[]>([]);
  const [recibo, setRecibo] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    const { data: p } = await supabase.from("pdv_produtos").select("*, pdv_categorias(nome, codigo)").eq("arena_id", a.id).eq("ativo", true).order("codigo");
    setProdutos(p ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase(); if (!q) return produtos;
    const n = Number(q);
    if (!isNaN(n)) {
      if (q.length <= 2) return produtos.filter((p:any)=>p.pdv_categorias?.codigo === n);
      return produtos.filter((p:any)=>p.codigo === n);
    }
    return produtos.filter((p:any)=>p.nome.toLowerCase().includes(q));
  }, [produtos, busca]);

  const add = (p: any) => {
    if (p.estoque_atual <= 0) { toast.error("Sem estoque"); return; }
    setCarrinho(c => {
      const ex = c.find(i => i.produto.id === p.id);
      if (ex) { if (ex.qtd >= p.estoque_atual) { toast.error("Estoque insuficiente"); return c; } return c.map(i => i.produto.id===p.id ? {...i, qtd: i.qtd+1} : i); }
      return [...c, { produto: p, qtd: 1 }];
    });
  };
  const dec = (id: string) => setCarrinho(c => c.map(i=>i.produto.id===id?{...i,qtd:i.qtd-1}:i).filter(i=>i.qtd>0));
  const del = (id: string) => setCarrinho(c => c.filter(i=>i.produto.id!==id));
  const total = carrinho.reduce((s,i)=>s + Number(i.produto.preco)*i.qtd, 0);

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
    if (!arena || !user) return;
    let cashUtil = 0;
    if (forma === "cashback") {
      if (!userPag) { toast.error("Selecione usuário"); return; }
      if (saldoUser < total) { toast.error("Saldo insuficiente"); return; }
      cashUtil = total;
    }
    const { data: venda, error } = await supabase.from("pdv_vendas").insert({
      arena_id: arena.id, usuario_id: userPag?.user_id ?? null, total, forma_pagamento: forma,
      cashback_utilizado: cashUtil, operador_id: user.id,
    } as never).select().single();
    if (error || !venda) { toast.error(error?.message || "Erro"); return; }
    const itens = carrinho.map(i => ({ venda_id: (venda as any).id, produto_id: i.produto.id, quantidade: i.qtd, preco_unitario: i.produto.preco, subtotal: Number(i.produto.preco)*i.qtd }));
    const { error: e2 } = await supabase.from("pdv_itens_venda").insert(itens as never);
    if (e2) { toast.error(e2.message); return; }
    setRecibo({ venda, itens: carrinho, total });
    setCarrinho([]); setOpenPag(false); setForma("dinheiro"); setUserPag(null); setBuscaUser(""); setSaldoUser(0);
    void load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  return (
    <div className="space-y-3">
      <Input placeholder="Buscar por código ou nome..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      <div className="grid grid-cols-2 gap-2">
        {filtrados.map(p=>{
          const noCart = carrinho.find(i=>i.produto.id===p.id)?.qtd;
          const baixo = p.estoque_atual <= p.estoque_minimo;
          return (
            <Card key={p.id} className={`p-2 cursor-pointer ${baixo?"border-rose-500/40":""}`} onClick={()=>add(p)}>
              <div className="text-xs text-muted-foreground">{p.codigo}</div>
              <div className="font-bold text-sm truncate">{p.nome}</div>
              <div className="text-emerald-500 font-bold">{brl(Number(p.preco))}</div>
              <div className={`text-xs ${baixo?"text-rose-500":""}`}>Est: {p.estoque_atual}</div>
              {noCart && <div className="text-xs text-primary">No carrinho: {noCart}</div>}
            </Card>
          );
        })}
      </div>

      {carrinho.length > 0 && (
        <Card className="p-3 sticky bottom-20 bg-card shadow-lg">
          <div className="flex items-center gap-2 mb-2"><ShoppingCart className="h-4 w-4"/><b>Carrinho ({carrinho.length})</b></div>
          {carrinho.map(i=>(
            <div key={i.produto.id} className="flex items-center justify-between py-1 text-sm">
              <span className="truncate flex-1">{i.produto.nome}</span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={()=>dec(i.produto.id)}><Minus className="h-3 w-3"/></Button>
                <span className="w-6 text-center">{i.qtd}</span>
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={()=>add(i.produto)}><Plus className="h-3 w-3"/></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=>del(i.produto.id)}><Trash className="h-3 w-3"/></Button>
              </div>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between font-bold"><span>Total</span><span>{brl(total)}</span></div>
          <Button onClick={()=>setOpenPag(true)} className="w-full mt-2">Finalizar</Button>
        </Card>
      )}

      <Dialog open={openPag} onOpenChange={setOpenPag}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento — {brl(total)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="cartao_debito">Débito</SelectItem><SelectItem value="cartao_credito">Crédito</SelectItem><SelectItem value="cashback">Cashback</SelectItem>
              </SelectContent></Select>
            </div>
            {forma === "cashback" && (
              <div className="space-y-2">
                <div className="flex gap-2"><Input placeholder="Nome ou WhatsApp" value={buscaUser} onChange={e=>setBuscaUser(e.target.value)}/><Button onClick={buscarUser}>Buscar</Button></div>
                {usuariosBusca.map(u=><div key={u.user_id} className="p-2 border rounded cursor-pointer hover:bg-muted" onClick={()=>selecionarUser(u)}>{u.nome}</div>)}
                {userPag && <div className="p-2 bg-muted rounded text-sm"><b>{userPag.nome}</b> — saldo {brl(saldoUser)}{saldoUser < total && <div className="text-rose-500 text-xs">Saldo insuficiente</div>}</div>}
              </div>
            )}
            <Button onClick={finalizar} className="w-full" disabled={forma==="cashback" && (!userPag || saldoUser < total)}>Confirmar venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recibo} onOpenChange={o=>!o && setRecibo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Venda registrada ✓</DialogTitle></DialogHeader>
          {recibo && <div className="space-y-2">
            {recibo.itens.map((i:any,k:number)=><div key={k} className="flex justify-between text-sm"><span>{i.qtd}x {i.produto.nome}</span><span>{brl(Number(i.produto.preco)*i.qtd)}</span></div>)}
            <div className="border-t pt-2 font-bold flex justify-between"><span>Total</span><span>{brl(recibo.total)}</span></div>
            <Button onClick={()=>setRecibo(null)} className="w-full">Nova venda</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
