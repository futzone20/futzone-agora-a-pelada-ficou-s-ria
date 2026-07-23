import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Crown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type Convite = {
  id: string;
  grupo_id: string;
  capitao_id: string;
  criado_em: string;
  expira_em: string;
  grupo_nome: string;
  capitao_nome: string;
};

export function ConvitesGrupoCard() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("convites_grupo")
      .select("id, grupo_id, capitao_id, criado_em, expira_em")
      .eq("convidado_id", user.id)
      .eq("status", "pendente")
      .gt("expira_em", new Date().toISOString())
      .order("criado_em", { ascending: false });
    if (error || !data || data.length === 0) { setConvites([]); return; }
    const grupoIds = Array.from(new Set(data.map((c: any) => c.grupo_id)));
    const capIds = Array.from(new Set(data.map((c: any) => c.capitao_id)));
    const [{ data: grupos }, { data: profs }] = await Promise.all([
      supabase.from("grupos").select("id, nome").in("id", grupoIds),
      supabase.from("profiles").select("user_id, nome").in("user_id", capIds),
    ]);
    const gmap: Record<string, string> = {};
    (grupos || []).forEach((g: any) => { gmap[g.id] = g.nome; });
    const pmap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { pmap[p.user_id] = p.nome; });
    setConvites(data.map((c: any) => ({
      ...c,
      grupo_nome: gmap[c.grupo_id] || "Grupo",
      capitao_nome: pmap[c.capitao_id] || "Capitão",
    })));
  };

  useEffect(() => { void load(); }, [user?.id]);

  const aceitar = async (id: string) => {
    setLoadingId(id);
    const { data, error } = await supabase.rpc("aceitar_convite_grupo", { _convite_id: id } as never);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Convite aceito!");
    await refresh();
    await load();
    if (data) navigate({ to: "/grupos/$id", params: { id: data as string } });
  };

  const recusar = async (id: string) => {
    setLoadingId(id);
    const { error } = await supabase.rpc("recusar_convite_grupo", { _convite_id: id } as never);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Convite recusado");
    await load();
  };

  if (convites.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Convites de grupo</h3>
      <div className="space-y-2">
        {convites.map((c) => (
          <div key={c.id} className="rounded-2xl border border-primary/40 bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Crown className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{c.grupo_nome}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">{c.capitao_nome}</span> te convidou para entrar no grupo
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => aceitar(c.id)}
                disabled={loadingId === c.id}
                className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90"
              >
                <Check className="mr-1 h-4 w-4" /> Aceitar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => recusar(c.id)}
                disabled={loadingId === c.id}
                className="flex-1"
              >
                <X className="mr-1 h-4 w-4" /> Recusar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
