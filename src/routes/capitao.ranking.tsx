import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { Trophy } from "lucide-react";
export const Route = createFileRoute("/capitao/ranking")({
  component: () => (<div className="space-y-4"><h2 className="text-xl font-bold">Ranking</h2><EmptyState icon={Trophy} title="Ranking em breve" /></div>),
});
