import { createFileRoute } from "@tanstack/react-router";
import { PerfilCompleto } from "@/components/PerfilCompleto";

export const Route = createFileRoute("/capitao/perfil")({
  component: PerfilCompleto,
});
