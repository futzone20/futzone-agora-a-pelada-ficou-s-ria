import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcularTabela } from "@/lib/placar";
import { corTextoLegivel } from "@/lib/sorteio";
import { Logo } from "@/components/Logo";
import { Clock, Trophy, Target, Shield, CalendarClock, Radio } from "lucide-react";

export const Route = createFileRoute("/placar/$arena/$quadra")({ component: TVPlacar });

const TIPO_ICON: Record<string, string> = { gol: "⚽", passe_decisivo: "🤝", defesa: "🧤", falta: "🟨", outro: "•" };

// Tempo que cada anunciante fica em tela antes de revezar pro próximo,
// quando a quadra tem mais de um cadastrado.
const INTERVALO_ANUNCIO_MS = 10_000;

// Quanto tempo a tela de "fim de pelada" (campeão/artilheiros/goleiro) fica
// no ar depois do último gol, caso não comece outra pelada na quadra.
const JANELA_RESUMO_MS = 10 * 60 * 1000;

function AnuncioTV({ anuncio }: { anuncio: { nome: string; imagem_url: string; link_url: string | null } }) {
  const img = <img src={anuncio.imagem_url} alt={anuncio.nome} className="h-20 w-full object-cover md:h-24" />;
  return (
    <div className="relative border-t-2 border-amber-400/60 bg-black">
      <span className="absolute left-2 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
        Publicidade
      </span>
      {anuncio.link_url ? (
        <a href={anuncio.link_url} target="_blank" rel="noopener noreferrer" className="block">{img}</a>
      ) : img}
    </div>
  );
}

/** Blobs coloridos desfocados ao fundo, pra dar o clima "painel de neon" sem precisar de imagem. */
function GlowBlobs({ corA, corB }: { corA: string; corB: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-25 blur-3xl" style={{ background: corA }} />
      <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: corB }} />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ background: corA }} />
    </div>
  );
}

