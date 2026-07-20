import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/usuarios")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [sel, setSel] = useState<any>(null);
  const [pontosForm, setPontosForm] = useState({ valor: 0, motivo: "" });

  const load = async () => {
    let qb = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
    if (role !== "todos") qb = qb.eq("role", role as any);
    if (status !== "todos") qb = qb.eq("status", status);
    if (q) qb = qb.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
    const { data } = await qb;
    setRows(data ?? []);
  };
  useEffect(() => { void load(); }, [role, status]);

  const log = async (acao: string, detalhes: any) => {
    if (!user) return;
    await supabase.from("admin_log").insert({ admin_id: user.id, acao, alvo_tabela: "profiles", alvo_id: sel?.user_id, detalhes } as never);
  };
  const update = async (patch: any, acao: string) => {
    if (!sel) return;
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", sel.user_id);
    if (error) return toast.error(error.message);
    await log(acao, patch);
    toast.success("Atualizado"); setSel({ ...sel, ...patch }); void load();
  };
  const ajustarPontos = async () => {
    if (!sel || !pontosForm.motivo) return;
    const novo = (sel.pontos_total ?? 0) + Number(pontosForm.valor);
    await supabase.from("profiles").update({ pontos_total: novo }).eq("user_id", sel.user_id);
    await supabase.from("pontos_historico").insert({ user_id: sel.user_id, acao: "ajuste_admin", valor_pontos: Number(pontosForm.valor), saldo_apos: novo, descricao_legivel: pontosForm.motivo } as never);
    await log("ajustar_pontos", pontosForm);
    toast.success("Pontos ajustados"); setPontosForm({ valor: 0, motivo: "" }); setSel({ ...sel, pontos_total: novo });
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Usuários</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Input placeholder="Buscar nome/email" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/>
        <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
          {["todos","jogador","capitao","dono_quadra","parceiro","admin"].map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
          {["todos","ativo","suspenso","banido"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent></Select>
        <Button onClick={load}>Filtrar</Button>
      </div>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {rows.map(r => (
          <Card key={r.user_id} className="p-3 flex justify-between items-center cursor-pointer hover:bg-accent/30" onClick={()=>setSel(r)}>
            <div>
              <div className="font-bold text-sm">{r.nome}</div>
              <div className="text-xs text-muted-foreground">{r.email} · {r.role} · {r.plano} · {r.status}</div>
            </div>
            <div className="text-xs text-right"><div>{r.pontos_total ?? 0} pts</div><div className="text-muted-foreground">{r.cidade}/{r.estado}</div></div>
          </Card>
        ))}
      </div>
      <Dialog open={!!sel} onOpenChange={o=>!o&&setSel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sel?.nome}</DialogTitle></DialogHeader>
          {sel && <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{sel.email}</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Role</Label><Select value={sel.role} onValueChange={v=>update({ role: v }, "alterar_role")}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                  {["jogador","capitao","dono_quadra","parceiro","admin"].map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent></Select></div>
              <div><Label>Status</Label><Select value={sel.status} onValueChange={v=>update({ status: v }, "alterar_status")}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                  {["ativo","suspenso","banido"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent></Select></div>
              <div><Label>Plano</Label><Select value={sel.plano} onValueChange={v=>update({ plano: v }, "alterar_plano")}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                  <SelectItem value="gratuito">Gratuito</SelectItem><SelectItem value="premium">Premium</SelectItem>
                </SelectContent></Select></div>
              <div><Label>Validade plano</Label><Input type="date" value={sel.plano_validade?.slice(0,10) ?? ""} onChange={e=>setSel({...sel, plano_validade: e.target.value})} onBlur={()=>update({ plano_validade: sel.plano_validade }, "alterar_validade")}/></div>
            </div>
            <div className="border-t pt-3">
              <Label>Ajustar pontos (use negativo para remover)</Label>
              <div className="flex gap-2 mt-1">
                <Input type="number" value={pontosForm.valor} onChange={e=>setPontosForm({...pontosForm, valor: +e.target.value})}/>
                <Input placeholder="Motivo (obrigatório)" value={pontosForm.motivo} onChange={e=>setPontosForm({...pontosForm, motivo: e.target.value})}/>
                <Button onClick={ajustarPontos} disabled={!pontosForm.motivo}>OK</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Saldo atual: {sel.pontos_total ?? 0}</div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
