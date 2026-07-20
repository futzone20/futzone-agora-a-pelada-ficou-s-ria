import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Home, CircleDot, MessageCircle, Trophy, User, Shield } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/capitao")({
  component: CapitaoLayout,
});

const items = [
  { to: "/capitao", label: "Início", icon: Home },
  { to: "/capitao/peladas", label: "Peladas", icon: CircleDot },
  { to: "/capitao/grupos", label: "Grupos", icon: Shield },
  { to: "/capitao/resenha", label: "Resenha", icon: MessageCircle },
  { to: "/capitao/ranking", label: "Ranking", icon: Trophy },
  { to: "/capitao/perfil", label: "Perfil", icon: User },
];

function CapitaoLayout() {
  return (
    <RequireAuth allow={["capitao"]}>
      <MobileShell items={items as any}><Outlet /></MobileShell>
    </RequireAuth>
  );
}
