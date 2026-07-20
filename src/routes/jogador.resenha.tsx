import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/jogador/resenha")({
  component: FeedPage,
});

const REACOES = [
  { tipo: "bola", icon: "⚽" },
  { tipo: "fogo", icon: "🔥" },
  { tipo: "luva", icon: "🧤" },
  { tipo: "risada", icon: "😂" },
  { tipo: "aplauso", icon: "👏" },
  { tipo: "foguete", icon: "🚀" },
];

type Post = {
  id: string;
  grupo_id: string | null;
  tipo: string;
  pelada_id: string | null;
  user_id: string | null;
  conteudo: any;
  criado_em: string;
};

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [gruposMap, setGruposMap] = useState<Record<string, string>>({});
  const [reacoes, setReacoes] = useState<Record<string, any[]>>({});
  const [comentarios, setComentarios] = useState<Record<string, any[]>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, { nome: string }>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: gms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo");
    const gruposIds = (gms || []).map((g: any) => g.grupo_id);
    const { data: gs } = await supabase.from("grupos").select("id,nome").in("id", gruposIds.length ? gruposIds : ["00000000-0000-0000-0000-000000000000"]);
    const gMap: Record<string, string> = {};
    (gs || []).forEach((g: any) => { gMap[g.id] = g.nome; });
    setGruposMap(gMap);

    const { data: ps } = await supabase.from("feed_posts").select("*").order("criado_em", { ascending: false }).limit(50);
    const list = (ps as any[]) || [];
    setPosts(list);

    const postIds = list.map((p) => p.id);
    if (postIds.length) {
      const [{ data: rs }, { data: cs }] = await Promise.all([
        supabase.from("feed_reacoes").select("*").in("post_id", postIds),
        supabase.from("feed_comentarios").select("*").in("post_id", postIds).order("criado_em"),
      ]);
      const rMap: Record<string, any[]> = {}, cMap: Record<string, any[]> = {};
      (rs || []).forEach((r: any) => { (rMap[r.post_id] = rMap[r.post_id] || []).push(r); });
      (cs || []).forEach((c: any) => { (cMap[c.post_id] = cMap[c.post_id] || []).push(c); });
      setReacoes(rMap); setComentarios(cMap);

      const allUserIds = new Set<string>();
      list.forEach((p) => p.user_id && allUserIds.add(p.user_id));
      (cs || []).forEach((c: any) => allUserIds.add(c.user_id));
      if (allUserIds.size) {
        const { data: profs } = await supabase.from("profiles").select("user_id,nome").in("user_id", Array.from(allUserIds));
        const pm: Record<string, { nome: string }> = {};
        (profs || []).forEach((p: any) => { pm[p.user_id] = { nome: p.nome }; });
        setProfilesMap(pm);
      }
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    const ch = supabase.channel("feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_reacoes" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comentarios" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando feed...</div>;
  if (!posts.length) return <EmptyState icon={MessageCircle} title="Nenhum post ainda" description="Jogue uma pelada e o feed começa a bombar." />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Resenha</h2>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} grupoNome={p.grupo_id ? gruposMap[p.grupo_id] : null}
          reacoes={reacoes[p.id] || []} comentarios={comentarios[p.id] || []}
          profilesMap={profilesMap} onChange={load} />
      ))}
    </div>
  );
}

function PostCard({ post, grupoNome, reacoes, comentarios, profilesMap, onChange }: any) {
  const { user } = useAuth();
  const [openReact, setOpenReact] = useState(false);
  const [openComents, setOpenComents] = useState(false);
  const [texto, setTexto] = useState("");

  const c = post.conteudo || {};
  const counts: Record<string, number> = {};
  const minhas = new Set<string>();
  reacoes.forEach((r: any) => {
    counts[r.tipo] = (counts[r.tipo] || 0) + 1;
    if (r.user_id === user?.id) minhas.add(r.tipo);
  });

  const toggleReact = async (tipo: string) => {
    if (!user) return;
    if (minhas.has(tipo)) {
      await supabase.from("feed_reacoes").delete().eq("post_id", post.id).eq("user_id", user.id).eq("tipo", tipo);
    } else {
      await supabase.from("feed_reacoes").insert({ post_id: post.id, user_id: user.id, tipo } as never);
    }
    onChange();
  };

  const comentar = async () => {
    if (!user || !texto.trim()) return;
    await supabase.from("feed_comentarios").insert({ post_id: post.id, user_id: user.id, texto: texto.slice(0, 140) } as never);
    setTexto(""); onChange();
  };

  const delComent = async (id: string) => {
    await supabase.from("feed_comentarios").update({ deletado: true } as never).eq("id", id);
    onChange();
  };

  const visibles = comentarios.filter((x: any) => !x.deletado || true);
  const shown = openComents ? visibles : visibles.slice(0, 3);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {grupoNome && <span className="px-2 py-0.5 rounded-full bg-secondary">{grupoNome}</span>}
        <span>{new Date(post.criado_em).toLocaleString("pt-BR")}</span>
      </div>
      <PostBody tipo={post.tipo} c={c} />

      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(counts).map(([t, n]) => (
          <span key={t} className="px-2 py-0.5 rounded-full bg-secondary/60">
            {REACOES.find((r) => r.tipo === t)?.icon} {n}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpenReact((x) => !x)}>Reagir</Button>
        <Button size="sm" variant="outline" onClick={() => setOpenComents((x) => !x)}>
          Comentar {visibles.length > 0 ? `(${visibles.length})` : ""}
        </Button>
      </div>

      {openReact && (
        <div className="flex gap-2 rounded-xl bg-secondary/40 p-2">
          {REACOES.map((r) => (
            <button key={r.tipo} onClick={() => toggleReact(r.tipo)}
              className={`text-2xl transition ${minhas.has(r.tipo) ? "scale-125" : "opacity-70 hover:opacity-100"}`}>
              {r.icon}
            </button>
          ))}
        </div>
      )}

      {(openComents || visibles.length > 0) && (
        <div className="space-y-2 border-t border-border pt-3">
          {shown.map((cm: any) => (
            <div key={cm.id} className="flex items-start gap-2 text-sm">
              <div className="flex-1">
                <span className="font-semibold">{profilesMap[cm.user_id]?.nome || "Jogador"}: </span>
                <span className={cm.deletado ? "italic text-muted-foreground" : ""}>
                  {cm.deletado ? "Comentário removido" : cm.texto}
                </span>
              </div>
              {!cm.deletado && cm.user_id === user?.id && (
                <button onClick={() => delComent(cm.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              )}
            </div>
          ))}
          {!openComents && visibles.length > 3 && (
            <button onClick={() => setOpenComents(true)} className="text-xs text-primary">Ver todos ({visibles.length})</button>
          )}
          <div className="flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 140))}
              onKeyDown={(e) => e.key === "Enter" && comentar()}
              placeholder="Comentar..." className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm outline-none" />
            <span className="self-center text-xs text-muted-foreground">{140 - texto.length}</span>
            <Button size="sm" onClick={comentar} disabled={!texto.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
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
    case "novo_selo":
      return <div className="text-lg font-bold">🏅 {c.nome} conquistou o selo {c.selo_nome} {c.selo_emoji}</div>;
    case "nova_ofensiva":
      return <div className="text-lg font-bold">🔥 {c.nome} está em chamas! {c.sequencia} peladas seguidas!</div>;
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
