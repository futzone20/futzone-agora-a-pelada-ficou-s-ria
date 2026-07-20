import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SKILLS = [
  { key: "velocidade", emoji: "⚡", label: "Velocidade" },
  { key: "drible", emoji: "🎯", label: "Drible" },
  { key: "passe", emoji: "🤝", label: "Passe" },
  { key: "chute", emoji: "👟", label: "Chute" },
  { key: "resistencia", emoji: "💪", label: "Resistência" },
  { key: "posicionamento", emoji: "📍", label: "Posicionamento" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  avaliado: { user_id: string; nome: string; foto_url?: string | null };
  grupoId: string;
  onDone?: () => void;
};

export function AvaliarMembroModal({ open, onClose, avaliado, grupoId, onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"escolha" | "skills">("escolha");
  const [vals, setVals] = useState<Record<string, number>>({
    velocidade: 3, drible: 3, passe: 3, chute: 3, resistencia: 3, posicionamento: 3,
  });
  const [saving, setSaving] = useState(false);
  const media = SKILLS.reduce((a, s) => a + (vals[s.key] || 0), 0) / SKILLS.length;
  const initials = (avaliado.nome || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const naoConheco = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("avaliacoes_skill_membro").insert({
      avaliador_id: user.id, avaliado_id: avaliado.user_id, grupo_id: grupoId,
      tipo: "conhecimento_previo", conhece_jogador: false,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marcamos para avaliar depois");
    onDone?.(); onClose();
  };

  const enviar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("avaliacoes_skill_membro").insert({
      avaliador_id: user.id, avaliado_id: avaliado.user_id, grupo_id: grupoId,
      tipo: "conhecimento_previo", conhece_jogador: true, ...vals,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Avaliação enviada! +8 pontos");
    onDone?.(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader><DialogTitle>Avaliar Novo Membro</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            {avaliado.foto_url ? <AvatarImage src={avaliado.foto_url} /> : null}
            <AvatarFallback className="bg-secondary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-bold text-lg">{avaliado.nome}</div>
            <div className="text-xs text-muted-foreground">Você conhece o nível dele?</div>
          </div>
        </div>

        {step === "escolha" && (
          <div className="grid gap-2 mt-2">
            <Button onClick={() => setStep("skills")} className="bg-primary text-primary-foreground h-12 font-bold">
              ✅ Conheço este jogador
            </Button>
            <Button onClick={naoConheco} disabled={saving} variant="outline" className="h-12">
              ⏳ Não conheço ainda, vou avaliar depois
            </Button>
          </div>
        )}

        {step === "skills" && (
          <div className="space-y-4">
            {SKILLS.map((s) => (
              <div key={s.key}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">{s.emoji} {s.label}</span>
                  <span className="font-bold text-primary">{vals[s.key]}</span>
                </div>
                <Slider min={1} max={5} step={1} value={[vals[s.key]]}
                  onValueChange={(v) => setVals({ ...vals, [s.key]: v[0] })} />
              </div>
            ))}
            <div className="rounded-xl bg-secondary/40 p-3 text-center">
              <div className="text-xs text-muted-foreground">Nível geral</div>
              <div className="text-3xl font-extrabold text-primary">{media.toFixed(1)}</div>
            </div>
            <Button onClick={enviar} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold">
              {saving ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
