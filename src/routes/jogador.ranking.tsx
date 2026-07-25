import { createFileRoute } from "@tanstack/react-router";
import { RankingScreen } from "@/components/RankingScreen";

export const Route = createFileRoute("/jogador/ranking")({ component: RankingScreen });
