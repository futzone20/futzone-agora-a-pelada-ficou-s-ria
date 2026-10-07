import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Link2 } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/financeiro-utils";

export const Route = createFileRoute("/dono/financeiro/fornecedores")({ component: FornecedoresPage });

const F_VAZIO = { nome: "", documento: "", telefone: "", email: "", observacoes: "" };
const NAO_VINCULAR = "nenhum";

function FornecedoresPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>(F_VAZIO);
  const [excluir, setExcluir] = useState<any>(null);

  // Itens do fornecedor
  const [fornItens, setFornItens] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [novoItem, setNovoItem] = useState({ nome: "", preco_referencia: 0, produto_id: NAO_VINCULAR });

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    const { data: f } = await supabase.from("fornecedores").select("*").eq("arena_id", a.id).order("nome");
    setFornecedores(f ?? []);
    const { data: p } = await supabase.from("pdv_produtos").select("id,nome,codigo").eq("arena_id", a.id).order("nome");
    setProdutos(p ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const abrirNovo = () => { setEditando(null); setForm(F_VAZIO); setOpenForm(true); };
  const abrirEdicao = (f: any) => {
    setEditando(f);
    setForm({ nome: f.nome, documento: f.documento ?? "", telefone: f.telefone ?? "", email: f.email ?? "", observacoes: f.observacoes ?? "" });
    setOpenForm(true);
  };

  const salvar = async () => {
    if (!arena || !form.nome.trim()) return;
    const payload = {
      nome: form.nome.trim(), documento: form.documento || null, telefone: form.telefone || null,
      email: form.email || null, observacoes: form.observacoes || null,
    };
    const { error } = editando
      ? await supabase.from("fornecedores").update(payload as never).eq("id", editando.id)
      : await supabase.from("fornecedores").insert({ ...payload, arena_id: arena.id } as never);
    if (error) { toast.error(error.message); return; }
    toast.success(editando ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    setOpenForm(false); void load();
  };

  const toggleAtivo = async (f: any) => { await supabase.from("fornecedores").update({ ativo: !f.ativo } as never).eq("id", f.id); void load(); };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", excluir.id);
    setExcluir(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor excluído (as saídas antigas ficam, sem fornecedor)");
    void load();
  };

  const abrirItens = async (f: any) => {
    setFornItens(f);
    setNovoItem({ nome: "", preco_referencia: 0, produto_id: NAO_VINCULAR });
    const { data } = await supabase.from("fornecedor_itens").select("*").eq("fornecedor_id", f.id).order("nome");
    setItens(data ?? []);
  };

  const adicionarItem = async () => {
    if (!arena || !fornItens || !novoItem.nome.trim()) return;
    const { error } = await supabase.from("fornecedor_itens").insert({
      arena_id: arena.id, fornecedor_id: fornItens.id, nome: novoItem.nome.trim(), preco_referencia: novoItem.preco_referencia || 0,
      produto_id: novoItem.produto_id === NAO_VINCULAR ? null : novoItem.produto_id,
    } as never);
    if (error) { toast.error(error.message); return; }
    setNovoItem({ nome: "", preco_referencia: 0, produto_id: NAO_VINCULAR });
    await abrirItens(fornItens);
  };

  const vincularItem = async (item: any, produtoId: string) => {
    await supabase.from("fornecedor_itens").update({ produto_id: produtoId === NAO_VINCULAR ? null : produtoId } as never).eq("id", item.id);
    await abrirItens(fornItens);
  };

  const removerItem = async (item: any) => {
    await supabase.from("fornecedor_itens").delete().eq("id", item.id);
    await abrirItens(fornItens);
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Cadastre quem vende pra você e os itens que compra. Ao lançar uma saída, é só escolher o fornecedor.</p>
        <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />Fornecedor</Button>
      </div>

      {fornecedores.map(f => (
        <Card key={f.id} className={`p-3 ${f.ativo ? "" : "opacity-60"}`}>
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-bold truncate">{f.nome}</div>
              <div className="text-xs text-muted-foreground">{[f.documento, f.telefone, f.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</div>
              {f.observacoes && <div className="text-xs mt-1">{f.observacoes}</div>}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Switch checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => abrirItens(f)}><Package className="h-3 w-3 mr-1" />Itens</Button>
                <Button size="sm" variant="outline" onClick={() => abrirEdicao(f)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-500" onClick={() => setExcluir(f)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
      {fornecedores.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum fornecedor cadastrado ainda.</p>}

      {/* Cadastro / edição */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>CNPJ / CPF</Label><Input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <Button onClick={salvar} disabled={!form.nome.trim()} className="w-full">{editando ? "Salvar alterações" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Itens do fornecedor */}
      <Dialog open={!!fornItens} onOpenChange={o => !o && setFornItens(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Itens — {fornItens?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Itens que você compra deste fornecedor. Se vincular a um produto do estoque, ao lançar a compra a quantidade entra no estoque (você ainda pode desmarcar na hora).</p>
            {itens.map(it => (
              <Card key={it.id} className="p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><div className="font-bold text-sm truncate">{it.nome}</div><div className="text-xs text-muted-foreground">Preço de referência {brl(it.preco_referencia)}</div></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => removerItem(it)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select value={it.produto_id ?? NAO_VINCULAR} onValueChange={v => vincularItem(it, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NAO_VINCULAR}>Sem vínculo com estoque</SelectItem>
                      {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            ))}
            {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nenhum item cadastrado.</p>}

            <Card className="p-3 space-y-2 border-dashed">
              <div className="text-xs font-bold text-muted-foreground">NOVO ITEM</div>
              <Input placeholder="Nome do item (ex: Caixa Coca-Cola lata 12un)" value={novoItem.nome} onChange={e => setNovoItem({ ...novoItem, nome: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" placeholder="Preço de referência" value={novoItem.preco_referencia || ""} onChange={e => setNovoItem({ ...novoItem, preco_referencia: +e.target.value })} />
                <Select value={novoItem.produto_id} onValueChange={v => setNovoItem({ ...novoItem, produto_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NAO_VINCULAR}>Sem vínculo com estoque</SelectItem>
                    {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={adicionarItem} disabled={!novoItem.nome.trim()} className="w-full"><Plus className="h-4 w-4 mr-1" />Adicionar item</Button>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={o => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Os itens cadastrados dele também serão removidos. As saídas já lançadas continuam no financeiro, só ficam sem fornecedor.</AlertDialogDescription>
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
