import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Store, Gift, CheckCircle, BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/parceiro")({
  component: () => (
    <RequireAuth allow={["parceiro"]}>
      <DashboardShell title="Parceiro Fidelidade" items={[
        { to: "/parceiro", label: "Perfil", icon: Store },
        { to: "/parceiro/catalogo", label: "Catálogo", icon: Gift },
        { to: "/parceiro/resgates", label: "Resgates", icon: CheckCircle },
        { to: "/parceiro/relatorios", label: "Relatórios", icon: BarChart3 },
      ] as any}>
        <Outlet />
      </DashboardShell>
    </RequireAuth>
  ),
});
