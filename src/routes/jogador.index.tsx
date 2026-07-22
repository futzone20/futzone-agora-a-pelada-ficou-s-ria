import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { 
  Flame, 
  CircleDot, 
  Bell, 
  Calendar, 
  Trophy, 
  ChevronRight, 
  Shield, 
  Target, 
  Mic2 as Whistle,
  Footprints as Footprint,
  ChevronLeft
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/jogador/")({ component: Inicio });

function periodoSemana() {
  const d = new Date();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function Inicio() {
  const { user } = useAuth();
  const [proximas, setProximas] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [pontos, setPontos] = useState(0);
  const [ofensiva, setOfensiva] = useState(0);
  const [desafios, setDesafios] = useState<any[]>([]);
  const [aoVivo, setAoVivo] = useState<{ pelada: any; partida: any; timeA: any; timeB: any } | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void (async () => {
      const { data: prof } = await supabase.from("profiles").select("pontos_total").eq("user_id", user.id).maybeSingle();
      setPontos(prof?.pontos_total || 0);
      
      const { data: of } = await supabase.from("ofensivas").select("sequencia_atual").eq("user_id", user.id).maybeSingle();
      setOfensiva(of?.sequencia_atual || 0);

      const periodo = periodoSemana();
      const { data: dp } = await supabase.from("desafios_progresso")
        .select(`
          *,
          desafios (*)
        `)
        .eq("user_id", user.id)
        .eq("periodo_referencia", periodo)
        .eq("concluido", false);
      setDesafios(dp || []);

      const today = new Date().toISOString().slice(0, 10);
      const { data: pc } = await supabase.from("pelada_confirmacoes")
        .select(`
          pelada_id,
          status,
          peladas (
            id,
            nome_pelada,
            data,
            horario_inicio,
            status
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "confirmado");
      
      const ps = (pc || [])
        .map((c: any) => c.peladas)
        .filter((p: any) => p && p.data >= today && ["aguardando", "confirmada"].includes(p.status))
        .sort((a: any, b: any) => a.data.localeCompare(b.data))
        .slice(0, 3);
      setProximas(ps);

      const { data: ns } = await supabase.from("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("criado_em", { ascending: false })
        .limit(5);
      setNotifs(ns || []);

      // Pelada ao vivo em que o usuário está escalado (pra mostrar o resumo fixo na home)
      const { data: tj } = await supabase.from("time_jogadores").select("pelada_id").eq("user_id", user.id);
      const peladaIds = Array.from(new Set((tj || []).map((x: any) => x.pelada_id)));
      if (peladaIds.length) {
        const { data: pAoVivo } = await supabase.from("peladas").select("id, nome_pelada").in("id", peladaIds).eq("status", "em_andamento").limit(1).maybeSingle();
        if (pAoVivo) {
          const { data: partida } = await supabase.from("partidas").select("*").eq("pelada_id", pAoVivo.id).eq("status", "em_andamento").maybeSingle();
          const { data: timesAoVivo } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", pAoVivo.id);
          const timeA = (timesAoVivo || []).find((t: any) => t.id === partida?.time_a_id) || null;
          const timeB = (timesAoVivo || []).find((t: any) => t.id === partida?.time_b_id) || null;
          setAoVivo({ pelada: pAoVivo, partida, timeA, timeB });
        }
      }

      setLoading(false);

    })();
  }, [user?.id]);

  const getSubtextoPontos = (pts: number) => {
    if (pts < 100) return "Começando a jornada 🌱";
    if (pts <= 500) return "Você está voando! 🚀";
    if (pts <= 2000) return "Craque em formação ⚽";
    return "Lendário! 💎";
  };

  const getIconeDesafio = (tipo: string) => {
    if (tipo === 'presenca') return Shield;
    if (tipo === 'avaliador') return Whistle;
    return Target;
  };

  const getNotifIcon = (tipo: string) => {
    switch (tipo) {
      case 'novo_selo': return { char: '🏅', color: 'bg-[#2D4A1E] text-white' };
      case 'resultado_pelada': return { char: '🏆', color: 'bg-[#4A3500] text-white' };
      case 'nova_pelada': return { char: '👥', color: 'bg-[#1A2D4A] text-white' };
      case 'rivalidade': return { char: '⚡', color: 'bg-[#4A1A1A] text-white' };
      default: return { char: '🔔', color: 'bg-[#2A2A2A] text-white' };
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      
      {/* 1. HEADER - Handled by MobileShell, but user wants logic in hero now too */}
      
      {/* 2. HERO BANNER */}
      <section className="flex flex-col gap-1 px-4">
        <p className="text-xs font-medium text-gray-500">Bem-vindo de volta,</p>
        <h1 className="text-2xl font-black text-white">{user?.nome?.split(" ")[0] || 'Jogador'} 👋</h1>
        
        <div className="relative mt-4 h-[220px] w-full overflow-hidden rounded-2xl bg-black">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
            style={{ 
              backgroundImage: `url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800')`,
              backgroundPosition: 'center 40%'
            }}
          />
          <div 
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)' }}
          />
          <div className="relative flex h-full flex-col justify-center p-6">
            <div className="space-y-0.5">
              <h2 className="text-xl font-black leading-tight text-white uppercase">SUA PRÓXIMA</h2>
              <h2 className="text-xl font-black leading-tight text-[#00FF87] uppercase">PELADA COMEÇA AQUI</h2>
            </div>
            <p className="mt-2 max-w-[200px] text-[10px] leading-relaxed text-gray-400">
              Participe, jogue e conquiste. O futebol é nosso ponto de encontro.
            </p>
            <Link 
              to="/jogador/peladas" 
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#00FF87] px-4 py-2 text-xs font-bold text-[#00FF87] transition hover:bg-[#00FF87] hover:text-black"
            >
              Explorar peladas →
            </Link>
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            <div className="h-1.5 w-4 rounded-full bg-[#00FF87]" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
        </div>
      </section>

      {/* 3. CARDS DE STATS */}
      <section className="grid grid-cols-2 gap-[12px] px-4">
        <Link to="/jogador/perfil" className="group relative flex flex-col gap-1 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 transition hover:border-[#00FF87]/30">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#1E3A2F] text-[#00FF87]">
            <Trophy className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">SEUS PONTOS</p>
          <p className="text-2xl font-black text-white">{pontos}</p>
          <p className="mt-1 text-[10px] font-medium text-[#00FF87]">{getSubtextoPontos(pontos)}</p>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2A2A2A]">
            <ChevronRight className="h-3 w-3 text-gray-500 transition group-hover:text-white" />
          </div>
        </Link>

        <Link to="/jogador/perfil" className="group relative flex flex-col gap-1 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 transition hover:border-[#00FF87]/30">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#1E3A2F] text-[#00FF87]">
            <Footprint className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">SUA OFENSIVA</p>
          <div className="flex items-center gap-1">
            <p className="text-2xl font-black text-white">{ofensiva}</p>
            {ofensiva >= 5 && <span className="text-xl">🔥</span>}
          </div>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Peladas jogadas</p>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2A2A2A]">
            <ChevronRight className="h-3 w-3 text-gray-500 transition group-hover:text-white" />
          </div>
        </Link>
      </section>

      {/* 4. DESAFIOS DA SEMANA */}
      <section className="px-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Target className="h-4 w-4 text-[#00FF87]" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">DESAFIOS DA SEMANA</h3>
          </div>
          <Link to="/jogador/ranking" className="text-[10px] font-bold text-[#00FF87] hover:underline">
            Ver ranking 🏆
          </Link>
        </div>
        
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-[#1A1A1A]" />)
          ) : desafios.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-500">Nenhum desafio ativo no momento.</p>
          ) : (
            desafios.map((dp: any) => {
              const Icone = getIconeDesafio(dp.desafios.tipo);
              const pct = Math.min(100, (dp.progresso_atual / dp.desafios.quantidade_alvo) * 100);
              return (
                <div key={dp.id} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E3A2F] text-[#00FF87]">
                      <Icone className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white leading-tight">{dp.desafios.titulo}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{dp.desafios.descricao}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#00FF87] tracking-tight">{dp.progresso_atual}/{dp.desafios.quantidade_alvo}</p>
                      <p className="text-[10px] font-black text-[#00FF87]">+{dp.desafios.pontos_recompensa} pts</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
                    <div 
                      className="h-full bg-[#00FF87] transition-all duration-700 ease-out" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 5. PRÓXIMAS PELADAS */}
      <section className="px-4">
        <div className="mb-4 flex items-center gap-2 text-white">
          <CircleDot className="h-4 w-4 text-[#00FF87]" />
          <h3 className="text-[10px] font-black uppercase tracking-widest">PRÓXIMAS PELADAS</h3>
        </div>

        {proximas.length === 0 ? (
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <div className="flex gap-4">
              <img 
                src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300" 
                alt="Pelada" 
                className="h-[120px] w-[120px] shrink-0 rounded-xl object-cover"
              />
              <div className="flex flex-1 flex-col justify-center">
                <h4 className="text-sm font-bold text-white">Nenhuma pelada agendada</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Ainda não há peladas marcadas. Entre em um grupo ou explore e encontre seu próximo jogo!
                </p>
                <div className="mt-4 flex gap-2">
                  <Link to="/jogador/peladas" className="flex-1 rounded-lg border border-[#00FF87] px-2 py-2 text-[10px] font-bold text-[#00FF87] text-center hover:bg-[#00FF87]/5 transition">
                    👥 Entrar em um grupo
                  </Link>
                  <Link to="/jogador/peladas" className="flex-1 rounded-lg bg-[#00FF87] px-2 py-2 text-[10px] font-bold text-black text-center hover:bg-[#00FF87]/90 transition">
                    🔍 Explorar peladas
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {proximas.map((p) => (
              <Link 
                key={p.id} 
                to="/peladas/$id" 
                params={{ id: p.id }}
                className="flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 transition hover:border-[#00FF87]/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gray-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white leading-tight">{p.nome_pelada}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {p.horario_inicio.slice(0, 5)}
                  </p>
                </div>
                <div className="rounded-full bg-[#00FF87]/10 px-3 py-1 text-[10px] font-black uppercase text-[#00FF87] tracking-tight">
                  Ver pelada
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 6. NOTIFICAÇÕES */}
      <section className="px-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bell className="h-4 w-4 text-[#00FF87]" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">NOTIFICAÇÕES</h3>
          </div>
          <button className="text-[10px] font-bold text-[#00FF87] hover:underline">
            Ver todas
          </button>
        </div>

        <div className="divide-y divide-[#2A2A2A] rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
          {notifs.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500">Sem notificações por enquanto.</p>
          ) : (
            notifs.map((n) => {
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
                <div key={n.id} className="flex gap-4 p-4 transition hover:bg-white/[0.02]">
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
                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#00FF87]/10 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-[#00FF87] hover:bg-[#00FF87]/20"
                      >
                        🏆 Ver Card da Vitória
                      </Link>
                    )}
                  </div>
                  {!n.lida && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00FF87]" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
