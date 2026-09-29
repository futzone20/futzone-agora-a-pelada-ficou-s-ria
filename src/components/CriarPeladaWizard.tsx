import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Users2, ClipboardList, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Quadra = { id: string; nome: string; cidade: string | null };

// Soma minutos a um horário "HH:MM" e devolve o resultado também em "HH:MM".
function calcularHorarioFim(inicio: string, minutos: number): string {
  if (!inicio || !minutos) return inicio || "";
  const [h, m] = inicio.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return inicio;
  const totalMin = (h * 60 + m + minutos) % (24 * 60);
  const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const ETAPAS = [
  { n: 1, label: "Local & Horário", icon: MapPin },
  { n: 2, label: "Configuração", icon: Users2 },
  { n: 3, label: "Regras", icon: ClipboardList },
] as const;

export function CriarPeladaWizard({ grupoId, onCreated }: { grupoId: string; onCreated: (peladaId?: string) => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<"publica" | "cliente">("publica");
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<string>("");
  const [novaQuadra, setNovaQuadra] = useState(false);
  const [novaQ, setNovaQ] = useState({ nome: "", endereco: "", cidade: "", estado: "", tipo_superficie: "society" as const, capacidade_total: 14 });
  const [form, setForm] = useState({
    nome_pelada: "", data: "", horario_inicio: "20:00", horario_fim: calcularHorarioFim("20:00", 60),
    duracao_partida_minutos: 10,
    tempo_locado_minutos: 60,
    tempo_locado_custom: false,
    gols_para_encerrar_ativo: false,
    gols_para_encerrar: 2,
    numero_times: 2,
    jogadores_linha_por_time: 4,
    goleiros_por_time: 1,
    modalidade_goleiro: "fixo" as "fixo" | "sorteado",
    sistema_disputa: "rodizio" as const,
    regra_empate_rodizio: "time_atual_sai" as "time_atual_sai" | "time_atual_fica",
    recorrente: false,
    dia_semana: 2 as number,
    antecedencia_dias_lista: 3,
    horario_abertura_lista: "09:00",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.from("quadras_publicas").select("id, nome, cidade").eq("publica", true).order("nome").then(({ data }) => setQuadras((data as any) || []));
  }, []);

  const cadastrarQuadra = async () => {
    if (!user || !novaQ.nome.trim()) return;
    const { data, error } = await supabase.from("quadras_publicas").insert({ ...novaQ, criada_por: user.id } as never).select("id, nome, cidade").single();
    if (error) return toast.error(error.message);
    setQuadras([...quadras, data as any]);
    setQuadraId((data as any).id);
    setNovaQuadra(false);
    toast.success("Quadra cadastrada");
  };

  const totalPorTime = form.jogadores_linha_por_time + form.goleiros_por_time;

  const validarEtapa1 = () => {
    if (!form.nome_pelada.trim()) { toast.error("Dá um nome pra essa pelada"); return false; }
    if (!form.data) { toast.error("Escolha a data"); return false; }
    if (!form.horario_inicio) { toast.error("Escolha o horário de início"); return false; }
    return true;
  };

  const irPara = (destino: 1 | 2 | 3) => {
    if (destino > step && step === 1 && !validarEtapa1()) return;
    setStep(destino);
  };

  // Chamado só pelo clique explícito no botão "Criar Pelada" (nunca por submit
  // nativo do form — ver comentário na tag <div> logo abaixo do porquê disso).
  const criarPelada = async () => {
    if (!user || loading) return;
    if (!validarEtapa1()) { setStep(1); return; }
    setLoading(true);
    const { tempo_locado_custom, gols_para_encerrar_ativo, ...rest } = form;
    void tempo_locado_custom;
    const payload: any = {
      grupo_id: grupoId,
      criado_por: user.id,
      ...rest,
      jogadores_por_time: form.jogadores_linha_por_time,
      gols_para_encerrar: gols_para_encerrar_ativo ? form.gols_para_encerrar : null,
      dia_semana: form.recorrente ? form.dia_semana : null,
    };
    if (tipo === "publica" && quadraId) payload.quadra_id = quadraId;
    const { data: nova, error } = await supabase.from("peladas").insert(payload as never).select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pelada criada");
    onCreated((nova as any)?.id);
  };

  return (
    // Propositalmente uma <div>, não um <form>: o botão "Criar Pelada" (etapa 3)
    // e o botão "Continuar" (etapas 1-2) ficam na mesma posição do rodapé, e o
    // React reaproveita o mesmo elemento <button> ao trocar de etapa, só mudando
    // o atributo "type" — só que, se um deles fosse type="submit" dentro de um
    // <form>, o clique em "Continuar" que leva à etapa 3 disparava o submit do
    // form sozinho (o navegador via aquele clique como submit assim que o type
    // mudava). Por isso a criação da pelada é chamada direto no onClick, nunca
    // via evento de submit do formulário.
    <div className="space-y-4">
      {/* Indicador de etapas */}
      <div className="flex items-center gap-1">
        {ETAPAS.map((e, idx) => {
          const ativa = step === e.n;
          const concluida = step > e.n;
          const Icon = e.icon;
          return (
            <div key={e.n} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => irPara(e.n as 1 | 2 | 3)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-center transition ${
                  ativa ? "bg-primary/10 text-primary" : concluida ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
                  ativa ? "border-primary bg-primary text-primary-foreground" : concluida ? "border-primary text-primary" : "border-border"
                }`}>
                  {concluida ? <Check className="h-3.5 w-3.5" /> : e.n}
                </span>
                <span className="text-[9px] font-bold uppercase leading-none">{e.label}</span>
              </button>
              {idx < ETAPAS.length - 1 && <div className={`h-px flex-1 ${step > e.n ? "bg-primary" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      {/* ETAPA 1 — Local & Horário */}
      {step === 1 && (
        <div className="space-y-3">
          <div><Label>Nome da pelada</Label><Input required value={form.nome_pelada} onChange={(e) => setForm({ ...form, nome_pelada: e.target.value })} placeholder="Pelada de Quinta" /></div>

          <div>
            <Label>Tipo de quadra</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="publica">Quadra Pública</SelectItem>
                <SelectItem value="cliente">Quadra MrFut (cliente)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "publica" && (
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
              {!novaQuadra ? (
                <>
                  <Label>Selecionar quadra</Label>
                  <Select value={quadraId} onValueChange={setQuadraId}>
                    <SelectTrigger><SelectValue placeholder="Buscar..." /></SelectTrigger>
                    <SelectContent>
                      {quadras.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}{q.cidade ? ` — ${q.cidade}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setNovaQuadra(true)}><Plus className="mr-1 h-3 w-3" />Cadastrar nova quadra</Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Input placeholder="Nome" value={novaQ.nome} onChange={(e) => setNovaQ({ ...novaQ, nome: e.target.value })} />
                  <Input placeholder="Endereço" value={novaQ.endereco} onChange={(e) => setNovaQ({ ...novaQ, endereco: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Cidade" value={novaQ.cidade} onChange={(e) => setNovaQ({ ...novaQ, cidade: e.target.value })} />
                    <Input placeholder="UF" maxLength={2} value={novaQ.estado} onChange={(e) => setNovaQ({ ...novaQ, estado: e.target.value })} />
                  </div>
                  <Select value={novaQ.tipo_superficie} onValueChange={(v) => setNovaQ({ ...novaQ, tipo_superficie: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="society">Society</SelectItem>
                      <SelectItem value="futsal">Futsal</SelectItem>
                      <SelectItem value="campo">Campo</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Capacidade" value={novaQ.capacidade_total} onChange={(e) => setNovaQ({ ...novaQ, capacidade_total: +e.target.value })} />
                  <div className="flex gap-2">
                    <Button type="button" onClick={cadastrarQuadra} size="sm">Salvar quadra</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNovaQuadra(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div>
              <Label>Início</Label>
              <Input type="time" required value={form.horario_inicio} onChange={(e) => {
                const novoInicio = e.target.value;
                setForm({ ...form, horario_inicio: novoInicio, horario_fim: calcularHorarioFim(novoInicio, form.tempo_locado_minutos) });
              }} />
            </div>
            <div>
              <Label>Tempo locado da quadra</Label>
              <Select
                value={form.tempo_locado_custom ? "custom" : String(form.tempo_locado_minutos)}
                onValueChange={(v) => {
                  if (v === "custom") { setForm({ ...form, tempo_locado_custom: true }); return; }
                  const minutos = +v;
                  setForm({ ...form, tempo_locado_custom: false, tempo_locado_minutos: minutos, horario_fim: calcularHorarioFim(form.horario_inicio, minutos) });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60min (1h)</SelectItem>
                  <SelectItem value="90">90min (1h30)</SelectItem>
                  <SelectItem value="120">120min (2h)</SelectItem>
                  <SelectItem value="150">150min (2h30)</SelectItem>
                  <SelectItem value="180">180min (3h)</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {form.tempo_locado_custom && (
                <Input
                  className="mt-2" type="number" min={10} value={form.tempo_locado_minutos}
                  onChange={(e) => {
                    const v = e.target.value;
                    const minutos = v === "" ? 0 : +v;
                    setForm({ ...form, tempo_locado_minutos: minutos, horario_fim: calcularHorarioFim(form.horario_inicio, minutos) });
                  }}
                  onBlur={(e) => {
                    const minutos = Math.max(10, +e.target.value || 10);
                    setForm({ ...form, tempo_locado_minutos: minutos, horario_fim: calcularHorarioFim(form.horario_inicio, minutos) });
                  }}
                  placeholder="minutos"
                />
              )}
            </div>
            <div>
              <Label>Fim <span className="text-muted-foreground font-normal">(calculado — pode ajustar)</span></Label>
              <Input type="time" required value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
            <Label>Essa pelada é recorrente (se repete toda semana)?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, recorrente: false })}
                className={`rounded-xl border p-2 text-sm font-bold ${!form.recorrente ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
              >
                Não, é única
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, recorrente: true })}
                className={`rounded-xl border p-2 text-sm font-bold ${form.recorrente ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
              >
                Sim, toda semana
              </button>
            </div>
            {form.recorrente && (
              <div className="space-y-2 pt-2">
                <div>
                  <Label>Dia da semana</Label>
                  <Select value={String(form.dia_semana)} onValueChange={(v) => setForm({ ...form, dia_semana: +v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((nome, i) => (
                        <SelectItem key={i} value={String(i)}>{nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Abrir a lista de confirmação com quantos dias de antecedência?</Label>
                  <Select value={String(form.antecedencia_dias_lista)} onValueChange={(v) => setForm({ ...form, antecedencia_dias_lista: +v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia antes</SelectItem>
                      <SelectItem value="2">2 dias antes</SelectItem>
                      <SelectItem value="3">3 dias antes</SelectItem>
                      <SelectItem value="4">4 dias antes</SelectItem>
                      <SelectItem value="5">5 dias antes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Que horas a lista abre nesse dia?</Label>
                  <Input type="time" value={form.horario_abertura_lista} onChange={(e) => setForm({ ...form, horario_abertura_lista: e.target.value })} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Toda semana, uma nova pelada com essa mesma configuração é criada automaticamente, com a lista já aberta pros jogadores confirmarem.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 2 — Configuração da pelada */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº de times</Label>
              <Select value={String(form.numero_times)} onValueChange={(v) => setForm({ ...form, numero_times: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jogadores de linha/time</Label>
              <Input
                type="number" min={1} value={form.jogadores_linha_por_time}
                onChange={(e) => { const v = e.target.value; setForm({ ...form, jogadores_linha_por_time: v === "" ? 0 : +v }); }}
                onBlur={(e) => setForm({ ...form, jogadores_linha_por_time: Math.max(1, +e.target.value || 1) })}
              />
            </div>
            <div>
              <Label>Goleiros/time</Label>
              <Input
                type="number" min={0} value={form.goleiros_por_time}
                onChange={(e) => { const v = e.target.value; setForm({ ...form, goleiros_por_time: v === "" ? 0 : +v }); }}
                onBlur={(e) => setForm({ ...form, goleiros_por_time: Math.max(0, +e.target.value || 0) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Total por time: {totalPorTime}</p>
            </div>
            <div>
              <Label>Sistema</Label>
              <Select value={form.sistema_disputa} onValueChange={(v) => setForm({ ...form, sistema_disputa: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rodizio">Rodízio</SelectItem>
                  <SelectItem value="mata_mata">Mata-mata</SelectItem>
                  <SelectItem value="pontos_corridos">Pontos corridos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Modalidade dos goleiros</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, modalidade_goleiro: "fixo" })}
                className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "fixo" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
              >
                <div className="font-bold">🔒 Goleiros Fixos</div>
                <div className="text-xs text-muted-foreground">Goleiros ficam nas traves toda a pelada e não entram no sorteio.</div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, modalidade_goleiro: "sorteado" })}
                className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "sorteado" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
              >
                <div className="font-bold">🔀 Goleiros Sorteados</div>
                <div className="text-xs text-muted-foreground">Goleiros entram no sorteio junto com os jogadores de linha.</div>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            {form.numero_times} times de {form.jogadores_linha_por_time} na linha + {form.goleiros_por_time} goleiro(s) — {totalPorTime * form.numero_times} jogadores no total
          </div>
        </div>
      )}

      {/* ETAPA 3 — Regras da partida */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <Label>Duração de cada partida (min)</Label>
            <Input
              type="number" min={1} value={form.duracao_partida_minutos}
              onChange={(e) => { const v = e.target.value; setForm({ ...form, duracao_partida_minutos: v === "" ? 0 : +v }); }}
              onBlur={(e) => setForm({ ...form, duracao_partida_minutos: Math.max(1, +e.target.value || 1) })}
            />
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer" htmlFor="gols-toggle">Encerrar quando um time marcar X gols</Label>
              <Switch id="gols-toggle" checked={form.gols_para_encerrar_ativo} onCheckedChange={(v) => setForm({ ...form, gols_para_encerrar_ativo: v })} />
            </div>
            {form.gols_para_encerrar_ativo && (
              <Input type="number" min={1} value={form.gols_para_encerrar} onChange={(e) => setForm({ ...form, gols_para_encerrar: +e.target.value })} />
            )}
            <p className="text-xs text-muted-foreground">A partida encerra automaticamente por tempo OU por gols, o que acontecer primeiro.</p>
          </div>

          {form.numero_times === 3 && form.sistema_disputa === "rodizio" && (
            <div>
              <Label>Regra de empate (a partir da 2ª partida)</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Na 1ª partida, um empate é sempre decidido por sorteio. Da 2ª em diante, você escolhe se o time que tá ganhando fica ou sai:
              </p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_fica" })}
                  className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_fica" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
                >
                  <div className="font-bold">🛡️ Time que está ganhando FICA</div>
                  <div className="text-xs text-muted-foreground">O time que ganhou a rodada anterior continua jogando. O adversário atual sai, e quem estava de fora entra.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_sai" })}
                  className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_sai" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}
                >
                  <div className="font-bold">🚪 Time que está ganhando SAI</div>
                  <div className="text-xs text-muted-foreground">O time que ganhou a rodada anterior sai. Quem estava jogando contra ele continua, e quem estava de fora entra.</div>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            {form.numero_times} times de {form.jogadores_linha_por_time} na linha + {form.goleiros_por_time} goleiro(s) | Partidas de {form.duracao_partida_minutos}min{form.gols_para_encerrar_ativo ? ` ou ${form.gols_para_encerrar} gols` : ""} | Aluguel de {form.tempo_locado_minutos}min
          </div>
        </div>
      )}

      <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
        {step > 1 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>Voltar</Button>
        ) : <span />}
        {step < 3 ? (
          <Button type="button" onClick={() => irPara((step + 1) as 2 | 3)} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            Continuar
          </Button>
        ) : (
          <Button type="button" onClick={() => void criarPelada()} disabled={loading} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            {loading ? "Criando..." : "Criar Pelada"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
