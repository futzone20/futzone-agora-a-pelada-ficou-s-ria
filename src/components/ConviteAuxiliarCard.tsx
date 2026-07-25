import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function ConviteAuxiliarCard({ peladaId, onChange }: { peladaId: string; onChange?: () => void }) {
  const { user } = useAuth();
  const [convite, setConvite] = useState<{ id: string } | null>(null);
  const [respondendo, setRespondendo] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("pelada_auxiliares")
      .select("id")
      .eq("pelada_id", peladaId)
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .maybeSingle();
    setConvite(data as any);
  };

  useEffect(() => { void load(); }, [peladaId, user?.id]);

  const responder = async (aceitar: boolean) => {
    if (!convite) return;
    setRespondendo(true);
    const { error } = await (supabase as any).rpc("responder_convite_auxiliar", { _id: convite.id, _aceitar: aceitar });
    setRespondendo(false);
    if (error) return toast.error(error.message);
    toast.success(aceitar ? "Você é auxiliar dessa pelada! O Painel de Lances já está liberado pra você." : "Convite recusado.");
    setConvite(null);
    onChange?.();
  };

  if (!convite) return null;

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 space-y-2">
      <div className="flex items-center gap-2 font-bold text-primary"><Target className="h-4 w-4" /> Convite pra ser auxiliar</div>
      <p className="text-xs text-muted-foreground">O capitão te chamou pra marcar os lances (gol, passe, defesa...) nessa pelada. Aceita?</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => responder(true)} disabled={respondendo} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          <Check className="mr-1.5 h-4 w-4" /> Aceitar
        </Button>
        <Button onClick={() => responder(false)} disabled={respondendo} variant="outline">
          <X className="mr-1.5 h-4 w-4" /> Recusar
        </Button>
      </div>
    </div>
  );
}
