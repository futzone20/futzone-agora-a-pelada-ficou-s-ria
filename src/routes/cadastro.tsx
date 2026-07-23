import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, rolePath, type UserRole } from "@/lib/auth";
import { toast } from "sonner";
import { User, Building2, Gift, Crown } from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  component: SignupPage,
});

const ACCOUNT_TYPES: { value: Exclude<UserRole, "admin">; label: string; icon: any; desc: string }[] = [
  { value: "jogador", label: "Jogador", icon: User, desc: "Participe de peladas e suba no ranking." },
  { value: "capitao", label: "Capitão", icon: Crown, desc: "Organize peladas e crie grupos." },
  { value: "dono", label: "Dono de Quadra", icon: Building2, desc: "Gerencie quadras, agendamentos e PDV." },
  { value: "parceiro", label: "Parceiro Fidelidade", icon: Gift, desc: "Ofereça resgates e fidelize jogadores." },
];

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "", email: "", whatsapp: "", nascimento: "", password: "", confirm: "",
  });
  const [goleiro, setGoleiro] = useState(false);
  const [role, setRole] = useState<typeof ACCOUNT_TYPES[number]["value"]>("jogador");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("As senhas não coincidem");
    if (form.password.length < 6) return toast.error("Senha mínima de 6 caracteres");
    setLoading(true);
    try {
      const u = await signUp({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp,
        nascimento: form.nascimento,
        password: form.password,
        role,
        goleiro,
      });
      toast.success("Conta criada!");
      const invite = typeof window !== "undefined" ? sessionStorage.getItem("mrfut_invite") : null;
      const peladaToken = typeof window !== "undefined" ? sessionStorage.getItem("mrfut_pelada_confirmacao") : null;
      if (invite) { sessionStorage.removeItem("mrfut_invite"); navigate({ to: "/convite/$codigo", params: { codigo: invite } }); }
      else if (peladaToken) { sessionStorage.removeItem("mrfut_pelada_confirmacao"); navigate({ to: "/pelada-confirmar/$token", params: { token: peladaToken } }); }
      else navigate({ to: rolePath(u.role) });
    } catch (err: any) {
      toast.error(err.message || "Erro no cadastro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold">Criar conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Junte-se à MRFUT.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="wpp">WhatsApp</Label>
                <Input id="wpp" type="tel" placeholder="(11) 99999-9999" required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="dob">Data de nascimento</Label>
              <Input id="dob" type="date" required value={form.nascimento} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pwd">Senha</Label>
                <Input id="pwd" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cpwd">Confirmar senha</Label>
                <Input id="cpwd" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3">
              <Checkbox id="gk" checked={goleiro} onCheckedChange={(v) => setGoleiro(!!v)} />
              <Label htmlFor="gk" className="cursor-pointer text-sm font-normal">Quero me cadastrar como Goleiro também</Label>
            </div>

            <div>
              <Label className="mb-2 block">Tipo de conta</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACCOUNT_TYPES.map((t) => {
                  const active = role === t.value;
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setRole(t.value)}
                      className={`rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/50"}`}
                    >
                      <t.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="mt-2 text-sm font-bold">{t.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
              {role === "capitao" && (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  👑 Capitães organizam peladas, criam grupos e ganham pontos em dobro. Para manter o role de Capitão, seu grupo precisa ter ao menos 10 jogadores ativos e realizar peladas regularmente.
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
