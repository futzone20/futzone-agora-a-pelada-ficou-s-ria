import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, MapPin, Handshake, Megaphone, Gamepad2, DollarSign, MessageSquare } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth allow={["admin"]}>
      <DashboardShell title="Super Admin" items={[
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/usuarios", label: "Usuários", icon: Users },
        { to: "/admin/quadras", label: "Quadras", icon: MapPin },
        { to: "/admin/parceiros", label: "Parceiros", icon: Handshake },
        { to: "/admin/ads", label: "ADS / Anunciantes", icon: Megaphone },
        { to: "/admin/gamificacao", label: "Gamificação", icon: Gamepad2 },
        { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
        { to: "/admin/comunicacao", label: "Comunicação", icon: MessageSquare },
      ] as any}>
        <Outlet />
      </DashboardShell>
    </RequireAuth>
  ),
});
