import { createFileRoute } from "@tanstack/react-router";
import { PerfilCompleto } from "@/components/PerfilCompleto";
import { CentralMensagensCard } from "@/components/CentralMensagensCard";

export const Route = createFileRoute("/capitao/perfil")({
  component: () => (
    <div className="space-y-4">
      <CentralMensagensCard />
      <PerfilCompleto />
    </div>
  ),
});
