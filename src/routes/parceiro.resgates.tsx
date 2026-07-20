import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/parceiro/resgates")({ component: Resgates });

function Resgates() {
  const { user } = useAuth();
  const [parc, setParc] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [codigo, setCodigo] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("parceiros").select("*").eq("user_id", user.id).maybeSingle();
    if (!p) return; setParc(p);
    const { data } = await supabase.from("parceiros_resgates").select("*, parceiros_recompensas(nome), profiles(nome, whatsapp, foto_url)").eq("parceiro_id", (p as any).id).order("solicitado_em", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("parceiros_resgates").update({ status } as never).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); void load(); }
  };

  const validarCodigo = async () => {
    const r = list.find(x => x.codigo_validacao === codigo.trim().toUpperCase());
    if (!r) { toast.error("Código não encontrado"); return; }
    if (r.status !== "pendente") { toast.error("Resgate não está pendente"); return; }
    await updateStatus(r.id, "confirmado");
    setCodigo("");
  };

  if (!parc) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre seu perfil primeiro.</div>;

  const filtrados = list.filter(r => filtro === "todos" || r.status === filtro);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex gap-2">
        <Input placeholder="FZ-RESGATE-XXXX" value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())}/>
        <Button onClick={validarCodigo}>Validar</Button>
      </Card>

      <Select value={filtro} onValueChange={setFiltro}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
        <SelectItem value="todos">Todos</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="confirmado">Confirmados</SelectItem><SelectItem value="cancelado">Cancelados</SelectItem><SelectItem value="expirado">Expirados</SelectItem>
      </SelectContent></Select>

      {filtrados.map(r=>(
        <Card key={r.id} className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-bold">{r.profiles?.nome}</div>
              <div className="text-sm">{r.parceiros_recompensas?.nome}</div>
              <div className="text-xs text-muted-foreground">{r.pontos_debitados} pts · {new Date(r.solicitado_em).toLocaleString("pt-BR")}</div>
              <div className="text-xs font-mono mt-1 text-primary">{r.codigo_validacao}</div>
            </div>
            <Badge variant={r.status==="confirmado"?"default":r.status==="cancelado"||r.status==="expirado"?"destructive":"outline"}>{r.status}</Badge>
          </div>
          {r.status === "pendente" && <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={()=>updateStatus(r.id,"confirmado")}>Confirmar</Button>
            <Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"cancelado")}>Cancelar</Button>
          </div>}
        </Card>
      ))}
      {filtrados.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Sem resgates.</p>}
    </div>
  );
}
