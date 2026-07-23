import { createFileRoute } from "@tanstack/react-router";
import { PeladasDashboard } from "@/components/PeladasDashboard";

export const Route = createFileRoute("/capitao/peladas")({
  component: PeladasDashboard,
});
