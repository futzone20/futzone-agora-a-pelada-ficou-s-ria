import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Send } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { criarPostJogador } from "@/lib/postJogador";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Quando true, esse item vira um botão circular flutuante e brilhante no meio da barra
   *  (usado pro item "Ao vivo"), em vez do ícone+texto padrão. */
  destaque?: boolean;
}

type Notif = { id: string; titulo: string; mensagem: string; lida: boolean; criado_em: string; tipo: string; link: string | null };

export function MobileShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [quickTexto, setQuickTexto] = useState("");
  const [quickGrupos, setQuickGrupos] = useState<{ id: string; nome: string }[]>([]);
  const [quickGrupoSel, setQuickGrupoSel] = useState("");
  const [quickEnviando, setQuickEnviando] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdAtivadoRef = useRef(false);

  const abrirPostRapido = async () => {
    if (!user) return;
    holdAtivadoRef.current = true;
    if (quickGrupos.length === 0) {
      const { data: gms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo");
      const gruposIds = Array.from(new Set((gms || []).map((g: any) => g.grupo_id)));
      if (gruposIds.length) {
        const { data: gs } = await supabase.from("grupos").select("id, nome").in("id", gruposIds);
        const lista = (gs as any[]) || [];
        setQuickGrupos(lista);
        setQuickGrupoSel(lista[0]?.id || "");
      }
    }
    setQuickPostOpen(true);
  };

  const enviarPostRapido = async () => {
    if (!user || !quickTexto.trim() || !quickGrupoSel) return;
    setQuickEnviando(true);
    const { error } = await criarPostJogador(user.id, quickGrupoSel, quickTexto);
    setQuickEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Postado na Resenha! 🎉");
    setQuickTexto("");
    setQuickPostOpen(false);
  };

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
        <div className="text-lg font-bold"><Logo /></div>
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
                      case 'comentario_feed': return { char: '💬', color: 'bg-[#1A2D4A] text-white' };
                      case 'reacao_feed': return { char: '👍', color: 'bg-[#1A2D4A] text-white' };
                      case 'mencao_feed': return { char: '📣', color: 'bg-[#4A3500] text-white' };
                      default: return { char: '🔔', color: 'bg-[#2A2A2A] text-white' };
                    }
                  };
                  const iconData = getNotifIcon(n.tipo);
                  const NotifWrapper = n.link && n.tipo !== "resultado_pelada" ? Link : "div";
                  const wrapperProps = n.link && n.tipo !== "resultado_pelada"
                    ? { to: n.link, onClick: () => setOpenNotif(false) }
                    : {};
                  return (
                    <NotifWrapper key={n.id} {...(wrapperProps as any)} className="flex gap-4 py-4 transition hover:bg-white/[0.02]">
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
                        {n.tipo === "resultado_pelada" && n.link && (
                          <Link
                            to={n.link}
                            onClick={() => setOpenNotif(false)}
                            className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#00FF87]/10 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-[#00FF87] hover:bg-[#00FF87]/20"
                          >
                            🏆 Ver Card da Vitória
                          </Link>
                        )}
                      </div>
                      {!n.lida && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00FF87]" />
                      )}
                    </NotifWrapper>
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
            if (it.destaque) {
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className="relative -mt-7 flex flex-col items-center gap-1.5 px-3 pb-2"
                  onPointerDown={() => {
                    holdAtivadoRef.current = false;
                    holdTimerRef.current = window.setTimeout(() => { void abrirPostRapido(); }, 500);
                  }}
                  onPointerUp={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; } }}
                  onPointerLeave={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; } }}
                  onClick={(e) => { if (holdAtivadoRef.current) { e.preventDefault(); holdAtivadoRef.current = false; } }}
                >
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#00FF87] bg-[#0D0D0D] shadow-[0_0_22px_rgba(0,255,135,0.7)]">
                    <div className="absolute inset-0 rounded-full bg-[#00FF87]/10 blur-md" />
                    <span className="relative text-2xl">⚽</span>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-[#00FF87]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#00FF87]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00FF87]" />
                    {it.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link key={it.to} to={it.to} className="relative flex flex-col items-center gap-1 px-3 py-3 text-[10px] font-bold uppercase transition">
                {active && (
                  <span className="absolute inset-x-0.5 inset-y-1 -z-10 rounded-2xl bg-gradient-to-b from-[#00FF87]/20 via-[#00FF87]/5 to-transparent" />
                )}
                <it.icon className={`h-5 w-5 transition ${active ? "text-[#00FF87]" : "text-[#666]"}`} />
                <span className={active ? "text-[#00FF87]" : "text-[#666]"}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Dialog open={quickPostOpen} onOpenChange={setQuickPostOpen}>
        <DialogContent className="bg-[#0D0D0D] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">📣 Postar na Resenha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Avatar className="h-9 w-9 shrink-0">
                {user?.foto_url ? <AvatarImage src={user.foto_url} /> : null}
                <AvatarFallback className="bg-[#2A2A2A] text-xs text-white">{(user?.nome || "?")[0]}</AvatarFallback>
              </Avatar>
              <textarea
                value={quickTexto}
                onChange={(e) => setQuickTexto(e.target.value.slice(0, 280))}
                placeholder="No que você está pensando, craque?"
                rows={3}
                autoFocus
                className="flex-1 resize-none rounded-lg bg-[#1A1A1A] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            {quickGrupos.length > 1 && (
              <select
                value={quickGrupoSel}
                onChange={(e) => setQuickGrupoSel(e.target.value)}
                className="w-full rounded-lg bg-[#1A1A1A] px-3 py-2 text-xs text-white outline-none"
              >
                {quickGrupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#666]">{280 - quickTexto.length}</span>
              <Button size="sm" onClick={enviarPostRapido} disabled={!quickTexto.trim() || quickEnviando || !quickGrupoSel} className="bg-[#00FF87] font-bold text-black hover:bg-[#00FF87]/90">
                <Send className="mr-1.5 h-3.5 w-3.5" /> {quickEnviando ? "Enviando..." : "Postar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
