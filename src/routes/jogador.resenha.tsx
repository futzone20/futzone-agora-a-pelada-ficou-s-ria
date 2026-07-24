import { createFileRoute } from "@tanstack/react-router";
import { ResenhaFeed } from "@/components/ResenhaFeed";

export const Route = createFileRoute("/jogador/resenha")({
  component: ResenhaFeed,
});
