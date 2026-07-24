import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireAuth } from "@/components/RequireAuth";
import { getNavItems } from "@/lib/navItems";

export const Route = createFileRoute("/jogador")({
  component: JogadorLayout,
});

function JogadorLayout() {
  return (
    <RequireAuth allow={["jogador"]}>
      <MobileShell items={getNavItems("jogador")}><Outlet /></MobileShell>
    </RequireAuth>
  );
}
