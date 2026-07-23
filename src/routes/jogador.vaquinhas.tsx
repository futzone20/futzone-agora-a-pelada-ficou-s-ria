import { createFileRoute } from "@tanstack/react-router";
import { CaixinhaDoTime } from "@/components/CaixinhaDoTime";

export const Route = createFileRoute("/jogador/vaquinhas")({
  component: CaixinhaDoTime,
});
