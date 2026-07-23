import { createFileRoute } from "@tanstack/react-router";
import { CaixinhaDoTime } from "@/components/CaixinhaDoTime";

export const Route = createFileRoute("/capitao/vaquinhas")({
  component: CaixinhaDoTime,
});
