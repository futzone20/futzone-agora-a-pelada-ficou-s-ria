import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, rolePath } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/completar-cadastro")({
  component: CompletarCadastroPage,
  head: () => ({
    meta: [
      { title: "Completar cadastro · MRFUT" },
      { name: "description", content: "Complete seu cadastro no MRFUT para acessar sua conta." },
      { property: "og:title", content: "Completar cadastro · MRFUT" },
      { property: "og:description", content: "Complete seu cadastro no MRFUT para acessar sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Estado = "entrando" | "invalido" | "pronto" | "salvando" | "concluido";

function CompletarCadastroPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("entrando");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const e = params.get("e");
      const p = params.get("p");
      if (!e || !p) { setEstado("invalido"); return; }
      let tempEmail = "", tempPassword = "";
      try {
        tempEmail = atob(decodeURIComponent(e));
        tempPassword = atob(decodeURIComponent(p));
      } catch {
        setEstado("invalido"); return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: tempEmail, password: tempPassword });
      if (error || !data.user) { setEstado("invalido"); return; }
      const { data: prof } = await supabase.from("profiles").select("nome, cadastro_completo").eq("user_id", data.user.id).maybeSingle();
      if ((prof as any)?.cadastro_completo) {
        setEstado("concluido");
        return;
      }
      setNome((prof as any)?.nome || "");
      setEstado("pronto");
    })();
  }, []);

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    if (senha.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmarSenha) return toast.error("As senhas não coincidem.");
    setEstado("salvando");
    try {
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim().toLowerCase(), password: senha });
      if (authError) throw new Error(authError.message);

      const { error: profError } = await supabase.from("profiles").update({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        cadastro_completo: true,
      } as never).eq("user_id", user.id);
      if (profError) throw new Error(profError.message);

      await refresh();
      toast.success("Cadastro completo! Bem-vindo(a) ao MRFUT.");
      navigate({ to: rolePath(user.role) });
    } catch (err: any) {
      toast.error(err.message || "Não foi possível salvar seu cadastro.");
      setEstado("pronto");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6">
          {estado === "entrando" && (
            <p className="text-sm text-muted-foreground">Verificando seu convite...</p>
          )}

          {estado === "invalido" && (
            <>
              <h1 className="text-xl font-bold">Link inválido</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Esse link de convite não existe, expirou ou já foi utilizado. Peça ao capitão do grupo para te enviar um novo, ou crie sua conta normalmente.
              </p>
              <Button asChild className="mt-6 w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                <Link to="/cadastro">Criar conta</Link>
              </Button>
            </>
          )}

          {estado === "concluido" && (
            <>
              <h1 className="text-xl font-bold">Cadastro já concluído</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Essa conta já teve o cadastro completado. Faça login normalmente.
              </p>
              <Button asChild className="mt-6 w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                <Link to="/login">Entrar</Link>
              </Button>
            </>
          )}

          {(estado === "pronto" || estado === "salvando") && (
            <>
              <h1 className="text-xl font-bold">Complete seu cadastro</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Seu capitão já te adicionou no grupo. Só falta você definir seu e-mail e senha pra acessar sua conta.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="cn-nome">Nome</Label>
                  <Input id="cn-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cn-email">Email</Label>
                  <Input id="cn-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cn-wpp">WhatsApp</Label>
                  <Input id="cn-wpp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 91234-5678" />
                </div>
                <div>
                  <Label htmlFor="cn-senha">Crie uma senha</Label>
                  <Input id="cn-senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cn-senha2">Confirme a senha</Label>
                  <Input id="cn-senha2" type="password" required value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
                </div>
                <Button type="submit" disabled={estado === "salvando"} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  {estado === "salvando" ? "Salvando..." : "Concluir cadastro"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
