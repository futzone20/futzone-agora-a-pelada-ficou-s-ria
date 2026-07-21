import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, rolePath } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await signIn(email.trim().toLowerCase(), password);
      toast.success(`Bem-vindo, ${u.nome.split(" ")[0]}!`);
      const invite = typeof window !== "undefined" ? sessionStorage.getItem("mrfut_invite") : null;
      if (invite) { sessionStorage.removeItem("mrfut_invite"); navigate({ to: "/convite/$codigo", params: { codigo: invite } }); }
      else navigate({ to: rolePath(u.role) });
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta MRFUT.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="text-right">
              <Link to="/recuperar-senha" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta? <Link to="/cadastro" className="text-primary hover:underline font-medium">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
