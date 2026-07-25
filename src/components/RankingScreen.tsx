import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { calcularRankingPelada, type LinhaRankingPelada } from "@/lib/rankingPelada";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CompartilharPodio } from "@/components/CompartilharPodio";
import { Trophy, Info, Share2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type Grupo = { id: string; nome: string };
type Pelada = { id: string; nome_pelada: string; data: string };

const MEDALHAS = ["🥇", "🥈", "🥉"];

export function RankingScreen() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [peladaSel, setPeladaSel] = useState("");
  const [linhas, setLinhas] = useState<LinhaRankingPelada[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [compartilharOpen, setCompartilharOpen] = useState(false);

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
    if (!peladaSel) { setLinhas([]); return; }
    setLoadingRanking(true);
    void calcularRankingPelada(peladaSel).then((r) => { setLinhas(r); setLoadingRanking(false); });
  }, [peladaSel]);

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
          <PopoverContent className="max-w-xs text-xs text-muted-foreground">
            Ranking de uma pelada específica: soma os lances da partida (gol, passe, defesa...) com a nota que os colegas te deram na avaliação — nota baixa nunca tira ponto, só nota 4 e 5 somam.
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {grupos.length > 1 ? (
          <Select value={grupoSel} onValueChange={setGrupoSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
          </Select>
        ) : <div />}

        {peladas.length > 0 && (
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
        <EmptyState icon={Trophy} title="Sem dados nessa pelada" description="Ninguém pontuou ainda — pode ser que os lances ou avaliações não tenham sido registrados." />
      ) : (
        <>
          {linhas.length >= 3 && <Podio linhas={linhas} meuId={user?.id} />}
          {linhas.length >= 3 && linhas.slice(0, 3).some((l) => l.user_id === user?.id) && (
            <Button variant="outline" className="w-full" onClick={() => setCompartilharOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar meu pódio
            </Button>
          )}
          <div className="space-y-2">
            {linhas.slice(3).map((l, i) => (
              <div key={l.user_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${l.user_id === user?.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">{i + 4}</span>
                <Avatar className="h-8 w-8 shrink-0">
                  {l.foto_url ? <AvatarImage src={l.foto_url} /> : null}
                  <AvatarFallback className="bg-secondary text-xs">{l.nome[0]}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm font-bold">{l.nome}</span>
                <span className={`text-sm font-bold ${l.pontos >= 0 ? "text-primary" : "text-destructive"}`}>{l.pontos} <span className="text-[10px] font-normal text-muted-foreground">pts</span></span>
              </div>
            ))}
            {linhas.length < 3 && linhas.map((l, i) => (
              <div key={l.user_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${l.user_id === user?.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <span className="w-7 shrink-0 text-center text-base font-bold">{MEDALHAS[i]}</span>
                <Avatar className="h-8 w-8 shrink-0">
                  {l.foto_url ? <AvatarImage src={l.foto_url} /> : null}
                  <AvatarFallback className="bg-secondary text-xs">{l.nome[0]}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm font-bold">{l.nome}</span>
                <span className={`text-sm font-bold ${l.pontos >= 0 ? "text-primary" : "text-destructive"}`}>{l.pontos} <span className="text-[10px] font-normal text-muted-foreground">pts</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      <CompartilharPodio
        open={compartilharOpen}
        onOpenChange={setCompartilharOpen}
        linhas={linhas}
        peladaNome={peladas.find((p) => p.id === peladaSel)?.nome_pelada || ""}
        data={peladas.find((p) => p.id === peladaSel)?.data || new Date().toISOString().slice(0, 10)}
        meuId={user?.id}
      />
    </div>
  );
}

function Podio({ linhas, meuId }: { linhas: LinhaRankingPelada[]; meuId: string | undefined }) {
  const [primeiro, segundo, terceiro] = linhas;
  const alturas = { 1: "h-24", 2: "h-16", 3: "h-12" } as const;
  const cores = {
    1: { texto: "text-primary", borda: "border-primary", fundo: "bg-primary/20" },
    2: { texto: "text-slate-300", borda: "border-slate-300", fundo: "bg-slate-300/20" },
    3: { texto: "text-orange-400", borda: "border-orange-400", fundo: "bg-orange-400/20" },
  } as const;

  const Bloco = ({ l, posicao }: { l: LinhaRankingPelada; posicao: 1 | 2 | 3 }) => (
    <div className="flex flex-1 flex-col items-center">
      <Avatar className={`mb-1.5 shrink-0 border-2 ${posicao === 1 ? "h-16 w-16" : "h-12 w-12"} ${cores[posicao].borda}`}>
        {l.foto_url ? <AvatarImage src={l.foto_url} /> : null}
        <AvatarFallback className="bg-secondary text-sm">{l.nome[0]}</AvatarFallback>
      </Avatar>
      <span className="max-w-full truncate text-center text-xs font-bold">{l.nome}{l.user_id === meuId ? " (você)" : ""}</span>
      <span className={`text-[11px] font-bold ${cores[posicao].texto}`}>{l.pontos} pts</span>
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
