import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { CircleDot, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/lib/pelada-status";

export const Route = createFileRoute("/capitao/peladas")({
  component: Peladas,
});

function Peladas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: ms } = await supabase.from("grupo_membros").select("grupo_id, papel").eq("user_id", user.id).eq("status", "ativo");
      const ids = (ms || []).filter((m: any) => m.papel === "capitao" || m.papel === "auxiliar").map((m: any) => m.grupo_id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, status, grupos(nome)")
        .in("grupo_id", ids)
        .order("data", { ascending: true });
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Peladas</h2>
      {rows.length === 0 ? (
        <EmptyState icon={CircleDot} title="Nenhuma pelada criada" description="Abra um grupo e crie a primeira pelada." />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link key={p.id} to="/peladas/$id" params={{ id: p.id }} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{p.nome_pelada}</div>
                  <div className="text-xs text-muted-foreground">{p.grupos?.nome}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0,5)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
