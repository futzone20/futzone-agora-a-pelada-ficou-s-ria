import { createFileRoute } from "@tanstack/react-router";
import { PeladasDashboard } from "@/components/PeladasDashboard";

export const Route = createFileRoute("/jogador/peladas")({
  component: PeladasDashboard,
});
