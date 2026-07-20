import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/parceiros")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const load = async () => {
    let qb = supabase.from("parceiros").select("*").order("criado_em", { ascending: false } as any);
    if (q) qb = qb.or(`nome_estabelecimento.ilike.%${q}%,cidade.ilike.%${q}%`);
    const { data } = await qb; setRows(data ?? []);
  };
  useEffect(() => { void load(); }, []);
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("parceiros").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("OK"); void load(); }
  };
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Parceiros</h2>
      <div className="flex gap-2">
        <Input placeholder="Buscar" value={q} onChange={e=>setQ(e.target.value)}/>
        <Button onClick={load}>Filtrar</Button>
      </div>
      {rows.map(r => (
        <Card key={r.id} className="p-3 flex justify-between items-center gap-2">
          <div>
            <div className="font-bold text-sm">{r.nome_estabelecimento}</div>
            <div className="text-xs text-muted-foreground">{r.categoria} · {r.cidade}/{r.estado} · {r.plano ?? "gratuito"}</div>
          </div>
          <div className="flex gap-1">
            <Select value={r.plano ?? "gratuito"} onValueChange={v=>update(r.id, { plano: v })}>
              <SelectTrigger className="w-32 h-8"><SelectValue/></SelectTrigger><SelectContent>
                <SelectItem value="gratuito">Gratuito</SelectItem><SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-36 h-8" value={r.plano_validade?.slice(0,10) ?? ""} onChange={e=>update(r.id, { plano_validade: e.target.value })}/>
            <Button size="sm" variant={r.ativo===false?"default":"outline"} onClick={()=>update(r.id, { ativo: r.ativo===false })}>{r.ativo===false?"Ativar":"Suspender"}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
