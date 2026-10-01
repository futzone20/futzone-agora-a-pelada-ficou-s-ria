import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Plus, CalendarPlus, Wallet, CheckCircle2, AlertTriangle, Trash2, Clock, RotateCcw, Repeat } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/agendamentos")({ component: AgPage });

function brl(n: number) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const FORMAS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Débito" },
  { value: "cartao_credito", label: "Crédito" },
];

const NOVO_VAZIO = {
  quadra_id: "", data: "", horario_inicio: "", horario_fim: "", cliente_nome: "",
  valor_cobrado: 0, forma_pagamento: "dinheiro", observacoes: "",
  pagamento_antecipado: false, fixa: false, repeticoes: 8,
};

// Calcula o valor sugerido com base no valor/hora (diurno ou noturno, conforme
// o horário de início) da quadra e na duração da reserva.
function minutosEntre(inicio: string, fim: string) {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  let min = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (min <= 0) min += 24 * 60;
  return min;
}

function valorHoraQuadra(quadra: any, horario: string) {
  if (!quadra) return 0;
  const corte = String(quadra.horario_corte_noturno || "18:00").slice(0, 5);
  const ehNoturno = horario >= corte;
  return Number((ehNoturno ? quadra.valor_noturno : quadra.valor_diurno) ?? quadra.valor_padrao ?? 0);
}

function calcularValorSugerido(quadra: any, horarioInicio: string, horarioFim: string) {
  if (!quadra || !horarioInicio || !horarioFim) return 0;
  const valorHora = valorHoraQuadra(quadra, horarioInicio);
  const minutos = minutosEntre(horarioInicio, horarioFim);
  return Math.round(valorHora * (minutos / 60) * 100) / 100;
}

