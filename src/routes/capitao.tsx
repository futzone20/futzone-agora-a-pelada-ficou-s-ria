import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireAuth } from "@/components/RequireAuth";
import { getNavItems } from "@/lib/navItems";

export const Route = createFileRoute("/capitao")({
  component: CapitaoLayout,
});

function CapitaoLayout() {
  return (
    <RequireAuth allow={["capitao"]}>
      <MobileShell items={getNavItems("capitao")}><Outlet /></MobileShell>
    </RequireAuth>
  );
}
