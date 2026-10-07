import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, Download } from "lucide-react";
import { brl, carregarDespesasPeriodo, formaLabel, hojeISO, inicioMesISO, ORIGEM_ENTRADA_LABEL, origemEntrada } from "@/lib/financeiro";

export const Route = createFileRoute("/dono/financeiro/")({ component: FinanceiroResumo });

const LIMITE = 10;

function FinanceiroResumo() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [ini, setIni] = useState(inicioMesISO);
  const [fim, setFim] = useState(hojeISO);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [desp, setDesp] = useState<{ parcelas: any[]; despesasAntigas: any[]; total: number; pagas: number; aPagar: number }>({ parcelas: [], despesasAntigas: [], total: 0, pagas: 0, aPagar: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
      if (!a) return;
      setArena(a);
      const { data } = await supabase.from("financeiro_lancamentos").select("*").eq("arena_id", a.id).eq("tipo", "receita")
        .gte("data_lancamento", ini).lte("data_lancamento", fim).order("data_lancamento", { ascending: false }).order("criado_em", { ascending: false });
      setEntradas(data ?? []);
      setDesp(await carregarDespesasPeriodo(a.id, ini, fim));
    })();
  }, [user?.id, ini, fim]);

  const totRec = entradas.reduce((s, l) => s + Number(l.valor), 0);
  const lucro = totRec - desp.total;

  // Últimas saídas: parcelas do período + despesas antigas lançadas à mão, da mais recente pra mais antiga
  const saidasRecentes = useMemo(() => {
    const linhas = [
      ...desp.parcelas.map(p => ({
        id: p.id, data: p.vencimento, valor: Number(p.valor), pago: p.pago,
        titulo: p.saidas?.descricao ?? "Saída",
        detalhe: `${p.saidas?.fornecedores?.nome ? p.saidas.fornecedores.nome + " · " : ""}${p.total_parcelas > 1 ? `parcela ${p.numero}/${p.total_parcelas}` : formaLabel(p.saidas?.forma_pagamento)}`,
      })),
      ...desp.despesasAntigas.map(l => ({ id: l.id, data: l.data_lancamento, valor: Number(l.valor), pago: true, titulo: l.descricao, detalhe: "lançamento manual" })),
    ];
    return linhas.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, LIMITE);
  }, [desp]);

  const exportar = () => {
    const linhas = [
      ...entradas.map(l => `${l.data_lancamento},entrada,${ORIGEM_ENTRADA_LABEL[origemEntrada(l)]},${formaLabel(l.forma_pagamento)},"${l.descricao}",${l.valor}`),
      ...desp.parcelas.map(p => `${p.vencimento},saida,${p.saidas?.categoria ?? ""},${formaLabel(p.saidas?.forma_pagamento)},"${(p.saidas?.descricao ?? "").replace(/"/g, "'")} (${p.numero}/${p.total_parcelas})",${p.valor}`),
      ...desp.despesasAntigas.map(l => `${l.data_lancamento},saida,${l.categoria ?? ""},,"${l.descricao}",${l.valor}`),
    ];
    const csv = "data,tipo,origem_ou_categoria,forma_pagamento,descricao,valor\n" + linhas.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "financeiro.csv"; a.click();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e => setIni(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Receitas</div><div className="text-emerald-500 font-bold">{brl(totRec)}</div></Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Despesas</div>
          <div className="text-rose-500 font-bold">{brl(desp.total)}</div>
          {desp.aPagar > 0 && <div className="text-[10px] text-muted-foreground">{brl(desp.aPagar)} a pagar</div>}
        </Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Lucro</div><div className={`font-bold ${lucro >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{brl(lucro)}</div></Card>
      </div>
      <p className="text-[11px] text-muted-foreground">Compras parceladas entram pelo vencimento de cada parcela: um período de 1 mês mostra só 1 parcela, de 3 meses mostra 3.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-bold"><ArrowUpCircle className="h-4 w-4 text-emerald-500" />Últimas entradas</div>
            <Link to="/dono/financeiro/entradas" className="text-xs text-primary">Ver todas</Link>
          </div>
          {entradas.slice(0, LIMITE).map(l => (
            <Card key={l.id} className="p-3 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{l.descricao}</div>
                <div className="text-xs text-muted-foreground">{new Date(l.data_lancamento + "T12:00:00").toLocaleDateString("pt-BR")} · {ORIGEM_ENTRADA_LABEL[origemEntrada(l)]} · {formaLabel(l.forma_pagamento)}</div>
              </div>
              <div className="font-bold text-emerald-500 shrink-0">+{brl(Number(l.valor))}</div>
            </Card>
          ))}
          {entradas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrada no período.</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-bold"><ArrowDownCircle className="h-4 w-4 text-rose-500" />Últimas saídas</div>
            <Link to="/dono/financeiro/saidas" className="text-xs text-primary">Ver todas</Link>
          </div>
          {saidasRecentes.map(l => (
            <Card key={l.id} className="p-3 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{l.titulo}</div>
                <div className="text-xs text-muted-foreground">{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")} · {l.detalhe}{!l.pago && " · a pagar"}</div>
              </div>
              <div className="font-bold text-rose-500 shrink-0">-{brl(l.valor)}</div>
            </Card>
          ))}
          {saidasRecentes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma saída no período.</p>}
        </div>
      </div>

      <div className="text-center"><Button variant="outline" size="sm" onClick={exportar}><Download className="h-3.5 w-3.5 mr-1" />Exportar CSV</Button></div>
    </div>
  );
}
