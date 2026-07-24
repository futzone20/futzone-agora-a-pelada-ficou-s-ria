import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Home, CircleDot, Radio, Trophy, User } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/jogador")({
  component: JogadorLayout,
});

const items = [
  { to: "/jogador", label: "Início", icon: Home },
  { to: "/jogador/peladas", label: "Peladas", icon: CircleDot },
  { to: "/jogador/peladas", label: "Ao vivo", icon: Radio, destaque: true },
  { to: "/jogador/ranking", label: "Ranking", icon: Trophy },
  { to: "/jogador/perfil", label: "Perfil", icon: User },
];

function JogadorLayout() {
  return (
    <RequireAuth allow={["jogador"]}>
      <MobileShell items={items as any}><Outlet /></MobileShell>
    </RequireAuth>
  );
}
