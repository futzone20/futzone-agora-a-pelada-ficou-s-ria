import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Flame } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/jogador/ranking")({ component: RankingPage });

type Linha = { user_id: string; nome: string; pontos: number; selo?: { icone_emoji: string; nome: string } | null };

function RankingPage() {
  const { user } = useAuth();
  const [global, setGlobal] = useState<Linha[]>([]);
  const [grupo, setGrupo] = useState<Linha[]>([]);
  const [pelada, setPelada] = useState<Linha[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [grupoSel, setGrupoSel] = useState<string>("");

  const carregarTitulo = async (uids: string[]): Promise<Record<string, any>> => {
    if (!uids.length) return {};
    const { data: us } = await supabase
      .from("usuario_selos").select("user_id, selos!inner(icone_emoji, nome, categoria, condicao_valor)")
      .in("user_id", uids);
    const out: Record<string, any> = {};
    (us || []).forEach((x: any) => {
      if (x.selos.categoria === "progressao") {
        if (!out[x.user_id] || out[x.user_id].condicao_valor < x.selos.condicao_valor) {
          out[x.user_id] = x.selos;
        }
      }
    });
    return out;
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: gs } = await supabase.from("profiles").select("user_id, nome, pontos_total").order("pontos_total", { ascending: false }).limit(50);
      const titulos = await carregarTitulo((gs || []).map((x: any) => x.user_id));
      setGlobal((gs || []).map((x: any) => ({ user_id: x.user_id, nome: x.nome, pontos: x.pontos_total, selo: titulos[x.user_id] })));

      const { data: ms } = await supabase.from("grupo_membros").select("grupo_id, grupos!inner(id, nome)").eq("user_id", user.id).eq("status", "ativo");
      const gList = (ms || []).map((m: any) => m.grupos);
      setGrupos(gList);
      if (gList.length && !grupoSel) setGrupoSel(gList[0].id);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!grupoSel) return;
    void (async () => {
      const { data: mem } = await supabase.from("grupo_membros").select("user_id").eq("grupo_id", grupoSel).eq("status", "ativo");
      const uids = (mem || []).map((m: any) => m.user_id);
      if (!uids.length) { setGrupo([]); return; }
      const inicio = new Date(); inicio.setDate(1);
      const { data: hist } = await supabase.from("pontos_historico").select("user_id, valor_pontos")
        .in("user_id", uids).gte("criado_em", inicio.toISOString());
      const acc: Record<string, number> = {};
      (hist || []).forEach((h: any) => { acc[h.user_id] = (acc[h.user_id] || 0) + h.valor_pontos; });
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
      const titulos = await carregarTitulo(uids);
      const list: Linha[] = (profs || []).map((p: any) => ({ user_id: p.user_id, nome: p.nome, pontos: acc[p.user_id] || 0, selo: titulos[p.user_id] }))
        .sort((a, b) => b.pontos - a.pontos);
      setGrupo(list);

      // última pelada
      const { data: ult } = await supabase.from("peladas").select("id").in("grupo_id", [grupoSel]).order("data", { ascending: false }).limit(1);
      if (ult?.[0]) {
        const { data: lances } = await supabase.from("lances").select("user_id, tipo").eq("pelada_id", ult[0].id);
        const stats: Record<string, { g: number; p: number; d: number }> = {};
        (lances || []).forEach((l: any) => {
          stats[l.user_id] = stats[l.user_id] || { g: 0, p: 0, d: 0 };
          if (l.tipo === "gol") stats[l.user_id].g++;
          else if (l.tipo === "passe_decisivo") stats[l.user_id].p++;
          else if (l.tipo === "defesa") stats[l.user_id].d++;
        });
        const peladaUids = Object.keys(stats);
        const { data: profs2 } = await supabase.from("profiles").select("user_id, nome").in("user_id", peladaUids.length ? peladaUids : ["00000000-0000-0000-0000-000000000000"]);
        const profMap = new Map((profs2 || []).map((p: any) => [p.user_id, p.nome]));
        const titulosP = await carregarTitulo(peladaUids);
        const linhas: Linha[] = peladaUids.map((u) => ({
          user_id: u, nome: profMap.get(u) || "—",
          pontos: stats[u].g * 100 + stats[u].p * 10 + stats[u].d,
          selo: titulosP[u],
        })).sort((a, b) => b.pontos - a.pontos);
        setPelada(linhas);
      } else setPelada([]);
    })();
  }, [grupoSel]);

  const linhaRender = (l: Linha, i: number, sufixo = "pts") => (
    <div key={l.user_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${l.user_id === user?.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
      <div className="flex-1">
        <div className="text-sm font-bold">{l.nome}</div>
        {l.selo && <div className="text-[10px] text-muted-foreground">{l.selo.icone_emoji} {l.selo.nome}</div>}
      </div>
      <span className="text-sm font-bold text-primary">{l.pontos} <span className="text-[10px] font-normal text-muted-foreground">{sufixo}</span></span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Ranking</h2>
      </div>

      <Tabs defaultValue="pelada">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pelada">Pelada</TabsTrigger>
          <TabsTrigger value="grupo">Grupo</TabsTrigger>
          <TabsTrigger value="global">Global</TabsTrigger>
        </TabsList>

        <TabsContent value="pelada" className="space-y-2 pt-3">
          {pelada.length === 0 ? <EmptyState icon={Trophy} title="Sem dados ainda" /> : pelada.map((l, i) => linhaRender(l, i, "stat"))}
        </TabsContent>

        <TabsContent value="grupo" className="space-y-2 pt-3">
          {grupos.length > 1 && (
            <select value={grupoSel} onChange={(e) => setGrupoSel(e.target.value)} className="w-full rounded-lg border border-border bg-card p-2 text-sm">
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          )}
          {grupo.length === 0 ? <EmptyState icon={Trophy} title="Sem dados ainda" /> : grupo.map((l, i) => linhaRender(l, i))}
        </TabsContent>

        <TabsContent value="global" className="space-y-2 pt-3">
          {global.length === 0 ? <EmptyState icon={Trophy} title="Sem dados ainda" /> : global.map((l, i) => linhaRender(l, i))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
