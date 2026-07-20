import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { User } from "lucide-react";

export const Route = createFileRoute("/dono/perfil")({
  component: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Perfil</h2>
      <EmptyState icon={User} title="Perfil em construção" description="Dados do estabelecimento." />
    </div>
  ),
});
