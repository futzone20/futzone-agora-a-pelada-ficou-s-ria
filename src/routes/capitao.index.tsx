import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Flame, Star, CircleDot } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/capitao/")({
  component: Inicio,
});

function Inicio() {
  const { user } = useAuth();
  const first = user?.nome.split(" ")[0] || "capitão";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bem-vindo, capitão</p>
        <h2 className="text-2xl font-bold">{first} 👋</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Star className="h-4 w-4" /></div>
          <div className="text-xs text-muted-foreground">Seus pontos</div>
          <div className="mt-1 text-2xl font-extrabold">0</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Flame className="h-4 w-4" /></div>
          <div className="text-xs text-muted-foreground">Sua ofensiva</div>
          <div className="mt-1 text-2xl font-extrabold">0 <span className="text-sm font-medium text-muted-foreground">dias</span></div>
        </div>
      </div>
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Próximas peladas</h3>
        <EmptyState icon={CircleDot} title="Nenhuma pelada agendada" description="Crie um grupo e marque a próxima pelada." />
      </section>
    </div>
  );
}
