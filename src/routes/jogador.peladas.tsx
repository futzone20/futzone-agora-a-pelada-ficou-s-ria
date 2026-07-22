import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CircleDot, Calendar, Clock, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ConfirmadosProgress, PeladaStatusOuContagem, useAgora } from "@/lib/pelada-status";

export const Route = createFileRoute("/jogador/peladas")({
  component: Peladas,
});


type Row = {
  id: string; nome_pelada: string; data: string; horario_inicio: string; status: string;
  quadra?: { nome: string } | null;
  confirmados: number; capacidade: number;
};

function Peladas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: ms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo");
      const grupoIds = (ms || []).map((m: any) => m.grupo_id);
      if (grupoIds.length === 0) { setRows([]); setLoading(false); return; }
      const { data: peladas } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, status, quadra_id, jogadores_por_time, goleiros_por_time, numero_times")
        .in("grupo_id", grupoIds)
        .order("data", { ascending: true });
      const peladaIds = (peladas || []).map((p: any) => p.id);
      const quadraIds = Array.from(new Set((peladas || []).map((p: any) => p.quadra_id).filter(Boolean)));
      const { data: confs } = peladaIds.length ? await supabase.from("pelada_confirmacoes").select("pelada_id, status").in("pelada_id", peladaIds) : { data: [] as any[] };
      const { data: quadras } = quadraIds.length ? await supabase.from("quadras_publicas").select("id, nome").in("id", quadraIds) : { data: [] as any[] };
      const quadraMap: Record<string, { nome: string }> = {};
      (quadras || []).forEach((q: any) => { quadraMap[q.id] = { nome: q.nome }; });
      const out: Row[] = (peladas || []).map((p: any) => ({
        id: p.id, nome_pelada: p.nome_pelada, data: p.data, horario_inicio: p.horario_inicio, status: p.status,
        quadra: p.quadra_id ? quadraMap[p.quadra_id] : null,
        confirmados: (confs || []).filter((c: any) => c.pelada_id === p.id && c.status === "confirmado").length,
        capacidade: (p.jogadores_por_time + p.goleiros_por_time) * p.numero_times,
      }));
      setRows(out);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Peladas</h2>
        <CriarGrupoButton />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CircleDot} title="Você ainda não tem peladas" description="Crie um grupo ou entre em um via convite para ver peladas aqui." />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link key={p.id} to="/peladas/$id" params={{ id: p.id }} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between">
                <div className="font-bold">{p.nome_pelada}</div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.data.split("-").reverse().join("/")}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horario_inicio.slice(0,5)}</span>
                {p.quadra && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.quadra.nome}</span>}
              </div>
              <ConfirmadosProgress confirmados={p.confirmados} capacidade={p.capacidade} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CriarGrupoButton() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos").insert({ nome: nome.trim(), criado_por: user.id, codigo_convite: "" } as never)
      .select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    setOpen(false); setNome("");
    toast.success("Grupo criado");
    await refresh();
    navigate({ to: "/grupos/$id", params: { id: (data as any).id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />Criar grupo</Button>
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle>Criar Grupo</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Nome do grupo</Label><Input required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pelada de Quinta" /></div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {loading ? "Criando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

