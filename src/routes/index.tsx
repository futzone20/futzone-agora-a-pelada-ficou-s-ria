import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Users, Shuffle, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Logo className="text-xl" />
        <nav className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" className="text-foreground">Entrar</Button></Link>
          <Link to="/cadastro"><Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Criar conta</Button></Link>
        </nav>
      </header>

      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center md:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(0,255,135,0.15),transparent_60%)]" />
        <Logo className="text-5xl md:text-7xl animate-fade-in-up" />
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl animate-fade-in-up">
          A pelada ficou <span className="text-primary font-bold">séria.</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Organize peladas, sorteie times equilibrados e gamifique cada jogo com pontos, conquistas e rankings.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/cadastro">
            <Button size="lg" className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 animate-pulse-glow">Criar conta grátis</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="border-border">Entrar</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 md:grid-cols-3">
        {[
          { icon: Users, title: "Organize", desc: "Crie grupos, convide jogadores e marque peladas em segundos." },
          { icon: Shuffle, title: "Sorteie", desc: "Times equilibrados automaticamente, baseados em skills." },
          { icon: Trophy, title: "Gamifique", desc: "Pontos, ofensivas, conquistas e rankings da galera." },
        ].map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">{b.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        FUTZONE © {new Date().getFullYear()} — A pelada ficou séria.
      </footer>
    </div>
  );
}
