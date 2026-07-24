import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Home, CircleDot, Radio, Trophy, User } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/capitao")({
  component: CapitaoLayout,
});

const items = [
  { to: "/capitao", label: "Início", icon: Home },
  { to: "/capitao/peladas", label: "Peladas", icon: CircleDot },
  { to: "/capitao/peladas", label: "Ao vivo", icon: Radio, destaque: true },
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
