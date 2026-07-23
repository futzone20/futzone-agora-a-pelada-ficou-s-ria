import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function CentralMensagensCard() {
  const { user } = useAuth();
  const [whatsappConectado, setWhatsappConectado] = useState(false);
  const [whatsappNumero, setWhatsappNumero] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("whatsapp_conectado, whatsapp_numero").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setWhatsappConectado(!!(data as any)?.whatsapp_conectado);
        setWhatsappNumero((data as any)?.whatsapp_numero || null);
      });
  }, [user?.id]);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MessageCircle className="h-4 w-4 text-primary" /> Central de Mensagens (WhatsApp)
        </div>
        <p className="text-xs text-muted-foreground">
          Conecte seu WhatsApp uma única vez pra futuramente enviar convites e avisos de pelada automaticamente pros jogadores de todos os grupos que você administra.
        </p>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${whatsappConectado ? "bg-primary" : "bg-muted-foreground"}`} />
          <span className="text-xs font-bold">{whatsappConectado ? `Conectado${whatsappNumero ? " — " + whatsappNumero : ""}` : "Não conectado"}</span>
        </div>
        <Button variant="secondary" onClick={() => setWhatsappOpen(true)}>
          <QrCode className="mr-2 h-4 w-4" />{whatsappConectado ? "Reconectar" : "Conectar WhatsApp"}
        </Button>
      </div>

      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> Conectar WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30">
              <div className="text-center text-muted-foreground">
                <QrCode className="mx-auto mb-2 h-10 w-10" />
                <p className="text-xs">QR Code aparece aqui quando a conexão estiver disponível</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Essa função ainda está em construção. Em breve você vai poder escanear um QR Code aqui pra conectar seu WhatsApp e enviar convites e avisos de pelada automaticamente pros jogadores dos seus grupos.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
