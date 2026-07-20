import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/recuperar-senha")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6">
          {!sent ? (
            <>
              <h1 className="text-xl font-bold">Recuperar senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enviaremos um link de recuperação.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) { toast.error(error.message); return; }
                  setSent(true);
                }}
                className="mt-6 space-y-4"
              >
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  Enviar link de recuperação
                </Button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold">Email enviado</h2>
              <p className="mt-1 text-sm text-muted-foreground">Se houver uma conta para <span className="text-foreground">{email}</span>, você receberá o link em instantes.</p>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline font-medium">Voltar para o login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