function fmtDataCurta(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Resumo = {
  campeao: { nome: string; cor: string } | null;
  artilheiros: { nome: string; gols: number }[];
  goleiro: { nome: string; timeNome: string; timeCor: string; gc: number } | null;
  expiraEm: number;
};

function TVPlacar() {
  const { arena, quadra } = Route.useParams();
  const [pelada, setPelada] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [partidas, setPartidas] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());
  const [quadraNome, setQuadraNome] = useState<string>("");
  const [quadraPublicaId, setQuadraPublicaId] = useState<string | null>(null);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [anuncioIdx, setAnuncioIdx] = useState(0);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [proximosHorarios, setProximosHorarios] = useState<any[]>([]);

  const carregarResumo = async (peladaEncerrada: any): Promise<void> => {
    const { data: prs } = await supabase.from("partidas").select("*").eq("pelada_id", peladaEncerrada.id).order("numero_partida");
    const fimTimes = (prs || []).map((p: any) => p.encerrada_em).filter(Boolean).map((d: string) => new Date(d).getTime());
    const fim = fimTimes.length ? Math.max(...fimTimes) : null;
    if (!fim || Date.now() - fim > JANELA_RESUMO_MS) { setResumo(null); return; }

    const { data: ts } = await supabase.from("times").select("*").eq("pelada_id", peladaEncerrada.id);
    const tabela = calcularTabela(prs || [], ts || []);
    const ordenada = Object.values(tabela).sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc));
    const campeao = ordenada[0] ? { nome: ordenada[0].nome, cor: ordenada[0].cor } : null;

    const { data: ls } = await supabase.from("lances").select("user_id, tipo").eq("pelada_id", peladaEncerrada.id).eq("tipo", "gol");
    const contagem: Record<string, number> = {};
    (ls || []).forEach((l: any) => { if (l.user_id) contagem[l.user_id] = (contagem[l.user_id] || 0) + 1; });
    const topIds = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([uid]) => uid);

    const { data: tj } = await supabase.from("time_jogadores").select("user_id, time_id, eh_goleiro").eq("pelada_id", peladaEncerrada.id).eq("eh_goleiro", true);
    type Goleiro = { user_id: string; timeNome: string; timeCor: string; gc: number };
    const melhorGoleiro: Goleiro | null = ((tj || []) as any[]).reduce((acc: Goleiro | null, g: any) => {
      const linha = tabela[g.time_id];
      if (!linha) return acc;
      if (!acc || linha.gc < acc.gc) return { user_id: g.user_id, timeNome: linha.nome, timeCor: linha.cor, gc: linha.gc };
      return acc;
    }, null as Goleiro | null);

    const idsNomes = Array.from(new Set([...topIds, ...(melhorGoleiro ? [melhorGoleiro.user_id] : [])]));
    const nomesMap: Record<string, string> = {};
    if (idsNomes.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", idsNomes);
      (profs || []).forEach((p: any) => { nomesMap[p.user_id] = p.nome; });
      const faltando = idsNomes.filter((id) => !nomesMap[id]);
      if (faltando.length) {
        const { data: convs } = await supabase.from("pelada_convidados").select("id, nome").in("id", faltando);
        (convs || []).forEach((c: any) => { nomesMap[c.id] = `${c.nome} (convidado)`; });
      }
    }

    setResumo({
      campeao,
      artilheiros: topIds.map((uid) => ({ nome: nomesMap[uid] || "Jogador", gols: contagem[uid] })),
      goleiro: melhorGoleiro ? { nome: nomesMap[melhorGoleiro.user_id] || "Jogador", timeNome: melhorGoleiro.timeNome, timeCor: melhorGoleiro.timeCor, gc: melhorGoleiro.gc } : null,
      expiraEm: fim + JANELA_RESUMO_MS,
    });
  };

  const load = async () => {
    const { data: q } = await supabase.from("quadras_publicas").select("*").eq("slug_arena", arena).eq("slug_quadra", quadra).maybeSingle();
    if (!q) { setPelada(null); setResumo(null); return; }
    setQuadraNome(q.nome);
    setQuadraPublicaId(q.id);

    // Anúncios são da quadra do DONO (tabela "quadras"), não da quadra
    // pública em si — por isso o passo extra de achar o id dela a partir do
    // vínculo quadra_publica_id. Carrega independente de ter pelada rolando
    // ou não, pra a TV também anunciar enquanto está "aguardando".
    const { data: qDono } = await supabase.from("quadras").select("id").eq("quadra_publica_id", q.id).maybeSingle();
    if (qDono) {
      const { data: vinc } = await supabase.from("tv_anunciante_quadras").select("tv_anunciantes(id,nome,imagem_url,link_url,ativo)").eq("quadra_id", qDono.id);
      const ativos = ((vinc ?? []) as any[]).map((v) => v.tv_anunciantes).filter((a: any) => a?.ativo);
      setAnuncios(ativos);
    }

    const hojeISO = new Date().toISOString().slice(0, 10);
    const { data: prox } = await supabase.from("peladas").select("data, horario_inicio, nome_pelada").eq("quadra_id", q.id).in("status", ["aguardando", "confirmada"]).gte("data", hojeISO).order("data").order("horario_inicio").limit(4);
    setProximosHorarios(prox || []);

    const { data: ps } = await supabase.from("peladas").select("*").eq("quadra_id", q.id).in("status", ["confirmada", "em_andamento", "encerrada"]).order("data", { ascending: false }).order("horario_inicio", { ascending: false }).limit(3);
    const lista = ps || [];
    const ativa = lista.find((p: any) => p.status !== "encerrada");

    if (!ativa) {
      setPelada(null); setTimes([]); setPartidas([]); setLances([]);
      const encerrada = lista.find((p: any) => p.status === "encerrada");
      if (encerrada) await carregarResumo(encerrada); else setResumo(null);
      return;
    }

    setResumo(null);
    setPelada(ativa);
    const [{ data: ts }, { data: prs }] = await Promise.all([
      supabase.from("times").select("*").eq("pelada_id", ativa.id).order("ordem"),
      supabase.from("partidas").select("*").eq("pelada_id", ativa.id).order("numero_partida"),
    ]);
    setTimes(ts || []);
    setPartidas(prs || []);
    const atual = (prs || []).find((x: any) => x.status === "em_andamento") || (prs || []).slice(-1)[0];
    if (atual) {
      const { data: ls } = await supabase.from("lances").select("*").eq("partida_id", atual.id).order("criado_em", { ascending: false }).limit(5);
      setLances(ls || []);
      const uids = (ls || []).map((x: any) => x.user_id);
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
        const m: Record<string, any> = {};
        (profs || []).forEach((x: any) => { m[x.user_id] = x; });
        setProfiles(m);
      }
    } else {
      setLances([]);
    }
  };

  useEffect(() => { void load(); }, [arena, quadra]);

  // Escuta mudanças de partidas/lances da pelada ativa (placar ao vivo).
  useEffect(() => {
    if (!pelada) return;
    const ch = supabase.channel(`tv-${pelada.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `pelada_id=eq.${pelada.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lances", filter: `pelada_id=eq.${pelada.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "peladas", filter: `id=eq.${pelada.id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pelada?.id]);

  // Escuta a quadra inteira, pra pegar quando uma pelada nova é criada/confirmada
  // (inclusive quando não há nenhuma pelada ativa agora — ex: tela de resumo ou idle).
  useEffect(() => {
    if (!quadraPublicaId) return;
    const ch = supabase.channel(`tv-quadra-${quadraPublicaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "peladas", filter: `quadra_id=eq.${quadraPublicaId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [quadraPublicaId]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  // Fallback por tempo: garante que a tela de resumo "expire" pra tela de espera mesmo sem
  // nenhum evento de realtime novo, e dá uma recarregada periódica pra manter tudo em dia.
  useEffect(() => {
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [arena, quadra]);

  // Revezia entre os anunciantes ativos dessa quadra, quando há mais de um.
  useEffect(() => {
    if (anuncios.length <= 1) return;
    const t = setInterval(() => setAnuncioIdx((i) => (i + 1) % anuncios.length), INTERVALO_ANUNCIO_MS);
    return () => clearInterval(t);
  }, [anuncios.length]);

  const atual = useMemo(() => partidas.find((p) => p.status === "em_andamento") || partidas.slice(-1)[0], [partidas]);
  const proxima = useMemo(() => partidas.find((p) => p.status === "aguardando" && (!atual || p.id !== atual.id)), [partidas, atual]);
  const restanteSec = useMemo(() => {
    if (!atual?.iniciada_em || atual.status !== "em_andamento") return atual ? atual.duracao_minutos * 60 : 0;
    const ini = new Date(atual.iniciada_em).getTime();
    return Math.max(0, atual.duracao_minutos * 60 - Math.floor((now - ini) / 1000));
  }, [atual, now]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const tabela = calcularTabela(partidas, times);
  const tabelaOrd = Object.values(tabela).sort((a, b) => b.pts - a.pts);
  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";
  const corTime = (tid: string) => times.find((t) => t.id === tid)?.cor || "#666";
  const recorde = (tid: string) => tabela[tid] || { v: 0, e: 0, d: 0 };

  const anuncioAtual = anuncios.length > 0 ? anuncios[anuncioIdx % anuncios.length] : null;
  const resumoValido = resumo && now < resumo.expiraEm ? resumo : null;

  // ---------- Tela de fim de pelada: campeão, artilheiros e goleiro menos vazado ----------
  if (resumoValido) {
    const corDestaque = resumoValido.campeao?.cor || "#f59e0b";
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
        <GlowBlobs corA={corDestaque} corB="#0ea5e9" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
          <Logo className="h-9" />
          <div className="flex items-center gap-3 text-amber-400">
            <Trophy className="h-9 w-9" />
            <span className="text-sm font-black uppercase tracking-[0.3em]">Fim de pelada</span>
            <Trophy className="h-9 w-9" />
          </div>
          {resumoValido.campeao && (
            <div className="rounded-[2rem] border-2 px-14 py-8" style={{ borderColor: resumoValido.campeao.cor, boxShadow: `0 0 90px -15px ${resumoValido.campeao.cor}` }}>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">Campeão da pelada</div>
              <div className="mt-2 text-6xl font-black" style={{ color: resumoValido.campeao.cor, textShadow: `0 0 40px ${resumoValido.campeao.cor}` }}>
                {resumoValido.campeao.nome}
              </div>
            </div>
          )}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="mb-3 flex items-center justify-center gap-2 text-emerald-400">
                <Target className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Artilheiros</span>
              </div>
              {resumoValido.artilheiros.length === 0 ? (
                <p className="py-2 text-sm text-white/50">Sem gols registrados.</p>
              ) : (
                <div className="space-y-2">
                  {resumoValido.artilheiros.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                      <span className="flex items-center gap-2 font-bold"><span className="text-amber-400">{i + 1}º</span>{a.nome}</span>
                      <span className="font-black text-emerald-400">{a.gols} ⚽</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="mb-3 flex items-center justify-center gap-2 text-sky-400">
                <Shield className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Goleiro menos vazado</span>
              </div>
              {resumoValido.goleiro ? (
                <div className="flex flex-col items-center gap-1 py-2">
                  <div className="text-2xl font-black">{resumoValido.goleiro.nome}</div>
                  <div className="text-sm text-white/60">{resumoValido.goleiro.timeNome} · {resumoValido.goleiro.gc} gol(s) sofrido(s)</div>
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-white/50">Sem goleiro definido.</p>
              )}
            </div>
          </div>
        </div>
        {anuncioAtual && <AnuncioTV anuncio={anuncioAtual} />}
      </div>
    );
  }

  // ---------- Tela de espera: logo em destaque + próximos horários ----------
  if (!pelada || !atual) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
        <GlowBlobs corA="#10b981" corB="#6366f1" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <Logo className="h-16 drop-shadow-[0_0_50px_rgba(16,185,129,0.55)]" />
          <p className="animate-pulse text-xl text-white/70">Aguardando próxima pelada...</p>
          {quadraNome && <p className="text-xs uppercase tracking-[0.3em] text-white/40">{quadraNome}</p>}
          {proximosHorarios.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
                <CalendarClock className="h-4 w-4" />Próximos horários
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {proximosHorarios.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="font-bold text-white">{fmtDataCurta(p.data)}</span>
                    <span className="text-white/50"> · {p.horario_inicio?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {anuncioAtual && <AnuncioTV anuncio={anuncioAtual} />}
      </div>
    );
  }

  // ---------- Placar ao vivo ----------
  const corA = corTime(atual.time_a_id);
  const corB = corTime(atual.time_b_id);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      <GlowBlobs corA={corA} corB={corB} />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-6 py-3 backdrop-blur">
        <Logo className="h-7" />
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300/90">
          <span>⚡ Aqui é futebol e resenha ⚡</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />Início <span className="font-black text-white">{pelada.horario_inicio?.slice(0, 5)}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-rose-400" />Fim <span className="font-black text-white">{pelada.horario_fim?.slice(0, 5)}</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 grid flex-1 gap-6 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 p-8 backdrop-blur">
          <div className="grid w-full grid-cols-3 items-start gap-6">
            {(() => {
              const r = recorde(atual.time_a_id);
              return (
                <div
                  className="flex flex-col items-center rounded-[1.75rem] p-6"
                  style={{ background: `linear-gradient(180deg, ${corA}33, transparent)`, border: `2px solid ${corA}`, boxShadow: `0 0 50px -12px ${corA}` }}
                >
                  <div className="text-3xl font-black uppercase tracking-wide" style={{ color: corA, textShadow: `0 0 20px ${corA}99` }}>{nomeTime(atual.time_a_id)}</div>
                  <div className="mt-4 text-9xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]">{atual.placar_a}</div>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                    <div><div className="text-xl font-black text-emerald-400">{r.v}</div><div className="text-[10px] uppercase text-white/50">Vitórias</div></div>
                    <div><div className="text-xl font-black text-white">{r.e}</div><div className="text-[10px] uppercase text-white/50">Empates</div></div>
                    <div><div className="text-xl font-black text-rose-400">{r.d}</div><div className="text-[10px] uppercase text-white/50">Derrotas</div></div>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col items-center text-center">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/50">Partida {atual.numero_partida}</div>
              <div className="relative mt-3 flex h-40 w-40 items-center justify-center rounded-full border-4 border-white/10 bg-black/40" style={{ boxShadow: `0 0 50px -10px ${restanteSec <= 120 ? "#ef4444" : "#10b981"}` }}>
                <div className={`text-4xl font-black tabular-nums ${restanteSec <= 120 ? "text-red-400" : "text-white"}`}>{fmt(restanteSec)}</div>
              </div>
              <div className="mt-3 text-sm font-black uppercase tracking-widest text-white/40">vs</div>
              {atual.time_fora_id && (
                <div className="mt-5 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs">
                  <span className="text-amber-300/80">Próximo jogo</span>{" "}
                  <span className="font-black text-amber-300">{nomeTime(atual.time_fora_id)}</span>
                </div>
              )}
            </div>
            {(() => {
              const r = recorde(atual.time_b_id);
              return (
                <div
                  className="flex flex-col items-center rounded-[1.75rem] p-6"
                  style={{ background: `linear-gradient(180deg, ${corB}33, transparent)`, border: `2px solid ${corB}`, boxShadow: `0 0 50px -12px ${corB}` }}
                >
                  <div className="text-3xl font-black uppercase tracking-wide" style={{ color: corB, textShadow: `0 0 20px ${corB}99` }}>{nomeTime(atual.time_b_id)}</div>
                  <div className="mt-4 text-9xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]">{atual.placar_b}</div>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                    <div><div className="text-xl font-black text-emerald-400">{r.v}</div><div className="text-[10px] uppercase text-white/50">Vitórias</div></div>
                    <div><div className="text-xl font-black text-white">{r.e}</div><div className="text-[10px] uppercase text-white/50">Empates</div></div>
                    <div><div className="text-xl font-black text-rose-400">{r.d}</div><div className="text-[10px] uppercase text-white/50">Derrotas</div></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-white/50">Últimos lances</h3>
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-400">
                <Radio className="h-2.5 w-2.5 animate-pulse" />AO VIVO
              </span>
            </div>
            {lances.length === 0 ? <p className="text-sm text-white/40">Sem lances.</p> : (
              <div className="grid gap-1.5">
                {lances.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1.5 text-sm">
                    <span className="text-xl">{TIPO_ICON[l.tipo]}</span>
                    <span className="flex-1 font-bold">{profiles[l.user_id]?.nome || "—"}</span>
                    <span className="text-xs" style={{ color: corTextoLegivel(corTime(l.time_id)) }}>{nomeTime(l.time_id)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-white/50">Quadro Geral</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-white/40"><tr><th className="text-left">Time</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>Pts</th></tr></thead>
              <tbody>
                {tabelaOrd.map((r) => (
                  <tr key={r.time_id} className="border-t border-white/10">
                    <td className="py-1.5"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: r.cor }} />{r.nome}</td>
                    <td className="text-center">{r.v}</td><td className="text-center">{r.e}</td><td className="text-center">{r.d}</td>
                    <td className="text-center">{r.gp}</td><td className="text-center">{r.gc}</td><td className="text-center font-black text-amber-400">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxima && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm backdrop-blur">
              Próxima: <span className="font-black text-white">{nomeTime(proxima.time_a_id)} vs {nomeTime(proxima.time_b_id)}</span>
            </div>
          )}
        </div>
      </div>

      {anuncioAtual && <AnuncioTV anuncio={anuncioAtual} />}
    </div>
  );
}
