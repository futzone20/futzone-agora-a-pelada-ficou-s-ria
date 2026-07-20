import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Temp = { id: string; numero: number; data_inicio: string; data_fim: string; status: string };
type Membro = { user_id: string; nome: string; foto_url: string | null; nivel: number };
type Row = { user_id: string; nome: string; foto_url: string | null; nivel: number; variacao: number; peladas: number };

export function TemporadaTab({ grupoId }: { grupoId: string }) {
  const [atual, setAtual] = useState<Temp | null>(null);
  const [anteriores, setAnteriores] = useState<Temp[]>([]);
  const [ranking, setRanking] = useState<Row[]>([]);
  const [destaques, setDestaques] = useState<{ evolucao?: Row; queda?: Row; ativo?: Row }>({});

  useEffect(() => {
    (async () => {
      const { data: temps } = await supabase.from("temporadas").select("*").order("numero", { ascending: false });
      const ativa = (temps || []).find((t: any) => t.status === "ativa") as Temp | undefined;
      setAtual(ativa || null);
      setAnteriores(((temps || []) as Temp[]).filter((t) => t.status === "encerrada"));

      if (!ativa) return;
      const { data: ms } = await supabase
        .from("grupo_membros")
        .select("user_id, profiles!inner(nome, foto_url), skills!inner(velocidade,drible,passe,chute,resistencia,posicionamento)")
        .eq("grupo_id", grupoId).eq("status", "ativo");

      const rows: Row[] = [];
      for (const m of (ms || []) as any[]) {
        const sk = m.skills;
        const nivel = sk ? (sk.velocidade + sk.drible + sk.passe + sk.chute + sk.resistencia + sk.posicionamento) / 6 : 3;
        const { data: avs } = await supabase
          .from("avaliacoes_skill_membro").select("nota_desempenho_geral, criado_em")
          .eq("avaliado_id", m.user_id).eq("grupo_id", grupoId).eq("tipo", "pos_pelada")
          .gte("criado_em", ativa.data_inicio);
        const notas = (avs || []).map((a: any) => a.nota_desempenho_geral).filter(Boolean);
        const desempenho = notas.length ? notas.reduce((a: number, b: number) => a + b, 0) / notas.length : 0;
        const variacao = desempenho ? (desempenho - 3) * 0.2 : 0;
        const { count } = await supabase
          .from("time_jogadores").select("pelada_id", { count: "exact", head: true })
          .eq("user_id", m.user_id);
        rows.push({
          user_id: m.user_id,
          nome: m.profiles?.nome || "—",
          foto_url: m.profiles?.foto_url || null,
          nivel, variacao,
          peladas: count || 0,
        });
      }
      rows.sort((a, b) => b.variacao - a.variacao);
      setRanking(rows);
      setDestaques({
        evolucao: [...rows].sort((a, b) => b.variacao - a.variacao)[0],
        queda: [...rows].sort((a, b) => a.variacao - b.variacao)[0],
        ativo: [...rows].sort((a, b) => b.peladas - a.peladas)[0],
      });
    })();
  }, [grupoId]);

  if (!atual) return <p className="text-sm text-muted-foreground">Nenhuma temporada ativa.</p>;

  const inicio = new Date(atual.data_inicio);
  const fim = new Date(atual.data_fim);
  const hoje = new Date();
  const dias = Math.max(0, Math.min(90, Math.round((hoje.getTime() - inicio.getTime()) / 86400000)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-lg font-bold">🏆 Temporada {atual.numero}</h3>
        <p className="text-xs text-muted-foreground">{inicio.toLocaleDateString("pt-BR")} até {fim.toLocaleDateString("pt-BR")}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${(dias / 90) * 100}%` }} />
        </div>
        <div className="mt-1 text-xs">Dia {dias} de 90</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {destaques.evolucao && (
          <div className="rounded-xl border border-border bg-card p-2 text-center">
            <div className="text-lg">📈</div>
            <div className="text-[10px] uppercase text-muted-foreground">Maior evolução</div>
            <div className="text-xs font-bold truncate">{destaques.evolucao.nome}</div>
            <div className="text-xs text-green-500">+{destaques.evolucao.variacao.toFixed(2)}</div>
          </div>
        )}
        {destaques.queda && (
          <div className="rounded-xl border border-border bg-card p-2 text-center">
            <div className="text-lg">📉</div>
            <div className="text-[10px] uppercase text-muted-foreground">Maior queda</div>
            <div className="text-xs font-bold truncate">{destaques.queda.nome}</div>
            <div className="text-xs text-red-500">{destaques.queda.variacao.toFixed(2)}</div>
          </div>
        )}
        {destaques.ativo && (
          <div className="rounded-xl border border-border bg-card p-2 text-center">
            <div className="text-lg">⚽</div>
            <div className="text-[10px] uppercase text-muted-foreground">Mais ativo</div>
            <div className="text-xs font-bold truncate">{destaques.ativo.nome}</div>
            <div className="text-xs">{destaques.ativo.peladas} peladas</div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Ranking da Temporada</h3>
        <div className="space-y-1">
          {ranking.map((r, i) => {
            const initials = (r.nome || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={r.user_id} className="flex items-center gap-2 rounded-lg bg-secondary/30 p-2">
                <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}º</span>
                <Avatar className="h-7 w-7">
                  {r.foto_url ? <AvatarImage src={r.foto_url} /> : null}
                  <AvatarFallback className="bg-secondary text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{r.nome}</div>
                  <div className="text-[10px] text-muted-foreground">Nível {r.nivel.toFixed(1)} · {r.peladas} pel.</div>
                </div>
                <span className={`text-xs font-bold ${r.variacao > 0 ? "text-green-500" : r.variacao < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {r.variacao > 0 ? "+" : ""}{r.variacao.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {anteriores.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="ant">
            <AccordionTrigger>Temporadas anteriores ({anteriores.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1">
                {anteriores.map((t) => (
                  <div key={t.id} className="rounded-lg bg-secondary/30 p-2 text-xs">
                    <strong>Temporada {t.numero}</strong> — {new Date(t.data_inicio).toLocaleDateString("pt-BR")} a {new Date(t.data_fim).toLocaleDateString("pt-BR")}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
