import { supabase } from "@/integrations/supabase/client";

export const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_debito: "Cartão de débito", cartao_credito: "Cartão de crédito",
  boleto: "Boleto", transferencia: "Transferência", cashback: "Cashback",
};

export const formaLabel = (f?: string | null) => (f ? FORMAS_PAGAMENTO[f] ?? f : "—");

// De onde veio uma entrada: quadra (reservas), PDV ou outro (lançamento manual).
// Entradas manuais guardam a escolha em "categoria".
export type OrigemEntrada = "quadra" | "pdv" | "outro";
export const ORIGEM_ENTRADA_LABEL: Record<OrigemEntrada, string> = { quadra: "Quadra", pdv: "PDV", outro: "Outro" };
export function origemEntrada(l: { origem: string; categoria?: string | null }): OrigemEntrada {
  if (l.origem === "pdv") return "pdv";
  if (l.origem === "agendamento") return "quadra";
  return l.categoria === "quadra" || l.categoria === "pdv" ? (l.categoria as OrigemEntrada) : "outro";
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const inicioMesISO = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

/**
 * Despesas de um período, de forma "inteligente" para compras parceladas:
 * cada parcela entra no mês do SEU vencimento. Período de 1 mês => 1 parcela
 * da compra no cartão; de 3 meses => 3 parcelas. Soma também as despesas
 * antigas lançadas manualmente em financeiro_lancamentos (tipo 'despesa').
 */
export async function carregarDespesasPeriodo(arenaId: string, ini: string, fim: string) {
  const [{ data: parcelas }, { data: antigas }] = await Promise.all([
    supabase.from("saida_parcelas")
      .select("*, saidas(descricao, categoria, forma_pagamento, data_compra, fornecedores(nome))")
      .eq("arena_id", arenaId).gte("vencimento", ini).lte("vencimento", fim).order("vencimento", { ascending: false }),
    supabase.from("financeiro_lancamentos").select("*").eq("arena_id", arenaId).eq("tipo", "despesa")
      .gte("data_lancamento", ini).lte("data_lancamento", fim),
  ]);
  const ps = (parcelas ?? []) as any[];
  const as = (antigas ?? []) as any[];
  const total = ps.reduce((s, p) => s + Number(p.valor), 0) + as.reduce((s, l) => s + Number(l.valor), 0);
  const pagas = ps.filter(p => p.pago).reduce((s, p) => s + Number(p.valor), 0) + as.reduce((s, l) => s + Number(l.valor), 0);
  return { parcelas: ps, despesasAntigas: as, total, pagas, aPagar: total - pagas };
}
