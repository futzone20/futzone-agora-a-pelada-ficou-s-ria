import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DashboardShell({ items, title, children }: { items: NavItem[]; title: string; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const handleSignOut = () => { signOut(); navigate({ to: "/" }); };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-5 py-4"><Logo className="text-lg" /></div>
      <div className="px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((it) => {
          const active = path === it.to;
          return (
            <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-2 px-2 text-xs text-muted-foreground">{user?.email}</div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">{sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
            <h1 className="text-base font-bold">{title}</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
