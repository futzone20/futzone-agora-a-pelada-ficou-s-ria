import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, MapPin, Calendar, ShoppingCart, DollarSign, Percent, User, Package, Building } from "lucide-react";
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
        { to: "/dono/pdv", label: "PDV", icon: ShoppingCart },
        { to: "/dono/produtos", label: "Produtos", icon: Package },
        { to: "/dono/financeiro", label: "Financeiro", icon: DollarSign },
        { to: "/dono/cashback", label: "Cashback", icon: Percent },
        { to: "/dono/perfil", label: "Perfil", icon: User },
      ] as any}>
        <Outlet />
      </DashboardShell>
    </RequireAuth>
  ),
});
