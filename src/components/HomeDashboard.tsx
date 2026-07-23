import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell, MessageCircle, Calendar, Clock, MapPin, Users, BarChart3, ChevronRight,
  CalendarDays, Trophy, Zap, Radio,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { encerrarPeladasVencidas } from "@/lib/limpezaPeladas";
import { ConvitesGrupoCard } from "@/components/ConvitesGrupoCard";
import { CaixinhaEntradaCard } from "@/components/CaixinhaEntradaCard";

type PeladaResumo = {
  id: string; nome_pelada: string; data: string; horario_inicio: string; status: string;
  quadraNome: string | null;
  confirmados: number; capacidade: number;
};

// Fórmula simples (inventada agora, não existia antes): 1 nível a cada 200 pontos.
function nivelDe(pontos: number) {
  const nivel = Math.floor(pontos / 200) + 1;
  const pctNivel = ((pontos % 200) / 200) * 100;
  return { nivel, pctNivel };
}

export function HomeDashboard() {
  const { user } = useAuth();
  const base = user?.role === "capitao" ? "/capitao" : "/jogador";

  const [pontos, setPontos] = useState(0);
  const [ofensiva, setOfensiva] = useState(0);
  const [gruposCount, setGruposCount] = useState(0);
  const [alertasCount, setAlertasCount] = useState(0);
  const [aoVivo, setAoVivo] = useState<PeladaResumo | null>(null);
  const [proxima, setProxima] = useState<PeladaResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: prof }, { data: of }, { data: gm }] = await Promise.all([
        supabase.from("profiles").select("pontos_total").eq("user_id", user.id).maybeSingle(),
        supabase.from("ofensivas").select("sequencia_atual").eq("user_id", user.id).maybeSingle(),
        supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo"),
      ]);
      setPontos((prof as any)?.pontos_total || 0);
      setOfensiva((of as any)?.sequencia_atual || 0);

      const grupoIds = Array.from(new Set((gm || []).map((g: any) => g.grupo_id as string)));
      setGruposCount(grupoIds.length);

      const [{ count: notifsCount }, { count: convitesCount }] = await Promise.all([
        supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("lida", false),
        supabase.from("convites_grupo").select("id", { count: "exact", head: true }).eq("convidado_id", user.id).eq("status", "pendente"),
      ]);
      setAlertasCount((notifsCount || 0) + (convitesCount || 0));

      if (!grupoIds.length) { setLoading(false); return; }

      const { data: tj } = await supabase.from("time_jogadores").select("pelada_id").eq("user_id", user.id);
      const peladaIdsDoUsuario = Array.from(new Set((tj || []).map((x: any) => x.pelada_id as string)));
      if (peladaIdsDoUsuario.length) await encerrarPeladasVencidas(peladaIdsDoUsuario);

      const { data: peladas } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, status, quadra_id, jogadores_por_time, goleiros_por_time, numero_times")
        .in("grupo_id", grupoIds)
        .not("status", "eq", "cancelada")
        .order("data", { ascending: true });

      const aoVivoRaw = (peladas || []).find((p: any) => p.status === "em_andamento") || null;
      const proximaRaw = (peladas || [])
        .filter((p: any) => p.status === "aguardando" || p.status === "confirmada")
        .sort((a: any, b: any) => `${a.data}${a.horario_inicio}`.localeCompare(`${b.data}${b.horario_inicio}`))[0] || null;

      const relevantes = [aoVivoRaw, proximaRaw].filter(Boolean) as any[];
      const quadraIds = Array.from(new Set(relevantes.map((p) => p.quadra_id).filter(Boolean)));
      const peladaIds = relevantes.map((p) => p.id);

      const [{ data: quadras }, { data: confs }] = await Promise.all([
        quadraIds.length ? supabase.from("quadras_publicas").select("id, nome").in("id", quadraIds) : Promise.resolve({ data: [] as any[] }),
        peladaIds.length ? supabase.from("pelada_confirmacoes").select("pelada_id, status").in("pelada_id", peladaIds).eq("status", "confirmado") : Promise.resolve({ data: [] as any[] }),
      ]);
      const quadraMap: Record<string, string> = {};
      (quadras || []).forEach((q: any) => { quadraMap[q.id] = q.nome; });

      const montar = (p: any): PeladaResumo => ({
        id: p.id, nome_pelada: p.nome_pelada, data: p.data, horario_inicio: p.horario_inicio, status: p.status,
        quadraNome: p.quadra_id ? quadraMap[p.quadra_id] || null : null,
        confirmados: (confs || []).filter((c: any) => c.pelada_id === p.id).length,
        capacidade: (p.jogadores_por_time + p.goleiros_por_time) * p.numero_times,
      });

      setAoVivo(aoVivoRaw ? montar(aoVivoRaw) : null);
      setProxima(proximaRaw ? montar(proximaRaw) : null);
      setLoading(false);
    })();
  }, [user?.id]);

  const { nivel, pctNivel } = useMemo(() => nivelDe(pontos), [pontos]);
  const primeiroNome = user?.nome?.split(" ")[0] || "Jogador";

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-primary">
              {user?.foto_url ? <AvatarImage src={user.foto_url} /> : null}
              <AvatarFallback className="bg-secondary">{primeiroNome[0]}</AvatarFallback>
            </Avatar>
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
          </div>
          <div>
            <div className="font-bold">Fala, {primeiroNome}! 👋</div>
            <div className="text-xs text-muted-foreground">Pronto pra mais uma resenha?</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`${base}/perfil`} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border">
            <Bell className="h-4 w-4" />
            {alertasCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {alertasCount > 9 ? "9+" : alertasCount}
              </span>
            )}
          </Link>
          <Link to={`${base}/resenha`} className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
            <MessageCircle className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <ConvitesGrupoCard />
        <CaixinhaEntradaCard to={`${base}/vaquinhas` as any} />
      </div>

      {aoVivo ? (
        <Link
          to="/peladas/$id"
          params={{ id: aoVivo.id }}
          className="block rounded-2xl border border-primary bg-gradient-to-br from-primary/10 to-card p-5 shadow-[0_0_25px_rgba(0,255,135,0.15)]"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Ao vivo
          </span>
          <div className="mt-2 text-xl font-black leading-tight">Sua pelada está rolando agora! 🔥</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{aoVivo.nome_pelada}</div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {aoVivo.horario_inicio.slice(0, 5)}</span>
            {aoVivo.quadraNome && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {aoVivo.quadraNome}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {aoVivo.confirmados}/{aoVivo.capacidade}</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground">
              Entrar na resenha <ChevronRight className="h-4 w-4" />
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border">
              <BarChart3 className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <div className="font-bold">Nenhuma pelada rolando agora</div>
          <p className="mt-1 text-sm text-muted-foreground">Quando uma pelada sua começar, ela aparece bem aqui.</p>
          <Link to={`${base}/peladas`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
            Ver suas peladas <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to={proxima ? "/peladas/$id" : `${base}/peladas`} params={proxima ? { id: proxima.id } : undefined} className="rounded-2xl border border-border bg-card p-4">
          <Calendar className="h-6 w-6 text-primary" />
          <div className="mt-2 font-bold">Próxima Pelada</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">Ver detalhes <ChevronRight className="h-3 w-3" /></div>
        </Link>
        <Link to={`${base}/grupos` as any} className="rounded-2xl border border-border bg-card p-4">
          <Users className="h-6 w-6 text-primary" />
          <div className="mt-2 font-bold">Meus Grupos</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{gruposCount} grupo(s) ativo(s)</div>
        </Link>
        <Link to={`${base}/ranking`} className="rounded-2xl border border-border bg-card p-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div className="mt-2 font-bold">Ranking e XP</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">Ver posição <ChevronRight className="h-3 w-3" /></div>
        </Link>
        <Link to={`${base}/perfil`} className="rounded-2xl border border-border bg-card p-4">
          <Bell className="h-6 w-6 text-primary" />
          <div className="mt-2 font-bold">Convites e Alertas</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{alertasCount} pendente(s)</div>
        </Link>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Zap className="h-3.5 w-3.5" /> Resumo rápido
          </div>
          <Link to={`${base}/perfil`} className="flex items-center gap-1 text-xs font-bold text-primary">
            Ver tudo <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="text-[10px] text-muted-foreground">Total de XP</div>
            <div className="mt-1 text-lg font-black">{pontos.toLocaleString("pt-BR")}</div>
            <div className="text-[10px] text-muted-foreground">Nível {nivel}</div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${pctNivel}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="text-[10px] text-muted-foreground">Próxima pelada</div>
            {proxima ? (
              <>
                <div className="mt-1 truncate text-sm font-bold">{proxima.nome_pelada}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{proxima.data.split("-").reverse().join("/")} · {proxima.horario_inicio.slice(0, 5)}</div>
                {proxima.quadraNome && <div className="truncate text-[10px] text-muted-foreground">{proxima.quadraNome}</div>}
              </>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">Nenhuma marcada</div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <div className="text-[10px] text-muted-foreground">Sequência atual</div>
            <div className="mt-1 flex items-center justify-center gap-1 text-lg font-black">
              {ofensiva} {ofensiva > 0 && "🔥"}
            </div>
            <div className="text-[10px] text-muted-foreground">dias seguidos</div>
            {ofensiva > 0 && <div className="mt-0.5 text-[9px] font-bold text-primary">Bora manter!</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
