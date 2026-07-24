import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reação principal (estilo "curtir" do Instagram) + outras disponíveis num picker secundário
const REACAO_PRINCIPAL = "bola";
const REACOES = [
  { tipo: "bola", icon: "⚽" },
  { tipo: "fogo", icon: "🔥" },
  { tipo: "luva", icon: "🧤" },
  { tipo: "risada", icon: "😂" },
  { tipo: "aplauso", icon: "👏" },
  { tipo: "foguete", icon: "🚀" },
];

const EMOJIS_COMENTARIO = ["😂", "🔥", "⚽", "👏", "😅", "😭", "🥶", "💪", "🐔", "🎯", "😤", "🏆", "👀", "🤝", "💀", "🙌"];

const PREMIOS: Record<string, { titulo: string; emoji: string; cor: string }> = {
  craque: { titulo: "foi eleito o Craque da Rodada!", emoji: "⚽", cor: "text-primary" },
  pereba: { titulo: "foi eleito o Pereba da Rodada 😅", emoji: "🥴", cor: "text-orange-400" },
  perde_gol: { titulo: "levou o troféu de Perde-Gol da Rodada", emoji: "🎯", cor: "text-orange-400" },
  frangueiro: { titulo: "levou o Frango da Rodada", emoji: "🐔", cor: "text-orange-400" },
  racudo: { titulo: "foi eleito o Raçudo da Rodada!", emoji: "🔥", cor: "text-primary" },
  reclamao: { titulo: "foi eleito o Reclamão da Rodada 😤", emoji: "😤", cor: "text-orange-400" },
};

// Tipos de post que são "do sistema/grupo" — não mostram foto de um jogador específico
const TIPOS_SEM_AVATAR = new Set(["resultado_pelada", "patrocinio"]);

type Comentario = { id: string; post_id: string; user_id: string; texto: string; deletado: boolean; criado_em: string; resposta_para: string | null };
type Reacao = { id: string; post_id: string; user_id: string; tipo: string };
type Post = {
  id: string; grupo_id: string | null; tipo: string; pelada_id: string | null; user_id: string | null;
  conteudo: any; criado_em: string; comentarios: Comentario[]; reacoes: Reacao[];
};
type Membro = { user_id: string; nome: string; handle: string | null; foto_url: string | null };

