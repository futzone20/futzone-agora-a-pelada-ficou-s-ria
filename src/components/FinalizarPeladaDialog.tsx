import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Uma reserva feita pelo dono da quadra e vinculada a um capitão/grupo já
// "cria a pelada" na data/horário marcados, mas sem a configuração de jogo
// (times, goleiros, sistema de disputa etc.) — isso fica marcado com
// configuracao_pendente = true. Este diálogo reaproveita exatamente os
// campos das etapas 2 e 3 do CriarPeladaWizard pra o capitão terminar de
// configurar, sem repetir local/data/horário (isso já veio da reserva).
type PeladaPendente = {
  id: string;
  nome_pelada: string;
  data: string;
  horario_inicio: string;
};

export function FinalizarPeladaDialog({ pelada, onClose, onFinished }: { pelada: PeladaPendente; onClose: () => void; onFinished: () => void }) {
  const [form, setForm] = useState({
    numero_times: 2,
    jogadores_linha_por_time: 4,
    goleiros_por_time: 1,
    modalidade_goleiro: "fixo" as "fixo" | "sorteado",
    sistema_disputa: "rodizio" as "rodizio" | "mata_mata" | "pontos_corridos",
    regra_empate_rodizio: "time_atual_sai" as "time_atual_sai" | "time_atual_fica",
    duracao_partida_minutos: 10,
    gols_para_encerrar_ativo: false,
    gols_para_encerrar: 2,
  });
  const [salvando, setSalvando] = useState(false);

  const totalPorTime = form.jogadores_linha_por_time + form.goleiros_por_time;

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.from("peladas").update({
      numero_times: form.numero_times,
      jogadores_linha_por_time: form.jogadores_linha_por_time,
      jogadores_por_time: form.jogadores_linha_por_time,
      goleiros_por_time: form.goleiros_por_time,
      modalidade_goleiro: form.modalidade_goleiro,
      sistema_disputa: form.sistema_disputa,
      regra_empate_rodizio: form.regra_empate_rodizio,
      duracao_partida_minutos: form.duracao_partida_minutos,
      gols_para_encerrar: form.gols_para_encerrar_ativo ? form.gols_para_encerrar : null,
      configuracao_pendente: false,
    } as never).eq("id", pelada.id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pelada configurada!");
    onFinished();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
      <DialogHeader>
        <DialogTitle>Configurar pelada</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
          <b className="text-foreground">{pelada.nome_pelada}</b> — {pelada.data.split("-").reverse().join("/")} às {pelada.horario_inicio.slice(0, 5)}
          <br />Local e horário já foram reservados pela arena. Falta só configurar o jogo:
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nº de times</Label>
            <Select value={String(form.numero_times)} onValueChange={(v) => setForm({ ...form, numero_times: +v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
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
            <button type="button" onClick={() => setForm({ ...form, modalidade_goleiro: "fixo" })}
              className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "fixo" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
              <div className="font-bold">🔒 Goleiros Fixos</div>
              <div className="text-xs text-muted-foreground">Ficam nas traves e não entram no sorteio.</div>
            </button>
            <button type="button" onClick={() => setForm({ ...form, modalidade_goleiro: "sorteado" })}
              className={`rounded-xl border p-3 text-left text-sm ${form.modalidade_goleiro === "sorteado" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
              <div className="font-bold">🔀 Goleiros Sorteados</div>
              <div className="text-xs text-muted-foreground">Entram no sorteio com os de linha.</div>
            </button>
          </div>
        </div>

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
            <Label className="cursor-pointer" htmlFor="gols-toggle-fin">Encerrar quando um time marcar X gols</Label>
            <Switch id="gols-toggle-fin" checked={form.gols_para_encerrar_ativo} onCheckedChange={(v) => setForm({ ...form, gols_para_encerrar_ativo: v })} />
          </div>
          {form.gols_para_encerrar_ativo && (
            <Input type="number" min={1} value={form.gols_para_encerrar} onChange={(e) => setForm({ ...form, gols_para_encerrar: +e.target.value })} />
          )}
        </div>

        {form.numero_times === 3 && form.sistema_disputa === "rodizio" && (
          <div>
            <Label>Regra de empate (a partir da 2ª partida)</Label>
            <div className="grid gap-2 mt-2">
              <button type="button" onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_fica" })}
                className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_fica" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                <div className="font-bold">🛡️ Time que está ganhando FICA</div>
              </button>
              <button type="button" onClick={() => setForm({ ...form, regra_empate_rodizio: "time_atual_sai" })}
                className={`rounded-xl border p-3 text-left text-sm ${form.regra_empate_rodizio === "time_atual_sai" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                <div className="font-bold">🚪 Time que está ganhando SAI</div>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
          {form.numero_times} times de {form.jogadores_linha_por_time} na linha + {form.goleiros_por_time} goleiro(s) | Partidas de {form.duracao_partida_minutos}min{form.gols_para_encerrar_ativo ? ` ou ${form.gols_para_encerrar} gols` : ""}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={salvar} disabled={salvando} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          {salvando ? "Salvando..." : "Salvar e confirmar pelada"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
