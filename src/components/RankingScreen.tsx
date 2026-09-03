import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { calcularRankingPelada, type LinhaRankingPelada } from "@/lib/rankingPelada";
import { calcularRankingGrupo, calcularArtilharia, calcularMenosVazado, type LinhaRankingGrupo, type LinhaArtilharia, type LinhaGoleiro } from "@/lib/rankingGrupo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CompartilharPodio } from "@/components/CompartilharPodio";
import { Trophy, Info, Share2, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

type Grupo = { id: string; nome: string };
type Pelada = { id: string; nome_pelada: string; data: string };
type Escopo = "pelada" | "grupo";
type Categoria = "geral" | "artilharia" | "goleiros";

type LinhaExibicao = { user_id: string; nome: string; foto_url: string | null; valor: number; sufixo: string };

const MEDALHAS = ["🥇", "🥈", "🥉"];

export function RankingScreen() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [peladaSel, setPeladaSel] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("pelada");
  const [categoria, setCategoria] = useState<Categoria>("geral");

  const [linhasGeralPelada, setLinhasGeralPelada] = useState<LinhaRankingPelada[]>([]);
  const [linhas, setLinhas] = useState<LinhaExibicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [compartilharOpen, setCompartilharOpen] = useState(false);
  const [postando, setPostando] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: gms } = await supabase.from("grupo_membros").select("grupo_id").eq("user_id", user.id).eq("status", "ativo");
      const gruposIds = Array.from(new Set((gms || []).map((g: any) => g.grupo_id as string)));
      if (!gruposIds.length) { setLoading(false); return; }
      const { data: gs } = await supabase.from("grupos").select("id, nome").in("id", gruposIds);
      setGrupos((gs as any[]) || []);
      setGrupoSel(gruposIds[0]);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!grupoSel) return;
    void (async () => {
      const { data: ps } = await supabase.from("peladas").select("id, nome_pelada, data")
        .eq("grupo_id", grupoSel).eq("status", "encerrada").order("data", { ascending: false }).limit(30);
      const lista = (ps as any[]) || [];
      setPeladas(lista);
      setPeladaSel(lista[0]?.id || "");
    })();
  }, [grupoSel]);

  useEffect(() => {
    if (!grupoSel) return;
    if (escopo === "pelada" && !peladaSel) { setLinhas([]); return; }
    setLoadingRanking(true);
    void (async () => {
      const peladaIdsGrupo = peladas.map((p) => p.id);

      if (categoria === "geral") {
        if (escopo === "pelada") {
          const r = await calcularRankingPelada(peladaSel);
          setLinhasGeralPelada(r);
          setLinhas(r.map((l) => ({ user_id: l.user_id, nome: l.nome, foto_url: l.foto_url, valor: l.pontos, sufixo: "pts" })));
        } else {
          const r = await calcularRankingGrupo(grupoSel);
          setLinhas(r.map((l: LinhaRankingGrupo) => ({ user_id: l.user_id, nome: l.nome, foto_url: l.foto_url, valor: l.pontos, sufixo: "pts" })));
        }
      } else if (categoria === "artilharia") {
        const ids = escopo === "pelada" ? [peladaSel] : peladaIdsGrupo;
        const r = await calcularArtilharia(ids);
        setLinhas(r.map((l: LinhaArtilharia) => ({ user_id: l.user_id, nome: l.nome, foto_url: l.foto_url, valor: l.gols, sufixo: l.gols === 1 ? "gol" : "gols" })));
      } else {
        const ids = escopo === "pelada" ? [peladaSel] : peladaIdsGrupo;
        const r = await calcularMenosVazado(ids);
        setLinhas(r.map((l: LinhaGoleiro) => ({ user_id: l.user_id, nome: l.nome, foto_url: l.foto_url, valor: Math.round(l.media * 10) / 10, sufixo: `gols/jogo (${l.partidas}j)` })));
      }
      setLoadingRanking(false);
    })();
  }, [grupoSel, peladaSel, escopo, categoria, peladas.length]);

  const compartilharNaResenha = async () => {
    if (!user || !grupoSel || linhas.length === 0) return;
    setPostando(true);
    const top3 = linhas.slice(0, 3).map((l) => ({ user_id: l.user_id, nome: l.nome, valor: l.valor, sufixo: l.sufixo }));
    const tituloCategoria = categoria === "geral" ? "Ranking Geral" : categoria === "artilharia" ? "Artilharia" : "Goleiro Menos Vazado";
    const contexto = escopo === "pelada" ? (peladas.find((p) => p.id === peladaSel)?.nome_pelada || "") : "temporada do grupo";
    const { error } = await (supabase as any).rpc("criar_feed_post", {
      _grupo: grupoSel, _tipo: "ranking_compartilhado", _pelada: escopo === "pelada" ? peladaSel : null, _user: user.id,
      _conteudo: { titulo: tituloCategoria, contexto, top3 },
    });
    setPostando(false);
    if (error) return toast.error(error.message);
    toast.success("Ranking postado na Resenha!");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  if (!grupos.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Ranking</h2></div>
        <EmptyState icon={Trophy} title="Nenhum grupo ainda" description="Entre em um grupo e jogue uma pelada pra aparecer o ranking aqui." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Ranking</h2>
        <Popover>
          <PopoverTrigger asChild>
            <button className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="max-w-xs text-xs text-muted-foreground space-y-1.5">
            <p><b>Geral:</b> gol +7, passe decisivo +5, defesa de goleiro +6, defesa de linha +3, frango -5, falta -3, amarelo -8, vermelho -15. Avaliação (1-10): a partir da nota 5, cada ponto de nota vale o dobro em pontos (nota 5 = +10, nota 10 = +20). Nota abaixo de 5 nunca desconta. +1 por vitória do time, +5 se foi campeão da pelada.</p>
            <p><b>Artilharia:</b> só a contagem de gols.</p>
            <p><b>Goleiros:</b> média de gols sofridos por partida (menor é melhor).</p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setEscopo("pelada")} className={`rounded-lg border py-2 text-xs font-bold ${escopo === "pelada" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Só essa pelada</button>
        <button onClick={() => setEscopo("grupo")} className={`rounded-lg border py-2 text-xs font-bold ${escopo === "grupo" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Grupo (soma tudo)</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setCategoria("geral")} className={`rounded-lg border py-1.5 text-[11px] font-bold ${categoria === "geral" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>🏆 Geral</button>
        <button onClick={() => setCategoria("artilharia")} className={`rounded-lg border py-1.5 text-[11px] font-bold ${categoria === "artilharia" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>⚽ Artilharia</button>
        <button onClick={() => setCategoria("goleiros")} className={`rounded-lg border py-1.5 text-[11px] font-bold ${categoria === "goleiros" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>🧤 Goleiros</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {grupos.length > 1 ? (
          <Select value={grupoSel} onValueChange={setGrupoSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
          </Select>
        ) : <div />}

        {escopo === "pelada" && peladas.length > 0 && (
          <Select value={peladaSel} onValueChange={setPeladaSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {peladas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome_pelada} · {p.data.split("-").reverse().join("/")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loadingRanking ? (
        <div className="text-sm text-muted-foreground">Calculando ranking...</div>
      ) : !peladas.length ? (
        <EmptyState icon={Trophy} title="Nenhuma pelada encerrada ainda" description="Assim que a primeira pelada desse grupo terminar, o ranking aparece aqui." />
      ) : linhas.length === 0 ? (
        <EmptyState icon={Trophy} title="Sem dados por aqui" description="Ninguém pontuou ainda nessa categoria." />
      ) : (
        <>
          {linhas.length >= 3 && <Podio linhas={linhas} meuId={user?.id} />}
          <div className="flex gap-2">
            {escopo === "pelada" && categoria === "geral" && linhas.length >= 3 && linhas.slice(0, 3).some((l) => l.user_id === user?.id) && (
              <Button variant="outline" className="flex-1" onClick={() => setCompartilharOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar meu pódio
              </Button>
            )}
            <Button variant="outline" className="flex-1" disabled={postando} onClick={compartilharNaResenha}>
              <MessageSquare className="mr-2 h-4 w-4" /> {postando ? "Postando..." : "Postar na Resenha"}
            </Button>
          </div>
          <div className="space-y-2">
            {(linhas.length >= 3 ? linhas.slice(3) : linhas).map((l, i) => {
              const posicao = linhas.length >= 3 ? i + 4 : i + 1;
              return (
                <div key={l.user_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${l.user_id === user?.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  {linhas.length >= 3 ? (
                    <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">{posicao}</span>
                  ) : (
                    <span className="w-7 shrink-0 text-center text-base font-bold">{MEDALHAS[i] || posicao}</span>
                  )}
                  <Avatar className="h-8 w-8 shrink-0">
                    {l.foto_url ? <AvatarImage src={l.foto_url} /> : null}
                    <AvatarFallback className="bg-secondary text-xs">{l.nome[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-bold">{l.nome}</span>
                  <span className={`text-sm font-bold ${l.valor >= 0 ? "text-primary" : "text-destructive"}`}>{l.valor} <span className="text-[10px] font-normal text-muted-foreground">{l.sufixo}</span></span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <CompartilharPodio
        open={compartilharOpen}
        onOpenChange={setCompartilharOpen}
        linhas={linhasGeralPelada}
        peladaNome={peladas.find((p) => p.id === peladaSel)?.nome_pelada || ""}
        data={peladas.find((p) => p.id === peladaSel)?.data || new Date().toISOString().slice(0, 10)}
        meuId={user?.id}
      />
    </div>
  );
}

function Podio({ linhas, meuId }: { linhas: LinhaExibicao[]; meuId: string | undefined }) {
  const [primeiro, segundo, terceiro] = linhas;
  const alturas = { 1: "h-24", 2: "h-16", 3: "h-12" } as const;
  const cores = {
    1: { texto: "text-primary", borda: "border-primary", fundo: "bg-primary/20" },
    2: { texto: "text-slate-300", borda: "border-slate-300", fundo: "bg-slate-300/20" },
    3: { texto: "text-orange-400", borda: "border-orange-400", fundo: "bg-orange-400/20" },
  } as const;

  const Bloco = ({ l, posicao }: { l: LinhaExibicao; posicao: 1 | 2 | 3 }) => (
    <div className="flex flex-1 flex-col items-center">
      <Avatar className={`mb-1.5 shrink-0 border-2 ${posicao === 1 ? "h-16 w-16" : "h-12 w-12"} ${cores[posicao].borda}`}>
        {l.foto_url ? <AvatarImage src={l.foto_url} /> : null}
        <AvatarFallback className="bg-secondary text-sm">{l.nome[0]}</AvatarFallback>
      </Avatar>
      <span className="max-w-full truncate text-center text-xs font-bold">{l.nome}{l.user_id === meuId ? " (você)" : ""}</span>
      <span className={`text-[11px] font-bold ${cores[posicao].texto}`}>{l.valor} {l.sufixo}</span>
      <div className={`mt-1.5 flex w-full items-start justify-center rounded-t-lg border ${alturas[posicao]} ${cores[posicao].fundo} ${cores[posicao].borda}`}>
        <span className={`mt-1.5 text-lg font-black ${cores[posicao].texto}`}>{posicao}º</span>
      </div>
    </div>
  );

  return (
    <div className="flex items-end justify-center gap-2 rounded-2xl border border-border bg-card p-4 pb-3">
      <Bloco l={segundo} posicao={2} />
      <Bloco l={primeiro} posicao={1} />
      <Bloco l={terceiro} posicao={3} />
    </div>
  );
}