export function ResenhaFeed() {
  const { user } = useAuth();
  const [aba, setAba] = useState<"grupo" | "todos">("grupo");
  const [posts, setPosts] = useState<Post[]>([]);
  const [gruposMap, setGruposMap] = useState<Record<string, string>>({});
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<Record<string, Membro[]>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, { nome: string; foto_url: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const ensureProfile = async (userId: string | null) => {
    if (!userId || profilesMap[userId]) return;
    const { data } = await supabase.from("profiles").select("user_id,nome,foto_url").eq("user_id", userId).maybeSingle();
    if (data) setProfilesMap((prev) => ({ ...prev, [(data as any).user_id]: { nome: (data as any).nome, foto_url: (data as any).foto_url } }));
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: gms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo");
    const gruposIds = (gms || []).map((g: any) => g.grupo_id);
    const { data: gs } = await supabase.from("grupos").select("id,nome").in("id", gruposIds.length ? gruposIds : ["00000000-0000-0000-0000-000000000000"]);
    const gMap: Record<string, string> = {};
    (gs || []).forEach((g: any) => { gMap[g.id] = g.nome; });
    setGruposMap(gMap);

    // Membros de cada grupo (pra sugestão de @menção nos comentários) — busca em duas
    // consultas separadas porque grupo_membros.user_id referencia auth.users, não profiles
    // diretamente, então o PostgREST não consegue montar o "join" automático.
    if (gruposIds.length) {
      const { data: gmRows } = await supabase.from("grupo_membros").select("grupo_id, user_id").in("grupo_id", gruposIds).eq("status", "ativo");
      const idsUnicos = Array.from(new Set((gmRows || []).map((g: any) => g.user_id as string)));
      const { data: memberProfiles } = idsUnicos.length
        ? await supabase.from("profiles").select("user_id, nome, handle, foto_url").in("user_id", idsUnicos)
        : { data: [] as any[] };
      const profileById: Record<string, any> = {};
      (memberProfiles || []).forEach((p: any) => { profileById[p.user_id] = p; });
      const porGrupo: Record<string, Membro[]> = {};
      (gmRows || []).forEach((m: any) => {
        const p = profileById[m.user_id];
        (porGrupo[m.grupo_id] ||= []).push({ user_id: m.user_id, nome: p?.nome || "Jogador", handle: p?.handle || null, foto_url: p?.foto_url || null });
      });
      setMembrosPorGrupo(porGrupo);
    }

    const { data: ps } = await supabase.from("feed_posts").select("*").order("criado_em", { ascending: false }).limit(50);
    const list = (ps as any[]) || [];

    const postIds = list.map((p) => p.id);
    let rMap: Record<string, any[]> = {}, cMap: Record<string, any[]> = {};
    if (postIds.length) {
      const [{ data: rs }, { data: cs }] = await Promise.all([
        supabase.from("feed_reacoes").select("*").in("post_id", postIds),
        supabase.from("feed_comentarios").select("*").in("post_id", postIds).order("criado_em"),
      ]);
      (rs || []).forEach((r: any) => { (rMap[r.post_id] = rMap[r.post_id] || []).push(r); });
      (cs || []).forEach((c: any) => { (cMap[c.post_id] = cMap[c.post_id] || []).push(c); });

      const allUserIds = new Set<string>();
      list.forEach((p) => p.user_id && allUserIds.add(p.user_id));
      (cs || []).forEach((c: any) => allUserIds.add(c.user_id));
      if (allUserIds.size) {
        const { data: profs } = await supabase.from("profiles").select("user_id,nome,foto_url").in("user_id", Array.from(allUserIds));
        const pm: Record<string, { nome: string; foto_url: string | null }> = {};
        (profs || []).forEach((p: any) => { pm[p.user_id] = { nome: p.nome, foto_url: p.foto_url }; });
        setProfilesMap((prev) => ({ ...prev, ...pm }));
      }
    }

    setPosts(list.map((p) => ({ ...p, comentarios: cMap[p.id] || [], reacoes: rMap[p.id] || [] })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  // Quando vem de uma notificação (link tipo /jogador/resenha?post=ID), rola até o post
  // certo e dá um destaque rápido nele.
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    }
  }, [loading, posts]);

  // Atualização em tempo real SEM recarregar a lista inteira — só mescla o que mudou no
  // post certo, sem mexer na rolagem nem no resto da tela.
  useEffect(() => {
    const ch = supabase.channel("feed-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_posts" }, (payload) => {
        const novo = payload.new as any;
        setPosts((prev) => (prev.some((p) => p.id === novo.id) ? prev : [{ ...novo, comentarios: [], reacoes: [] }, ...prev]));
        void ensureProfile(novo.user_id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_comentarios" }, (payload) => {
        const c = payload.new as any;
        setPosts((prev) => prev.map((p) => (p.id === c.post_id && !p.comentarios.some((x) => x.id === c.id)) ? { ...p, comentarios: [...p.comentarios, c] } : p));
        void ensureProfile(c.user_id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "feed_comentarios" }, (payload) => {
        const c = payload.new as any;
        setPosts((prev) => prev.map((p) => p.id === c.post_id ? { ...p, comentarios: p.comentarios.map((x) => x.id === c.id ? c : x) } : p));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_reacoes" }, (payload) => {
        const r = payload.new as any;
        setPosts((prev) => prev.map((p) => (p.id === r.post_id && !p.reacoes.some((x) => x.id === r.id)) ? { ...p, reacoes: [...p.reacoes, r] } : p));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "feed_reacoes" }, (payload) => {
        const r = payload.old as any;
        setPosts((prev) => prev.map((p) => p.id === r.post_id ? { ...p, reacoes: p.reacoes.filter((x) => x.id !== r.id) } : p));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  const atualizarPost = (postId: string, fn: (p: Post) => Post) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? fn(p) : p)));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Resenha</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setAba("grupo")}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${aba === "grupo" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
        >
          Grupo
        </button>
        <button
          onClick={() => setAba("todos")}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${aba === "todos" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
        >
          Todos
        </button>
      </div>

      {aba === "todos" ? (
        <EmptyState icon={MessageCircle} title="Em breve" description="A aba Todos vai mostrar a resenha de quem você segue — isso chega numa próxima atualização." />
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Carregando feed...</div>
      ) : !posts.length ? (
        <EmptyState icon={MessageCircle} title="Nenhum post ainda" description="Jogue uma pelada e o feed começa a bombar." />
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            grupoNome={p.grupo_id ? gruposMap[p.grupo_id] : null}
            membros={p.grupo_id ? membrosPorGrupo[p.grupo_id] || [] : []}
            profilesMap={profilesMap}
            onLocalChange={(fn) => atualizarPost(p.id, fn)}
          />
        ))
      )}
    </div>
  );
}

function PostCard({ post, grupoNome, membros, profilesMap, onLocalChange }: {
  post: Post; grupoNome: string | null; membros: Membro[];
  profilesMap: Record<string, { nome: string; foto_url: string | null }>;
  onLocalChange: (fn: (p: Post) => Post) => void;
}) {
  const { user } = useAuth();
  const [openPicker, setOpenPicker] = useState(false);
  const [openComents, setOpenComents] = useState(false);
  const [respondendoPara, setRespondendoPara] = useState<Comentario | null>(null);

  const c = post.conteudo || {};
  const counts: Record<string, number> = {};
  const minhas = new Set<string>();
  post.reacoes.forEach((r) => {
    counts[r.tipo] = (counts[r.tipo] || 0) + 1;
    if (r.user_id === user?.id) minhas.add(r.tipo);
  });
  const totalReacoes = post.reacoes.length;
  const euCurti = minhas.has(REACAO_PRINCIPAL) || minhas.size > 0;

  // Comentários raiz + respostas agrupadas por comentário-pai (estilo Instagram)
  const raizes = post.comentarios.filter((cm) => !cm.resposta_para);
  const respostasDe = (id: string) => post.comentarios.filter((cm) => cm.resposta_para === id);
  const totalComentarios = post.comentarios.length;
  const raizesMostradas = openComents ? raizes : raizes.slice(-2);

  const toggleReact = async (tipo: string) => {
    if (!user) return;
    if (minhas.has(tipo)) {
      onLocalChange((p) => ({ ...p, reacoes: p.reacoes.filter((r) => !(r.user_id === user.id && r.tipo === tipo)) }));
      await supabase.from("feed_reacoes").delete().eq("post_id", post.id).eq("user_id", user.id).eq("tipo", tipo);
    } else {
      const otimista: Reacao = { id: `tmp-${Date.now()}`, post_id: post.id, user_id: user.id, tipo };
      onLocalChange((p) => ({ ...p, reacoes: [...p.reacoes, otimista] }));
      await supabase.from("feed_reacoes").insert({ post_id: post.id, user_id: user.id, tipo } as never);
    }
  };

  // Clique rápido no ícone principal = alterna a reação padrão (⚽), estilo "curtir" do Instagram
  const curtirRapido = () => {
    if (minhas.size > 0) {
      // já reagiu com algo — remove TODAS as reações minhas nesse post
      Array.from(minhas).forEach((t) => void toggleReact(t));
    } else {
      void toggleReact(REACAO_PRINCIPAL);
    }
  };

  const adicionarComentario = async (texto: string, respostaPara: string | null) => {
    if (!user || !texto.trim()) return;
    const otimista: Comentario = { id: `tmp-${Date.now()}`, post_id: post.id, user_id: user.id, texto: texto.slice(0, 140), deletado: false, criado_em: new Date().toISOString(), resposta_para: respostaPara };
    onLocalChange((p) => ({ ...p, comentarios: [...p.comentarios, otimista] }));
    setOpenComents(true);
    setRespondendoPara(null);
    const { data, error } = await supabase.from("feed_comentarios").insert({ post_id: post.id, user_id: user.id, texto: texto.slice(0, 140), resposta_para: respostaPara } as never).select().maybeSingle();
    if (!error && data) {
      onLocalChange((p) => ({ ...p, comentarios: p.comentarios.map((x) => (x.id === otimista.id ? (data as any) : x)) }));
    }
  };

  const delComent = async (id: string) => {
    onLocalChange((p) => ({ ...p, comentarios: p.comentarios.map((x) => (x.id === id ? { ...x, deletado: true } : x)) }));
    await supabase.from("feed_comentarios").update({ deletado: true } as never).eq("id", id);
  };

  const autorId = post.user_id;
  const mostrarAvatar = autorId && !TIPOS_SEM_AVATAR.has(post.tipo);
  const autorFoto = autorId ? profilesMap[autorId]?.foto_url : null;
  const autorNome = autorId ? profilesMap[autorId]?.nome : null;

  const renderComentario = (cm: Comentario, resposta: boolean) => (
    <div key={cm.id} className={`flex items-start gap-2 text-sm ${resposta ? "ml-8 mt-2" : ""}`}>
      <Avatar className={resposta ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"}>
        {profilesMap[cm.user_id]?.foto_url ? <AvatarImage src={profilesMap[cm.user_id]!.foto_url!} /> : null}
        <AvatarFallback className="bg-secondary text-[10px]">{(profilesMap[cm.user_id]?.nome || "?")[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div>
          <span className="font-semibold">{profilesMap[cm.user_id]?.nome || "Jogador"}: </span>
          <span className={cm.deletado ? "italic text-muted-foreground" : ""}>
            {cm.deletado ? "Comentário removido" : renderTextoComMencoes(cm.texto)}
          </span>
        </div>
        {!cm.deletado && (
          <button onClick={() => setRespondendoPara(cm)} className="mt-0.5 text-xs font-bold text-muted-foreground hover:text-primary">
            Responder
          </button>
        )}
      </div>
      {!cm.deletado && cm.user_id === user?.id && (
        <button onClick={() => delComent(cm.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
      )}
    </div>
  );

  return (
    <div id={`post-${post.id}`} className="rounded-2xl border border-border bg-card p-4 space-y-3 transition-all">
      <div className="flex items-center gap-2">
        {mostrarAvatar && (
          <Avatar className="h-8 w-8 shrink-0">
            {autorFoto ? <AvatarImage src={autorFoto} /> : null}
            <AvatarFallback className="bg-secondary text-xs">{(autorNome || "?")[0]}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {grupoNome && <span className="rounded-full bg-secondary px-2 py-0.5">{grupoNome}</span>}
          <span>{new Date(post.criado_em).toLocaleString("pt-BR")}</span>
        </div>
      </div>

      <PostBody tipo={post.tipo} c={c} />

      {/* Barra de ações estilo Instagram: ícone + contador lado a lado */}
      <div className="flex items-center gap-5 border-t border-border pt-2">
        <div className="flex items-center gap-1.5">
          <button onClick={curtirRapido} onDoubleClick={() => setOpenPicker((v) => !v)} className="transition active:scale-90">
            <span className={`text-2xl transition ${euCurti ? "" : "opacity-50 grayscale"}`}>⚽</span>
          </button>
          {totalReacoes > 0 && <span className="text-sm font-bold text-muted-foreground">{totalReacoes}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOpenComents((v) => !v)} className="transition active:scale-90">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </button>
          {totalComentarios > 0 && <span className="text-sm font-bold text-muted-foreground">{totalComentarios}</span>}
        </div>
        <button onClick={() => setOpenPicker((v) => !v)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          outras reações
        </button>
      </div>

      {openPicker && (
        <div className="flex gap-2 rounded-xl bg-secondary/40 p-2">
          {REACOES.map((r) => (
            <button key={r.tipo} onClick={() => toggleReact(r.tipo)}
              className={`text-2xl transition ${minhas.has(r.tipo) ? "scale-125" : "opacity-70 hover:opacity-100"}`}>
              {r.icon}
            </button>
          ))}
        </div>
      )}

      {(openComents || raizes.length > 0) && (
        <div className="space-y-1 border-t border-border pt-3">
          {!openComents && raizes.length > 2 && (
            <button onClick={() => setOpenComents(true)} className="text-xs text-primary">Ver todos os {totalComentarios} comentários</button>
          )}
          {raizesMostradas.map((cm) => (
            <div key={cm.id}>
              {renderComentario(cm, false)}
              {respostasDe(cm.id).map((r) => renderComentario(r, true))}
            </div>
          ))}
          {respondendoPara && (
            <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1 text-xs text-muted-foreground">
              Respondendo {profilesMap[respondendoPara.user_id]?.nome || "comentário"}
              <button onClick={() => setRespondendoPara(null)} className="ml-auto font-bold hover:text-foreground">✕</button>
            </div>
          )}
          <ComentarioInput
            membros={membros}
            onEnviar={(texto) => adicionarComentario(texto, respondendoPara?.id || null)}
          />
        </div>
      )}
    </div>
  );
}

function renderTextoComMencoes(texto: string) {
  const partes = texto.split(/(@[a-zA-Z0-9_]+)/g);
  return partes.map((parte, i) => (parte.startsWith("@") ? <span key={i} className="font-bold text-primary">{parte}</span> : parte));
}

function ComentarioInput({ membros, onEnviar }: { membros: Membro[]; onEnviar: (texto: string) => void }) {
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<Membro[]>([]);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onChangeTexto = (v: string) => {
    const val = v.slice(0, 140);
    setTexto(val);
    const m = val.match(/@([a-zA-Z0-9_]*)$/);
    if (m) {
      const termo = m[1].toLowerCase();
      setSugestoes(
        membros.filter((u) => (u.handle || "").toLowerCase().startsWith(termo) || u.nome.toLowerCase().startsWith(termo)).slice(0, 5),
      );
    } else {
      setSugestoes([]);
    }
  };

  const escolherMencao = (m: Membro) => {
    const alvo = m.handle || m.nome.split(" ")[0].toLowerCase();
    setTexto((prev) => prev.replace(/@([a-zA-Z0-9_]*)$/, `@${alvo} `).slice(0, 140));
    setSugestoes([]);
    inputRef.current?.focus();
  };

  const inserirEmoji = (e: string) => {
    setTexto((prev) => (prev + e).slice(0, 140));
  };

  const enviar = () => {
    if (!texto.trim()) return;
    onEnviar(texto);
    setTexto("");
    setSugestoes([]);
    setEmojiAberto(false);
  };

  return (
    <div className="relative">
      {sugestoes.length > 0 && (
        <div className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {sugestoes.map((m) => (
            <button key={m.user_id} onClick={() => escolherMencao(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
              <Avatar className="h-6 w-6"><AvatarImage src={m.foto_url || undefined} /><AvatarFallback className="text-[10px]">{m.nome[0]}</AvatarFallback></Avatar>
              <span className="font-medium">{m.nome}</span>
              {m.handle && <span className="text-xs text-primary">@{m.handle}</span>}
            </button>
          ))}
        </div>
      )}
      {emojiAberto && (
        <div className="absolute bottom-full z-10 mb-1 grid grid-cols-8 gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
          {EMOJIS_COMENTARIO.map((e) => (
            <button key={e} onClick={() => inserirEmoji(e)} className="text-xl transition hover:scale-125">{e}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setEmojiAberto((v) => !v)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <Smile className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Comentar... use @ pra marcar alguém"
          className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
        />
        <span className="self-center text-xs text-muted-foreground">{140 - texto.length}</span>
        <Button size="sm" onClick={enviar} disabled={!texto.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function PostBody({ tipo, c }: { tipo: string; c: any }) {
  switch (tipo) {
    case "resultado_pelada":
      return (
        <div>
          <div className="text-lg font-bold">🏆 {c.time_vencedor} venceu! ⚽ {c.placar}</div>
          <div className="text-xs text-muted-foreground">{c.partidas_jogadas} partidas jogadas{c.pelada_nome ? ` · ${c.pelada_nome}` : ""}</div>
          {Array.isArray(c.jogadores_vencedores) && c.jogadores_vencedores.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {c.jogadores_vencedores.map((j: any) => (
                <span key={j.user_id} className="rounded-full bg-secondary px-2 py-0.5">{j.nome}</span>
              ))}
            </div>
          )}
        </div>
      );
    case "mvp":
      return <div><div className="text-lg font-bold">⭐ {c.nome} foi eleito MVP!</div><div className="text-xs text-muted-foreground">{c.gols} gol(s) · {c.passes} passe(s) decisivo(s) · {c.pelada_nome}</div></div>;
    case "artilheiro":
      return <div><div className="text-lg font-bold">🥇 {c.nome} foi o artilheiro!</div><div className="text-xs text-muted-foreground">{c.gols} gols · {c.pelada_nome}</div></div>;
    case "resenha_premio": {
      const premio = PREMIOS[c.categoria] || { titulo: "recebeu um prêmio da resenha!", emoji: "🏅", cor: "text-primary" };
      return (
        <div>
          <div className="text-lg font-bold"><span className={premio.cor}>{premio.emoji} {c.nome} {premio.titulo}</span></div>
          {c.pelada_nome && <div className="text-xs text-muted-foreground">{c.pelada_nome}</div>}
        </div>
      );
    }
    case "sentimos_falta":
      return (
        <div>
          <div className="text-lg font-bold">{c.frase || `👀 Sentimos falta do ${c.nome} hoje!`}</div>
          {c.pelada_nome && <div className="text-xs text-muted-foreground">{c.pelada_nome}</div>}
        </div>
      );
    case "novo_selo":
      return <div className="text-lg font-bold">🏅 {c.nome} conquistou o selo {c.selo_nome} {c.selo_emoji}</div>;
    case "nova_ofensiva":
      return <div className="text-lg font-bold">{c.frase || `🔥 ${c.nome} está em chamas! ${c.sequencia} peladas seguidas!`}</div>;
    case "novo_nivel":
      return <div className="text-lg font-bold">{c.emoji} {c.nome} subiu para {c.nivel}!</div>;
    case "novo_membro":
      return <div className="text-lg font-bold">👋 {c.nome} entrou no grupo {c.grupo_nome}!</div>;
    case "desafio_completo":
      return <div className="text-lg font-bold">🏆 {c.nome} completou: {c.titulo}</div>;
    case "variacao_skill": {
      const positiva = (c.variacao ?? 0) >= 0;
      const previa = c.previa === true;
      return (
        <div>
          <div className="text-lg font-bold">
            {previa ? "📊" : positiva ? "📈" : "📉"} {c.nome}{" "}
            {previa
              ? `já subiu ${Math.abs(c.variacao).toFixed(1)} pontos nessa temporada! Continua assim...`
              : positiva
              ? `subiu ${Math.abs(c.variacao).toFixed(1)} pontos de skill essa temporada!`
              : `caiu ${Math.abs(c.variacao).toFixed(1)} pontos de skill... será que está na hora de treinar mais? 👀`}
          </div>
          {c.nivel_anterior != null && c.nivel_atual != null && (
            <div className="text-xs text-muted-foreground">Nível: {c.nivel_anterior} → {c.nivel_atual}</div>
          )}
        </div>
      );
    }
    case "patrocinio":
      return <div><div className="text-lg font-bold">📣 {c.titulo}</div><div className="text-sm">{c.mensagem}</div></div>;
    default:
      return <div className="text-sm">{JSON.stringify(c)}</div>;
  }
}
