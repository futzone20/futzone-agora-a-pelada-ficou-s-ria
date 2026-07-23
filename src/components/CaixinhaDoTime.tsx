import { useEffect, useState } from "react";
import { PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * "Caixinha do Time" — área pessoal do jogador com todas as vaquinhas dos grupos dele.
 */
export function CaixinhaDoTime() {
  const { user } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagamentoAberto, setPagamentoAberto] = useState<any | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: parts } = await (supabase as any).from("vaquinha_participantes").select("*").eq("user_id", user.id);
    if (!parts || !parts.length) { setItens([]); setLoading(false); return; }

    const vaquinhaIds = parts.map((p: any) => p.vaquinha_id);
    const { data: vaquinhas } = await (supabase as any).from("vaquinhas").select("*").in("id", vaquinhaIds);
    const grupoIds: string[] = Array.from(new Set((vaquinhas || []).map((v: any) => v.grupo_id as string)));
    const { data: grupos } = grupoIds.length
      ? await supabase.from("grupos").select("id, nome").in("id", grupoIds)
      : { data: [] as any[] };

    const montado = parts.map((p: any) => {
      const v = (vaquinhas || []).find((x: any) => x.id === p.vaquinha_id);
      const g = v ? (grupos || []).find((x: any) => x.id === v.grupo_id) : null;
      return { ...p, vaquinha: v, grupoNome: g?.nome || "Grupo" };
    }).filter((x: any) => x.vaquinha);

    montado.sort((a: any, b: any) => new Date(b.vaquinha.criado_em).getTime() - new Date(a.vaquinha.criado_em).getTime());
    setItens(montado);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const responder = async (participanteId: string, aceitar: boolean) => {
    const { error } = await (supabase as any).from("vaquinha_participantes")
      .update({ status: aceitar ? "aceito" : "recusado" }).eq("id", participanteId);
    if (error) return toast.error(error.message);
    toast.success(aceitar ? "Você topou! 🤝" : "Participação recusada");
    void load();
  };

  const marcarPago = async () => {
    if (!pagamentoAberto) return;
    setSaving(true);
    const { error } = await (supabase as any).from("vaquinha_participantes").update({
      pagamento_status: "informado",
      forma_pagamento: formaPagamento,
      informado_em: new Date().toISOString(),
    }).eq("id", pagamentoAberto.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Avisado! O capitão vai confirmar seu pagamento.");
    setPagamentoAberto(null);
    void load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center gap-2">
        <PiggyBank className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">🏆 Caixinha do Time</h2>
          <p className="text-xs text-muted-foreground">Suas vaquinhas, de todos os grupos.</p>
        </div>
      </div>

      {itens.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Nenhuma vaquinha ainda" description="Quando um capitão criar uma vaquinha, ela vai aparecer aqui." />
      ) : (
        <div className="space-y-3">
          {itens.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.grupoNome}</div>
              <div className="font-bold">💰 {it.vaquinha.titulo}</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{it.vaquinha.descricao}</p>
              {it.vaquinha.valor_sugerido && (
                <p className="text-sm">Valor sugerido: <span className="font-bold">R$ {Number(it.vaquinha.valor_sugerido).toFixed(2)}</span></p>
              )}

              {it.status === "pendente" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => responder(it.id, true)} className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90">Topo!</Button>
                  <Button size="sm" variant="outline" onClick={() => responder(it.id, false)} className="flex-1">Não vou participar</Button>
                </div>
              )}

              {it.status === "aceito" && it.pagamento_status === "nao_pago" && (
                <Button size="sm" onClick={() => { setPagamentoAberto(it); setFormaPagamento("Pix"); }} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  Já paguei
                </Button>
              )}
              {it.status === "aceito" && it.pagamento_status === "informado" && (
                <p className="text-xs text-muted-foreground">⏳ Aguardando o capitão confirmar seu pagamento ({it.forma_pagamento})</p>
              )}
              {it.status === "aceito" && it.pagamento_status === "confirmado" && (
                <p className="text-xs text-green-500 font-bold">✅ Pagamento confirmado pelo capitão</p>
              )}
              {it.status === "recusado" && (
                <p className="text-xs text-muted-foreground">Você recusou participar dessa vaquinha.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!pagamentoAberto} onOpenChange={(v) => !v && setPagamentoAberto(null)}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Como você pagou?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={marcarPago} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {saving ? "Enviando..." : "Confirmar que paguei"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
