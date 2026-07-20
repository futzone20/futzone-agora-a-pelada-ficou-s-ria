import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { MessageCircle } from "lucide-react";
export const Route = createFileRoute("/capitao/resenha")({
  component: () => (<div className="space-y-4"><h2 className="text-xl font-bold">Resenha</h2><EmptyState icon={MessageCircle} title="Nenhuma resenha ainda" description="Jogue uma pelada para começar a interagir." /></div>),
});
