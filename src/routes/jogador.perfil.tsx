import { createFileRoute } from "@tanstack/react-router";
import { PerfilCompleto } from "@/components/PerfilCompleto";

export const Route = createFileRoute("/jogador/perfil")({
  component: PerfilCompleto,
});
