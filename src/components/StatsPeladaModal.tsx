import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Time = { id: string; nome: string; cor: string };
type Partida = { id: string; numero_partida: number; time_a_id: string; time_b_id: string; placar_a: number; placar_b: number; encerrada_em: string | null };
type Lance = { id: string; tipo: string; user_id: string; time_id: string; partida_id: string; criado_em: string };

export function StatsPeladaModal({ open, onOpenChange, peladaId }: { open: boolean; onOpenChange: (v: boolean) => void; peladaId: string }) {
  const [times, setTimes] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [lances, setLances] = useState<Lance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      const [{ data: t }, { data: p }, { data: l }] = await Promise.all([
        supabase.from("times").select("id, nome, cor").eq("pelada_id", peladaId),
        supabase.from("partidas").select("*").eq("pelada_id", peladaId).eq("status", "encerrada").order("numero_partida"),
        supabase.from("lances").select("*").eq("pelada_id", peladaId),
      ]);
      setTimes((t as any) || []);
      setPartidas((p as any) || []);
      setLances((l as any) || []);
      const uids = Array.from(new Set(((l as any) || []).map((x: any) => x.user_id).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: prs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
        const map: Record<string, string> = {};
        (prs || []).forEach((x: any) => { map[x.user_id] = x.nome || "Jogador"; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [open, peladaId]);

  const tabela = times.map((t) => {
    let v = 0, e = 0, d = 0, gm = 0, gs = 0;
    for (const p of partidas) {
      let fav = 0, con = 0;
      if (p.time_a_id === t.id) { fav = p.placar_a; con = p.placar_b; }
      else if (p.time_b_id === t.id) { fav = p.placar_b; con = p.placar_a; }
      else continue;
      gm += fav; gs += con;
      if (fav > con) v++; else if (fav === con) e++; else d++;
    }
    return { ...t, v, e, d, gm, gs, pts: v * 3 + e };
  }).sort((a, b) => b.pts - a.pts || (b.gm - b.gs) - (a.gm - a.gs));

  const golsPorUser: Record<string, number> = {};
  lances.filter((l) => l.tipo === "gol" && l.user_id).forEach((l) => { golsPorUser[l.user_id] = (golsPorUser[l.user_id] || 0) + 1; });
  const artilheiros = Object.entries(golsPorUser).map(([uid, gols]) => ({ uid, nome: profiles[uid] || "Jogador", gols })).sort((a, b) => b.gols - a.gols);

  const timeNome = (id: string) => times.find((t) => t.id === id)?.nome || "Time";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader><DialogTitle>📊 Estatísticas da Pelada</DialogTitle></DialogHeader>
        {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : (
          <Tabs defaultValue="tabela">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tabela">Times</TabsTrigger>
              <TabsTrigger value="art">Artilheiros</TabsTrigger>
              <TabsTrigger value="hist">Partidas</TabsTrigger>
            </TabsList>
            <TabsContent value="tabela">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground">
                    <th className="p-2 text-left">#</th><th className="p-2 text-left">Time</th>
                    <th className="p-2">V</th><th className="p-2">E</th><th className="p-2">D</th>
                    <th className="p-2">GM</th><th className="p-2">GS</th><th className="p-2 text-primary">Pts</th>
                  </tr></thead>
                  <tbody>{tabela.map((t, i) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="p-2">{i + 1}º</td>
                      <td className="p-2"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-border" style={{ background: t.cor }} />{t.nome}</span></td>
                      <td className="p-2 text-center">{t.v}</td><td className="p-2 text-center">{t.e}</td><td className="p-2 text-center">{t.d}</td>
                      <td className="p-2 text-center">{t.gm}</td><td className="p-2 text-center">{t.gs}</td>
                      <td className="p-2 text-center font-bold text-primary">{t.pts}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="art">
              {artilheiros.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum gol registrado.</p> : (
                <div className="space-y-2">{artilheiros.map((a, i) => (
                  <div key={a.uid} className={`flex items-center justify-between rounded-lg p-3 ${i === 0 ? "border-2 border-primary bg-primary/10" : "bg-secondary/40"}`}>
                    <span className="flex items-center gap-2">{i === 0 && "⚽"}<span className="font-bold">{i + 1}º</span> {a.nome}</span>
                    <span className={`font-bold ${i === 0 ? "text-primary" : ""}`}>{a.gols} {a.gols === 1 ? "gol" : "gols"}</span>
                  </div>
                ))}</div>
              )}
            </TabsContent>
            <TabsContent value="hist">
              {partidas.length === 0 ? <p className="text-sm text-muted-foreground">Sem partidas encerradas.</p> : (
                <div className="space-y-3">{partidas.map((p) => {
                  const lancesP = lances.filter((l) => l.partida_id === p.id);
                  const resultado = p.placar_a > p.placar_b ? `Vitória ${timeNome(p.time_a_id)}` : p.placar_b > p.placar_a ? `Vitória ${timeNome(p.time_b_id)}` : "Empate";
                  return (
                    <details key={p.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                      <summary className="cursor-pointer text-sm">
                        <span className="font-bold">Partida {p.numero_partida}:</span> {timeNome(p.time_a_id)} <span className="font-black">{p.placar_a} x {p.placar_b}</span> {timeNome(p.time_b_id)}
                        <div className="text-xs text-muted-foreground">{resultado}</div>
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {lancesP.length === 0 ? <span className="text-muted-foreground">Sem lances.</span> : lancesP.map((l) => (
                          <div key={l.id} className="flex justify-between">
                            <span>{l.tipo === "gol" ? "⚽" : l.tipo === "passe_decisivo" ? "🎯" : l.tipo === "defesa" ? "🧤" : "•"} {profiles[l.user_id] || "Jogador"} ({timeNome(l.time_id)})</span>
                            <span className="text-muted-foreground">{new Date(l.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
