import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { brl, FORMAS_PAGAMENTO, formaLabel, hojeISO, inicioMesISO, ORIGEM_ENTRADA_LABEL, origemEntrada, type OrigemEntrada } from "@/lib/financeiro";

export const Route = createFileRoute("/dono/financeiro/entradas")({ component: EntradasPage });

const FORM_VAZIO = { descricao: "", valor: 0, forma_pagamento: "dinheiro", origem: "outro" as OrigemEntrada, data_lancamento: hojeISO() };

function EntradasPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [lans, setLans] = useState<any[]>([]);
  const [ini, setIni] = useState(inicioMesISO);
  const [fim, setFim] = useState(hojeISO);
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [filtroForma, setFiltroForma] = useState("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    const { data } = await supabase.from("financeiro_lancamentos").select("*").eq("arena_id", a.id).eq("tipo", "receita")
      .gte("data_lancamento", ini).lte("data_lancamento", fim).order("data_lancamento", { ascending: false }).order("criado_em", { ascending: false });
    setLans(data ?? []);
  };
  useEffect(() => { void load(); }, [user?.id, ini, fim]);

  const filtradas = useMemo(() => lans.filter(l =>
    (filtroOrigem === "todas" || origemEntrada(l) === filtroOrigem) &&
    (filtroForma === "todas" || (l.forma_pagamento ?? "") === filtroForma)
  ), [lans, filtroOrigem, filtroForma]);

  const porOrigem = useMemo(() => {
    const r: Record<OrigemEntrada, number> = { quadra: 0, pdv: 0, outro: 0 };
    lans.forEach(l => { r[origemEntrada(l)] += Number(l.valor); });
    return r;
  }, [lans]);

  const salvar = async () => {
    if (!arena || !form.descricao.trim() || !(Number(form.valor) > 0)) return;
    setSalvando(true);
    // Entrada manual: origem 'manual'; "de onde veio" (quadra/PDV/outro) fica em categoria
    const { error } = await supabase.from("financeiro_lancamentos").insert({
      arena_id: arena.id, tipo: "receita", origem: "manual", descricao: form.descricao.trim(), valor: Number(form.valor),
      categoria: form.origem, forma_pagamento: form.forma_pagamento, data_lancamento: form.data_lancamento,
    } as never);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Entrada registrada");
    setOpen(false); setForm({ ...FORM_VAZIO, data_lancamento: hojeISO() }); void load();
  };

  const excluir = async (l: any) => {
    if (l.origem !== "manual") return;
    const { error } = await supabase.from("financeiro_lancamentos").delete().eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;
  const total = filtradas.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e => setIni(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["quadra", "pdv", "outro"] as OrigemEntrada[]).map(o => (
          <Card key={o} className="p-3"><div className="text-xs text-muted-foreground">{ORIGEM_ENTRADA_LABEL[o]}</div><div className="text-emerald-500 font-bold">{brl(porOrigem[o])}</div></Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="todas">Todas as origens</SelectItem>
          {(["quadra", "pdv", "outro"] as OrigemEntrada[]).map(o => <SelectItem key={o} value={o}>{ORIGEM_ENTRADA_LABEL[o]}</SelectItem>)}
        </SelectContent></Select>
        <Select value={filtroForma} onValueChange={setFiltroForma}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="todas">Todas as formas</SelectItem>
          {Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent></Select>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Entrada</Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtradas.length} entradas · total <b className="text-emerald-500">{brl(total)}</b></div>

      {filtradas.map(l => (
        <Card key={l.id} className="p-3 flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{l.descricao}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(l.data_lancamento + "T12:00:00").toLocaleDateString("pt-BR")} · {ORIGEM_ENTRADA_LABEL[origemEntrada(l)]} · {formaLabel(l.forma_pagamento)}{l.origem === "manual" && " · manual"}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="font-bold text-emerald-500">+{brl(Number(l.valor))}</div>
            {l.origem === "manual" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir(l)}><Trash className="h-3 w-3" /></Button>}
          </div>
        </Card>
      ))}
      {filtradas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma entrada encontrada.</p>}
      <p className="text-[11px] text-muted-foreground">Vendas do PDV e reservas de quadra com baixa entram aqui automaticamente. Só as entradas manuais podem ser excluídas.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova entrada</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Patrocínio do torneio" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor || ""} onChange={e => setForm({ ...form, valor: +e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data_lancamento} onChange={e => setForm({ ...form, data_lancamento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>De onde veio</Label>
                <Select value={form.origem} onValueChange={v => setForm({ ...form, origem: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {(["quadra", "pdv", "outro"] as OrigemEntrada[]).map(o => <SelectItem key={o} value={o}>{ORIGEM_ENTRADA_LABEL[o]}</SelectItem>)}
                </SelectContent></Select>
              </div>
              <div><Label>Forma de pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {Object.entries(FORMAS_PAGAMENTO).filter(([k]) => k !== "boleto").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent></Select>
              </div>
            </div>
            <Button onClick={salvar} disabled={salvando || !form.descricao.trim() || !(Number(form.valor) > 0)} className="w-full">{salvando ? "Salvando..." : "Registrar entrada"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