function somarMinutos(horario: string, minutos: number) {
  const [h, m] = horario.split(":").map(Number);
  const total = (h * 60 + m + minutos + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Distância em linha reta entre duas coordenadas (fórmula de haversine),
// usada pra filtrar a busca de capitão por proximidade da arena em vez de
// comparar o texto da cidade (que varia de grafia e nunca bate).
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function AgPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroQuadra, setFiltroQuadra] = useState("todas");
  const [openBloq, setOpenBloq] = useState(false);
  const [bloq, setBloq] = useState<any>({ quadra_id: "", data: "", horario_inicio: "", horario_fim: "", motivo: "" });

  // Agendamento manual
  const [openNovo, setOpenNovo] = useState(false);
  const [novo, setNovo] = useState<any>(NOVO_VAZIO);
  const [valorManual, setValorManual] = useState(false);

  // Vincular a um capitão e um grupo dele (cria a pelada já, em "rascunho"
  // pendente de configuração, pro capitão só finalizar depois).
  const [vincularCapitao, setVincularCapitao] = useState(false);
  const [buscaCapitao, setBuscaCapitao] = useState("");
  const [capitaesBusca, setCapitaesBusca] = useState<any[]>([]);
  const [capitaoSelecionado, setCapitaoSelecionado] = useState<any>(null);
  const [gruposCapitao, setGruposCapitao] = useState<any[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState("");

  // Reagendar
  const [reagendarAg, setReagendarAg] = useState<any>(null);
  const [reagendarForm, setReagendarForm] = useState<any>({ quadra_id: "", data: "", horario_inicio: "", horario_fim: "" });

  // Dar baixa
  const [baixaAg, setBaixaAg] = useState<any>(null);
  const [baixaModo, setBaixaModo] = useState<"responsavel" | "dividido">("responsavel");
  const [baixaForma, setBaixaForma] = useState("dinheiro");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [novoParticipante, setNovoParticipante] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    const { data: q } = await supabase.from("quadras").select("*").eq("arena_id", a.id);
    setQuadras(q ?? []);
    const { data: ag } = await supabase.from("agendamentos").select("*, quadras(nome), profiles!agendamentos_capitao_id_fkey(nome)").eq("arena_id", a.id).order("data", { ascending: false }).order("horario_inicio");
    setAgendamentos(ag ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  // Preenche o valor sugerido automaticamente conforme a quadra/horário
  // escolhidos, a menos que o usuário já tenha editado o valor manualmente.
  useEffect(() => {
    if (!openNovo || valorManual) return;
    const quadra = quadras.find(q => q.id === novo.quadra_id);
    if (!quadra || !novo.horario_inicio || !novo.horario_fim) return;
    const sugerido = calcularValorSugerido(quadra, novo.horario_inicio, novo.horario_fim);
    setNovo((n: any) => ({ ...n, valor_cobrado: sugerido }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNovo, novo.quadra_id, novo.horario_inicio, novo.horario_fim, valorManual]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("agendamentos").update({ status, atualizado_em: new Date().toISOString() } as never).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); void load(); }
  };

  const criarBloqueio = async () => {
    const { error } = await supabase.from("bloqueios_agenda").insert(bloq as never);
    if (error) toast.error(error.message); else { toast.success("Bloqueio criado"); setOpenBloq(false); setBloq({ quadra_id: "", data: "", horario_inicio: "", horario_fim: "", motivo: "" }); }
  };

  const resetVinculo = () => {
    setVincularCapitao(false); setBuscaCapitao(""); setCapitaesBusca([]);
    setCapitaoSelecionado(null); setGruposCapitao([]); setGrupoSelecionado("");
  };

  // Busca ao vivo (debounced) conforme digita. Comparar o texto da cidade
  // (ex: "Santos Dumont" vs "Santos Dumont - MG") é frágil demais e deixava
  // de achar gente da própria cidade — em vez disso, quando a arena e o
  // capitão têm coordenadas, calculamos a distância e priorizamos/mostramos
  // quem está por perto (raio de RAIO_CAPITAO_KM). Sem coordenadas de um dos
  // dois lados, não tem como filtrar: mostramos o resultado com a cidade
  // escrita do lado, pra o dono decidir visualmente.
  const RAIO_CAPITAO_KM = 100;
  useEffect(() => {
    const q = buscaCapitao.trim();
    if (!vincularCapitao || capitaoSelecionado || !q || !arena) { setCapitaesBusca([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("user_id,nome,whatsapp,foto_url,cidade,latitude,longitude")
        .eq("role", "capitao").or(`nome.ilike.%${q}%,whatsapp.ilike.%${q}%`).limit(20);
      let resultados = data ?? [];
      if (arena.latitude != null && arena.longitude != null) {
        resultados = resultados
          .map((c: any) => ({ ...c, distanciaKm: (c.latitude != null && c.longitude != null) ? distanciaKm(arena.latitude, arena.longitude, c.latitude, c.longitude) : null }))
          .filter((c: any) => c.distanciaKm == null || c.distanciaKm <= RAIO_CAPITAO_KM)
          .sort((a: any, b: any) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
      }
      setCapitaesBusca(resultados.slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCapitao, vincularCapitao, capitaoSelecionado, arena]);

  const selecionarCapitao = async (c: any) => {
    setCapitaoSelecionado(c);
    setCapitaesBusca([]);
    setBuscaCapitao("");
    setGrupoSelecionado("");
    // Busca por dois caminhos e junta: via grupo_membros (papel=capitao) e
    // via grupos.criado_por diretamente — alguns grupos mais antigos nunca
    // ganharam a linha em grupo_membros (bug já corrigido na criação), mas
    // quem criou o grupo é capitão dele de qualquer forma.
    const [porMembro, porCriador] = await Promise.all([
      supabase.from("grupo_membros").select("grupo_id, grupos(id,nome)").eq("user_id", c.user_id).eq("papel", "capitao").eq("status", "ativo"),
      supabase.from("grupos").select("id,nome").eq("criado_por", c.user_id),
    ]);
    const porMembroGrupos = (porMembro.data ?? []).map((g: any) => g.grupos).filter(Boolean);
    const porCriadorGrupos = porCriador.data ?? [];
    const mapa = new Map<string, { id: string; nome: string }>();
    [...porMembroGrupos, ...porCriadorGrupos].forEach((g: any) => mapa.set(g.id, g));
    const grupos = Array.from(mapa.values());
    setGruposCapitao(grupos);
    if (grupos.length === 1) setGrupoSelecionado(grupos[0].id);
  };

  const criarAgendamentoManual = async () => {
    if (!arena || !user) return;
    const vinculando = vincularCapitao && !!capitaoSelecionado && !!grupoSelecionado;
    if (vincularCapitao && !vinculando) { toast.error("Selecione o capitão e o grupo dele"); return; }

    const base = {
      arena_id: arena.id, quadra_id: novo.quadra_id,
      capitao_id: vinculando ? capitaoSelecionado.user_id : user.id,
      grupo_id: vinculando ? grupoSelecionado : null,
      cliente_nome: vinculando ? capitaoSelecionado.nome : (novo.cliente_nome || null),
      horario_inicio: novo.horario_inicio, horario_fim: novo.horario_fim,
      valor_cobrado: novo.valor_cobrado, observacoes: novo.observacoes || null,
      status: "confirmado",
      pagamento_antecipado: !!novo.pagamento_antecipado,
      forma_pagamento: novo.pagamento_antecipado ? novo.forma_pagamento : null,
      // Pagamento antecipado = já recebido na hora da reserva: dá baixa de
      // imediato (gera o lançamento no financeiro via trigger).
      modo_cobranca: novo.pagamento_antecipado ? "responsavel" : null,
      baixa_dada: !!novo.pagamento_antecipado,
    };

    const datas: string[] = [novo.data];
    if (novo.fixa) {
      const [ano, mes, dia] = novo.data.split("-").map(Number);
      const d0 = new Date(ano, mes - 1, dia);
      for (let i = 1; i < Math.max(1, Number(novo.repeticoes) || 1); i++) {
        const d = new Date(d0); d.setDate(d0.getDate() + 7 * i);
        datas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    }
    const recorrenciaId = novo.fixa && datas.length > 1 ? crypto.randomUUID() : null;

    if (vinculando) {
      // Cada ocorrência vira a própria "pelada" (rascunho) na data certa —
      // o capitão finaliza a configuração depois, no perfil do grupo dele.
      for (const data of datas) {
        const { data: peladaRow, error: ePelada } = await supabase.from("peladas").insert({
          criado_por: capitaoSelecionado.user_id, grupo_id: grupoSelecionado, data,
          horario_inicio: novo.horario_inicio, horario_fim: novo.horario_fim,
          nome_pelada: `Pelada ${data.split("-").reverse().join("/")}`,
          configuracao_pendente: true,
        } as never).select("id").single();
        if (ePelada || !peladaRow) { toast.error(ePelada?.message || "Erro ao criar a pelada"); return; }
        const { error } = await supabase.from("agendamentos").insert({ ...base, data, recorrencia_id: recorrenciaId, pelada_id: (peladaRow as any).id } as never);
        if (error) { toast.error(error.message); return; }
      }
    } else {
      const linhas = datas.map(data => ({ ...base, data, recorrencia_id: recorrenciaId } as never));
      const { error } = await supabase.from("agendamentos").insert(linhas);
      if (error) { toast.error(error.message); return; }
    }

    toast.success(datas.length > 1 ? `Agendamento criado — ${datas.length} reservas fixas` : "Agendamento criado");
    setOpenNovo(false); setNovo(NOVO_VAZIO); setValorManual(false); resetVinculo(); void load();
  };

  // ---- Dar baixa ----
  const abrirBaixa = async (ag: any) => {
    setBaixaAg(ag);
    setBaixaForma(ag.forma_pagamento || "dinheiro");
    const { data: ps } = await supabase.from("agendamento_participantes").select("*").eq("agendamento_id", ag.id).order("pago").order("criado_em");
    setParticipantes(ps ?? []);
    setBaixaModo(ag.modo_cobranca === "dividido" || (ps && ps.length > 0) ? "dividido" : "responsavel");
    setNovoParticipante("");
  };

  const recarregarParticipantes = async () => {
    if (!baixaAg) return;
    const { data: ps } = await supabase.from("agendamento_participantes").select("*").eq("agendamento_id", baixaAg.id).order("pago").order("criado_em");
    setParticipantes(ps ?? []);
  };

  const addParticipante = async () => {
    if (!baixaAg || !novoParticipante.trim()) return;
    await supabase.from("agendamento_participantes").insert({ agendamento_id: baixaAg.id, nome: novoParticipante.trim() } as never);
    setNovoParticipante("");
    void recarregarParticipantes();
  };

  const togglePago = async (p: any) => {
    await supabase.from("agendamento_participantes").update({ pago: !p.pago, pago_em: !p.pago ? new Date().toISOString() : null } as never).eq("id", p.id);
    void recarregarParticipantes();
  };

  const removerParticipante = async (id: string) => {
    await supabase.from("agendamento_participantes").delete().eq("id", id);
    void recarregarParticipantes();
  };

  const confirmarBaixaResponsavel = async () => {
    if (!baixaAg) return;
    const { error } = await supabase.from("agendamentos").update({
      modo_cobranca: "responsavel", forma_pagamento: baixaForma, baixa_dada: true,
    } as never).eq("id", baixaAg.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Baixa registrada — lançado no financeiro");
    setBaixaAg(null); void load();
  };

  const confirmarBaixaDividido = async () => {
    if (!baixaAg || participantes.length === 0 || participantes.some(p => !p.pago)) return;
    const { error } = await supabase.from("agendamentos").update({
      modo_cobranca: "dividido", baixa_dada: true,
    } as never).eq("id", baixaAg.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Baixa registrada — lançado no financeiro");
    setBaixaAg(null); void load();
  };

  // ---- Adicionar tempo ----
  const adicionarTempo = async (ag: any, minutos: number) => {
    const quadra = quadras.find(q => q.id === ag.quadra_id);
    if (!quadra) { toast.error("Quadra não encontrada"); return; }
    const novoFim = somarMinutos(ag.horario_fim, minutos);

    const { data: outros } = await supabase.from("agendamentos").select("id,horario_inicio,status")
      .eq("quadra_id", ag.quadra_id).eq("data", ag.data).neq("id", ag.id).in("status", ["pendente", "confirmado"]);
    const haConflito = (outros ?? []).some((c: any) => c.horario_inicio >= ag.horario_fim && c.horario_inicio < novoFim);
    if (haConflito) { toast.error("Já existe outro horário marcado logo em seguida nessa quadra."); return; }

    const valorHora = valorHoraQuadra(quadra, ag.horario_fim);
    const extra = Math.round(valorHora * (minutos / 60) * 100) / 100;
    const { error } = await supabase.from("agendamentos").update({
      horario_fim: novoFim, valor_cobrado: Number(ag.valor_cobrado || 0) + extra,
    } as never).eq("id", ag.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`+${minutos}min adicionados — acréscimo de ${brl(extra)}`);
    void load();
  };

  // ---- Reagendar ----
  const abrirReagendar = (ag: any) => {
    setReagendarAg(ag);
    setReagendarForm({ quadra_id: ag.quadra_id, data: ag.data, horario_inicio: ag.horario_inicio?.slice(0, 5) ?? "", horario_fim: ag.horario_fim?.slice(0, 5) ?? "" });
  };

  const confirmarReagendar = async () => {
    if (!reagendarAg) return;
    const { data: outros } = await supabase.from("agendamentos").select("id,horario_inicio,horario_fim")
      .eq("quadra_id", reagendarForm.quadra_id).eq("data", reagendarForm.data).neq("id", reagendarAg.id).in("status", ["pendente", "confirmado"]);
    const haConflito = (outros ?? []).some((c: any) => c.horario_inicio < reagendarForm.horario_fim && c.horario_fim > reagendarForm.horario_inicio);
    if (haConflito) { toast.error("Conflito: já existe reserva nesse horário para essa quadra."); return; }

    const { error } = await supabase.from("agendamentos").update({
      quadra_id: reagendarForm.quadra_id, data: reagendarForm.data,
      horario_inicio: reagendarForm.horario_inicio, horario_fim: reagendarForm.horario_fim,
      atualizado_em: new Date().toISOString(),
    } as never).eq("id", reagendarAg.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reagendado com sucesso");
    setReagendarAg(null); void load();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const filtrados = agendamentos.filter(a =>
    (filtroStatus === "todos" || a.status === filtroStatus) &&
    (filtroQuadra === "todas" || a.quadra_id === filtroQuadra)
  );

  const todosPagos = participantes.length > 0 && participantes.every(p => p.pago);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="todos">Todos status</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="confirmado">Confirmado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem><SelectItem value="concluido">Concluído</SelectItem>
        </SelectContent></Select>
        <Select value={filtroQuadra} onValueChange={setFiltroQuadra}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="todas">Todas quadras</SelectItem>
          {quadras.map(q => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
        </SelectContent></Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Dialog open={openNovo} onOpenChange={o => { setOpenNovo(o); if (!o) { setNovo(NOVO_VAZIO); setValorManual(false); resetVinculo(); } }}>
          <DialogTrigger asChild><Button><CalendarPlus className="h-4 w-4 mr-1" />Novo agendamento</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Agendar horário manualmente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Local (quadra)</Label><Select value={novo.quadra_id} onValueChange={v => setNovo({ ...novo, quadra_id: v })}><SelectTrigger><SelectValue placeholder="Selecione a quadra" /></SelectTrigger><SelectContent>{quadras.map(q => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}</SelectContent></Select></div>
              {!vincularCapitao && (
                <div><Label>Nome do cliente</Label><Input value={novo.cliente_nome} onChange={e => setNovo({ ...novo, cliente_nome: e.target.value })} placeholder="Ex: João (grupo da pelada de sexta)" /></div>
              )}

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Vincular a um capitão?</Label>
                  <p className="text-[11px] text-muted-foreground">Já cria a pelada pro grupo dele, pendente de configuração</p>
                </div>
                <Switch checked={vincularCapitao} onCheckedChange={v => { setVincularCapitao(v); if (!v) resetVinculo(); }} />
              </div>
              {vincularCapitao && (
                <div className="space-y-2 rounded-lg border p-3">
                  {!capitaoSelecionado ? (
                    <>
                      <Input placeholder="Nome ou WhatsApp do capitão" value={buscaCapitao} onChange={e => setBuscaCapitao(e.target.value)} />
                      {arena?.latitude == null && (
                        <p className="text-[11px] text-muted-foreground">Cadastre a localização da sua arena pra ordenar por quem está mais perto.</p>
                      )}
                      <div className="space-y-1">
                        {capitaesBusca.map(c => (
                          <div key={c.user_id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted text-sm" onClick={() => selecionarCapitao(c)}>
                            <Avatar className="h-7 w-7">
                              {c.foto_url ? <AvatarImage src={c.foto_url} /> : null}
                              <AvatarFallback className="text-xs">{c.nome?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.nome}</div>
                              {(c.cidade || c.distanciaKm != null) && (
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {c.cidade}{c.cidade && c.distanciaKm != null ? " · " : ""}{c.distanciaKm != null ? `${Math.round(c.distanciaKm)} km` : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {capitaesBusca.length === 0 && buscaCapitao.trim() && (
                        <p className="text-xs text-muted-foreground">Nenhum capitão encontrado{arena?.latitude != null ? ` num raio de ${RAIO_CAPITAO_KM}km` : ""}.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm flex-1 min-w-0">
                          <Avatar className="h-7 w-7">
                            {capitaoSelecionado.foto_url ? <AvatarImage src={capitaoSelecionado.foto_url} /> : null}
                            <AvatarFallback className="text-xs">{capitaoSelecionado.nome?.[0]}</AvatarFallback>
                          </Avatar>
                          <b className="truncate">{capitaoSelecionado.nome}</b>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setCapitaoSelecionado(null); setGruposCapitao([]); setGrupoSelecionado(""); }}>Trocar</Button>
                      </div>
                      {gruposCapitao.length === 0 && <p className="text-xs text-amber-500">Esse capitão não tem nenhum grupo — não é possível vincular.</p>}
                      {gruposCapitao.length > 1 && (
                        <div><Label>Qual grupo dele?</Label><Select value={grupoSelecionado} onValueChange={setGrupoSelecionado}><SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger><SelectContent>{gruposCapitao.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select></div>
                      )}
                      {gruposCapitao.length === 1 && <p className="text-xs text-muted-foreground">Grupo: <b className="text-foreground">{gruposCapitao[0].nome}</b></p>}
                    </>
                  )}
                </div>
              )}

              <div><Label>Data</Label><Input type="date" value={novo.data} onChange={e => setNovo({ ...novo, data: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="time" value={novo.horario_inicio} onChange={e => setNovo({ ...novo, horario_inicio: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={novo.horario_fim} onChange={e => setNovo({ ...novo, horario_fim: e.target.value })} /></div>
              </div>
              <div>
                <Label>Valor cobrado</Label>
                <Input type="number" step="0.01" value={novo.valor_cobrado} onChange={e => { setValorManual(true); setNovo({ ...novo, valor_cobrado: +e.target.value }); }} />
                <p className="text-[11px] text-muted-foreground mt-1">Preenchido automaticamente conforme o valor diurno/noturno da quadra — pode editar se quiser.</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Pagamento antecipado?</Label>
                  <p className="text-[11px] text-muted-foreground">O cliente já pagou ao agendar</p>
                </div>
                <Switch checked={novo.pagamento_antecipado} onCheckedChange={v => setNovo({ ...novo, pagamento_antecipado: v })} />
              </div>
              {novo.pagamento_antecipado && (
                <div><Label>Forma de pagamento</Label><Select value={novo.forma_pagamento} onValueChange={v => setNovo({ ...novo, forma_pagamento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
              )}

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Pelada fixa?</Label>
                  <p className="text-[11px] text-muted-foreground">Repete semanalmente neste mesmo dia e horário</p>
                </div>
                <Switch checked={novo.fixa} onCheckedChange={v => setNovo({ ...novo, fixa: v })} />
              </div>
              {novo.fixa && (
                <div><Label>Quantas semanas repetir</Label><Input type="number" min={2} value={novo.repeticoes} onChange={e => setNovo({ ...novo, repeticoes: +e.target.value })} /></div>
              )}

              <div><Label>Observações (opcional)</Label><Input value={novo.observacoes} onChange={e => setNovo({ ...novo, observacoes: e.target.value })} /></div>
              {!novo.pagamento_antecipado && <p className="text-xs text-muted-foreground">O pagamento só entra no financeiro quando você "Dar baixa" depois de criado.</p>}
              <Button onClick={criarAgendamentoManual} className="w-full" disabled={!novo.quadra_id || !novo.data || !novo.horario_inicio || !novo.horario_fim || (vincularCapitao && (!capitaoSelecionado || !grupoSelecionado))}>
                {novo.fixa ? <><Repeat className="h-4 w-4 mr-1" />Agendar fixo</> : "Agendar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openBloq} onOpenChange={setOpenBloq}>
          <DialogTrigger asChild><Button variant="outline"><Lock className="h-4 w-4 mr-1" />Bloquear horário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Bloquear horário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Quadra</Label><Select value={bloq.quadra_id} onValueChange={v => setBloq({ ...bloq, quadra_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{quadras.map(q => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Data</Label><Input type="date" value={bloq.data} onChange={e => setBloq({ ...bloq, data: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="time" value={bloq.horario_inicio} onChange={e => setBloq({ ...bloq, horario_inicio: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={bloq.horario_fim} onChange={e => setBloq({ ...bloq, horario_fim: e.target.value })} /></div>
              </div>
              <div><Label>Motivo</Label><Input value={bloq.motivo} onChange={e => setBloq({ ...bloq, motivo: e.target.value })} /></div>
              <Button onClick={criarBloqueio} className="w-full" disabled={!bloq.quadra_id || !bloq.data || !bloq.horario_inicio}><Plus className="h-4 w-4 mr-1" />Bloquear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filtrados.map((a: any) => {
        const nomeCliente = a.cliente_nome || a.profiles?.nome || "—";
        const podeDarBaixa = a.status === "confirmado" || a.status === "concluido";
        return (
          <Card key={a.id} className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{a.data} · {a.horario_inicio?.slice(0, 5)}–{a.horario_fim?.slice(0, 5)}</div>
                <div className="text-xs text-muted-foreground">{a.quadras?.nome} · {nomeCliente}</div>
                <div className="text-sm mt-1">{brl(Number(a.valor_cobrado || 0))}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={a.status === "confirmado" ? "default" : a.status === "cancelado" ? "destructive" : "outline"}>{a.status}</Badge>
                {a.baixa_dada ? (
                  <span className="text-[11px] text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />Pago</span>
                ) : podeDarBaixa ? (
                  <span className="text-[11px] text-amber-500 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />Falta pagar</span>
                ) : null}
              </div>
            </div>
            {a.status === "pendente" && <div className="flex gap-2 mt-2"><Button size="sm" onClick={() => updateStatus(a.id, "confirmado")}>Confirmar</Button><Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "cancelado")}>Cancelar</Button></div>}
            <div className="flex flex-wrap gap-2 mt-2">
              {a.status === "confirmado" && <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "concluido")}>Concluir</Button>}
              {podeDarBaixa && !a.baixa_dada && <Button size="sm" onClick={() => abrirBaixa(a)}><Wallet className="h-3.5 w-3.5 mr-1" />Dar baixa</Button>}
              {podeDarBaixa && a.baixa_dada && <Button size="sm" variant="ghost" onClick={() => abrirBaixa(a)}>Ver pagamento</Button>}
              {a.status === "confirmado" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => adicionarTempo(a, 30)}><Clock className="h-3.5 w-3.5 mr-1" />+30min</Button>
                  <Button size="sm" variant="outline" onClick={() => adicionarTempo(a, 60)}><Clock className="h-3.5 w-3.5 mr-1" />+60min</Button>
                  <Button size="sm" variant="outline" onClick={() => abrirReagendar(a)}><RotateCcw className="h-3.5 w-3.5 mr-1" />Reagendar</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "cancelado")}>Cancelar</Button>
                </>
              )}
            </div>
          </Card>
        );
      })}
      {filtrados.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem agendamentos.</p>}

      {/* Dar baixa */}
      <Dialog open={!!baixaAg} onOpenChange={o => !o && setBaixaAg(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dar baixa — {brl(Number(baixaAg?.valor_cobrado || 0))}</DialogTitle></DialogHeader>
          {baixaAg && (
            <div className="space-y-3">
              {baixaAg.baixa_dada ? (
                <div className="rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-bold text-center p-3 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />Pagamento já registrado
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant={baixaModo === "responsavel" ? "default" : "outline"} className="flex-1" onClick={() => setBaixaModo("responsavel")}>Um responsável</Button>
                  <Button type="button" variant={baixaModo === "dividido" ? "default" : "outline"} className="flex-1" onClick={() => setBaixaModo("dividido")}>Dividir entre participantes</Button>
                </div>
              )}

              {baixaModo === "responsavel" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Recebeu o valor total de um responsável pelo grupo? Marque como pago.</p>
                  {!baixaAg.baixa_dada && (
                    <>
                      <div><Label>Forma de pagamento</Label><Select value={baixaForma} onValueChange={setBaixaForma}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                      <Button onClick={confirmarBaixaResponsavel} className="w-full">Marcar como recebido — {brl(Number(baixaAg.valor_cobrado || 0))}</Button>
                    </>
                  )}
                </div>
              )}

              {baixaModo === "dividido" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Adicione cada participante e marque quem já pagou. A baixa só pode ser confirmada quando todos estiverem pagos.</p>
                  {!baixaAg.baixa_dada && (
                    <div className="flex gap-2">
                      <Input placeholder="Nome do participante" value={novoParticipante} onChange={e => setNovoParticipante(e.target.value)} onKeyDown={e => e.key === "Enter" && addParticipante()} />
                      <Button type="button" onClick={addParticipante}><Plus className="h-4 w-4" /></Button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {participantes.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum participante adicionado ainda.</p>}
                    {participantes.map(p => (
                      <div key={p.id} className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${p.pago ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <Checkbox checked={p.pago} onCheckedChange={() => togglePago(p)} disabled={baixaAg.baixa_dada} />
                          <span className={p.pago ? "" : "font-bold"}>{p.nome}</span>
                        </label>
                        {!p.pago && <span className="text-[11px] text-amber-500">pendente</span>}
                        {!baixaAg.baixa_dada && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerParticipante(p.id)}><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!baixaAg.baixa_dada && (
                    <Button onClick={confirmarBaixaDividido} disabled={!todosPagos} className="w-full">
                      {todosPagos ? `Confirmar baixa — ${brl(Number(baixaAg.valor_cobrado || 0))}` : "Falta alguém pagar"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reagendar */}
      <Dialog open={!!reagendarAg} onOpenChange={o => !o && setReagendarAg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reagendar</DialogTitle></DialogHeader>
          {reagendarAg && (
            <div className="space-y-3">
              <div><Label>Local (quadra)</Label><Select value={reagendarForm.quadra_id} onValueChange={v => setReagendarForm({ ...reagendarForm, quadra_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{quadras.map(q => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Data</Label><Input type="date" value={reagendarForm.data} onChange={e => setReagendarForm({ ...reagendarForm, data: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="time" value={reagendarForm.horario_inicio} onChange={e => setReagendarForm({ ...reagendarForm, horario_inicio: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={reagendarForm.horario_fim} onChange={e => setReagendarForm({ ...reagendarForm, horario_fim: e.target.value })} /></div>
              </div>
              <Button onClick={confirmarReagendar} className="w-full" disabled={!reagendarForm.quadra_id || !reagendarForm.data || !reagendarForm.horario_inicio || !reagendarForm.horario_fim}>Confirmar novo horário</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
