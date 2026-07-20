import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jogador/parceiros/$slug")({ component: JogParcDet });

function JogParcDet() {
  const { slug } = useParams({ from: "/jogador/parceiros/$slug" });
  const { user } = useAuth();
  const [parc, setParc] = useState<any>(null);
  const [rec, setRec] = useState<any[]>([]);
  const [pontos, setPontos] = useState(0);
  const [confirm, setConfirm] = useState<any>(null);
  const [sucesso, setSucesso] = useState<any>(null);

  const load = async () => {
    const { data: p } = await supabase.from("parceiros").select("*").eq("slug", slug).maybeSingle();
    setParc(p);
    if (p) {
      const { data: r } = await supabase.from("parceiros_recompensas").select("*").eq("parceiro_id", (p as any).id).eq("ativo", true).order("pontos_necessarios");
      setRec(r ?? []);
    }
    if (user) {
      const { data: pr } = await supabase.from("profiles").select("pontos_total").eq("user_id", user.id).maybeSingle();
      setPontos((pr as any)?.pontos_total ?? 0);
    }
  };
  useEffect(() => { void load(); }, [slug, user?.id]);

  const clicar = async (r: any) => {
    await supabase.from("parceiros_cliques").insert({ recompensa_id: r.id, parceiro_id: parc.id, user_id: user?.id ?? null } as never);
    if (pontos >= r.pontos_necessarios) setConfirm(r);
    else toast.error(`Faltam ${r.pontos_necessarios - pontos} pontos`);
  };

  const resgatar = async () => {
    if (!user || !confirm) return;
    const { data, error } = await supabase.from("parceiros_resgates").insert({
      recompensa_id: confirm.id, parceiro_id: parc.id, user_id: user.id,
      pontos_debitados: confirm.pontos_necessarios, codigo_validacao: "",
    } as never).select().single();
    if (error) { toast.error(error.message); return; }
    setConfirm(null); setSucesso({ codigo: (data as any).codigo_validacao, recompensa: confirm });
    void load();
  };

  if (!parc) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-3">
      {parc.foto_capa_url && <img src={parc.foto_capa_url} className="w-full h-32 object-cover rounded-xl"/>}
      <div className="flex gap-3 items-center">
        <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">{parc.logo_url && <img src={parc.logo_url} className="w-full h-full object-cover"/>}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{parc.nome_estabelecimento}</h1>
          <p className="text-sm text-muted-foreground">{parc.categoria}</p>
          <p className="text-xs">{parc.endereco}</p>
        </div>
      </div>
      {parc.google_maps_url && <a href={parc.google_maps_url} target="_blank" rel="noreferrer" className="text-primary text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3"/>Como chegar</a>}

      <div className="text-sm">Seus pontos: <b>{pontos}</b></div>

      {rec.map(r => {
        const ok = pontos >= r.pontos_necessarios;
        const esgotado = r.quantidade_disponivel !== null && r.quantidade_resgatada >= r.quantidade_disponivel;
        return (
          <Card key={r.id} className="p-3">
            {r.foto_url && <img src={r.foto_url} className="w-full h-32 object-cover rounded mb-2"/>}
            <div className="font-bold">{r.nome}</div>
            <div className="text-xs text-muted-foreground">{r.descricao}</div>
            {r.regras && <div className="text-xs italic mt-1">{r.regras}</div>}
            <div className="flex items-center justify-between mt-2">
              <div className="text-primary font-bold">{r.pontos_necessarios} pts</div>
              {esgotado ? <Badge variant="destructive">Esgotado</Badge> : ok ? <Badge>Pontos suficientes ✓</Badge> : <Badge variant="outline">Faltam {r.pontos_necessarios - pontos}</Badge>}
            </div>
            {r.quantidade_disponivel !== null && <div className="text-xs text-muted-foreground mt-1">{r.quantidade_disponivel - r.quantidade_resgatada} restantes</div>}
            <Button onClick={()=>clicar(r)} disabled={!ok || esgotado || !user} className="w-full mt-2">Resgatar</Button>
          </Card>
        );
      })}

      <Dialog open={!!confirm} onOpenChange={o=>!o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar resgate</DialogTitle></DialogHeader>
          {confirm && <div className="space-y-3">
            <p>Usar <b>{confirm.pontos_necessarios} pontos</b> para resgatar <b>{confirm.nome}</b> em <b>{parc.nome_estabelecimento}</b>?</p>
            <Button onClick={resgatar} className="w-full">Confirmar</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sucesso} onOpenChange={o=>!o && setSucesso(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>✅ Resgate solicitado!</DialogTitle></DialogHeader>
          {sucesso && <div className="space-y-3 text-center">
            <p className="text-sm">Apresente o código abaixo ao parceiro:</p>
            <div className="text-2xl font-bold text-primary p-4 bg-primary/10 rounded-lg">{sucesso.codigo}</div>
            <p className="text-sm"><b>{parc.nome_estabelecimento}</b></p>
            <p className="text-xs text-muted-foreground">{parc.endereco}</p>
            {parc.google_maps_url && <a href={parc.google_maps_url} target="_blank" rel="noreferrer" className="text-primary text-sm">Ver no mapa</a>}
            <p className="text-xs text-rose-500">Este código expira em 48 horas.</p>
            <Button onClick={()=>setSucesso(null)} className="w-full">Fechar</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
