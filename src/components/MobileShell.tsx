import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

type Notif = { id: string; titulo: string; mensagem: string; lida: boolean; criado_em: string; tipo: string };

export function MobileShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const loadNotifs = async () => {
    if (!user) return;
    const { data } = await supabase.from("notificacoes").select("*").eq("user_id", user.id).order("criado_em", { ascending: false }).limit(20);
    setNotifs((data as any) || []);
  };

  useEffect(() => { void loadNotifs(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` }, () => { void loadNotifs(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = notifs.filter((n) => !n.lida).length;

  const markAll = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notificacoes").update({ lida: true } as never).eq("user_id", user.id).eq("lida", false);
    void loadNotifs();
  };

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-none bg-[#0D0D0D] px-4 py-3">
        <div className="text-lg font-bold">FUT<span className="text-[#00FF87]">Z</span>ONE</div>
        <div className="flex items-center gap-1">
          <Sheet open={openNotif} onOpenChange={(o) => { setOpenNotif(o); if (o) void markAll(); }}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent className="border-l border-white/10 bg-[#0D0D0D]">
              <SheetHeader><SheetTitle className="text-white">Notificações</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-0 divide-y divide-[#2A2A2A]">
                {notifs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-500">Nenhuma notificação por enquanto.</div>
                ) : notifs.map((n) => {
                  const getNotifIcon = (tipo: string) => {
                    switch (tipo) {
                      case 'novo_selo': return { char: '🏅', color: 'bg-[#2D4A1E] text-white' };
                      case 'resultado_pelada': return { char: '🏆', color: 'bg-[#4A3500] text-white' };
                      case 'nova_pelada': return { char: '👥', color: 'bg-[#1A2D4A] text-white' };
                      case 'rivalidade': return { char: '⚡', color: 'bg-[#4A1A1A] text-white' };
                      default: return { char: '🔔', color: 'bg-[#2A2A2A] text-white' };
                    }
                  };
                  const iconData = getNotifIcon(n.tipo);
                  return (
                    <div key={n.id} className="flex gap-4 py-4 transition hover:bg-white/[0.02]">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${iconData.color}`}>
                        {iconData.char}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-bold text-white leading-tight">{n.titulo}</p>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(n.criado_em), { addSuffix: false, locale: ptBR }).replace('cerca de ', '').replace('menos de um minuto', 'agora')}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 leading-normal">
                          {n.mensagem}
                        </p>
                      </div>
                      {!n.lida && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00FF87]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#2A2A2A] bg-[#0D0D0D]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
          {items.map((it) => {
            const active = path === it.to || (it.to !== "/" && path.startsWith(it.to + "/"));
            return (
              <Link key={it.to} to={it.to} className={`flex flex-col items-center gap-1 px-3 py-3 text-[10px] font-bold uppercase transition ${active ? "text-[#00FF87]" : "text-[#666] hover:text-foreground"}`}>
                <it.icon className={`h-5 w-5 ${active ? "text-[#00FF87]" : ""}`} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
