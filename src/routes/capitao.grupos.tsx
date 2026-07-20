import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { Shield, Plus, Users, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/capitao/grupos")({
  component: Grupos,
});

type Grupo = {
  id: string;
  nome: string;
  codigo_convite: string;
  membros: number;
  proxima?: { data: string; horario_inicio: string; nome_pelada: string } | null;
};

function Grupos() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("grupos")
      .select("id, nome, codigo_convite, grupo_membros(count), peladas(data, horario_inicio, nome_pelada, status)")
      .order("criado_em", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const rows: Grupo[] = (data || []).map((g: any) => {
      const proximas = (g.peladas || [])
        .filter((p: any) => p.status !== "encerrada" && p.status !== "cancelada")
        .sort((a: any, b: any) => (a.data + a.horario_inicio).localeCompare(b.data + b.horario_inicio));
      return {
        id: g.id, nome: g.nome, codigo_convite: g.codigo_convite,
        membros: g.grupo_membros?.[0]?.count ?? 0,
        proxima: proximas[0] || null,
      };
    });
    setGrupos(rows);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos")
      .insert({ nome: nome.trim(), criado_por: user.id, codigo_convite: "" } as never)
      .select("id")
      .single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setNome(""); setOpen(false);
    toast.success("Grupo criado");
    await refresh();
    navigate({ to: "/grupos/$id", params: { id: (data as any).id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Meus Grupos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Criar Grupo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Criar Grupo</DialogTitle></DialogHeader>
            <form onSubmit={criar} className="space-y-4">
              <div>
                <Label htmlFor="gn">Nome do grupo</Label>
                <Input id="gn" required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pelada da Quarta" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  {loading ? "Criando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {grupos.length === 0 ? (
        <EmptyState icon={Shield} title="Nenhum grupo ainda" description="Crie seu primeiro grupo para começar a organizar peladas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {grupos.map((g) => (
            <Link key={g.id} to="/grupos/$id" params={{ id: g.id }} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></div>
              <div className="font-bold">{g.nome}</div>
              <div className="mt-1 text-xs text-muted-foreground">Código: {g.codigo_convite}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {g.membros} membros</span>
                {g.proxima && (
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {g.proxima.data.split("-").reverse().join("/")} {g.proxima.horario_inicio.slice(0,5)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
