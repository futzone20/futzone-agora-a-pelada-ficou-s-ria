import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, MapPin, Calendar, ShoppingCart, DollarSign, Percent, User, Package, Building, Megaphone } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/dono")({
  component: () => (
    <RequireAuth allow={["dono"]}>
      <DashboardShell title="Dono de Quadra" items={[
        { to: "/dono", label: "Dashboard", icon: LayoutDashboard },
        { to: "/dono/arena", label: "Arena", icon: Building },
        { to: "/dono/quadras", label: "Quadras", icon: MapPin },
        { to: "/dono/agendamentos", label: "Agenda", icon: Calendar },
        { to: "/dono/anunciantes", label: "Anunciantes", icon: Megaphone },
        { to: "/dono/pdv", label: "PDV", icon: ShoppingCart },
        { to: "/dono/produtos", label: "Produtos", icon: Package },
        { to: "/dono/financeiro", label: "Financeiro", icon: DollarSign, children: [
          { to: "/dono/financeiro", label: "Resumo" },
          { to: "/dono/financeiro/entradas", label: "Entradas" },
          { to: "/dono/financeiro/saidas", label: "Saídas" },
          { to: "/dono/financeiro/fornecedores", label: "Fornecedores" },
        ] },
        { to: "/dono/cashback", label: "Cashback", icon: Percent },
        { to: "/dono/perfil", label: "Perfil", icon: User },
      ] as any}>
        <Outlet />
      </DashboardShell>
    </RequireAuth>
  ),
});
