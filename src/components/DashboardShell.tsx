import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, ChevronsLeft, ChevronsRight, Circle, ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SIDEBAR_COLLAPSE_KEY = "dashboard_sidebar_collapsed";

export function DashboardShell({ items, title, children }: { items: NavItem[]; title: string; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const handleSignOut = () => { signOut(); navigate({ to: "/" }); };

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  // A tela de PDV abre em modo "fullscreen": sem o menu lateral, aproveitando
  // a tela toda (pensado pra uso num tablet/balcão de venda).
  const telaCheia = path === "/dono/pdv";

  const sidebar = (
    <aside className={`flex h-full flex-col border-r border-border bg-card transition-[width] duration-150 ${collapsed ? "w-16" : "w-64"}`}>
      <div className="border-b border-border px-5 py-4 flex items-center justify-center">
        {collapsed ? <Circle className="h-5 w-5 text-primary" strokeWidth={2.5} /> : <Logo className="text-lg" />}
      </div>
      {!collapsed && <div className="px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>}
      <nav className="flex-1 space-y-1 px-3 pt-2">
        {items.map((it) => {
          const active = path === it.to;
          return (
            <Link key={it.to} to={it.to} onClick={() => setOpen(false)} title={collapsed ? it.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${collapsed ? "justify-center px-0" : ""} ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <it.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{it.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 space-y-1">
        {!collapsed && <div className="mb-1 px-2 text-xs text-muted-foreground truncate">{user?.email}</div>}
        <Button variant="ghost" className={`w-full text-muted-foreground ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`} onClick={handleSignOut} title={collapsed ? "Sair" : undefined}>
          <LogOut className="h-4 w-4 shrink-0" /> {!collapsed && "Sair"}
        </Button>
        <Button variant="ghost" className={`w-full text-muted-foreground hidden md:flex ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`} onClick={toggleCollapsed} title={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronsRight className="h-4 w-4 shrink-0" /> : <><ChevronsLeft className="h-4 w-4 shrink-0" /> Recolher</>}
        </Button>
      </div>
    </aside>
  );

  if (telaCheia) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dono" })}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-base font-bold">PDV</h1>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6">{children}</main>
      </div>
    );
  }

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
