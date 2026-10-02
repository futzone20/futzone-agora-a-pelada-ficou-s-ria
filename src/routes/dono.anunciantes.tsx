import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImageUploadCropper } from "@/components/ImageUploadCropper";
import { Plus, Trash2, Megaphone, BarChart3, Repeat, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/anunciantes")({ component: AnunciantesPage });

const DIAS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

const VAZIO = {
  id: "", nome: "", imagem_url: "", ativo: true, quadraIds: [] as string[],
  modo_exibicao: "compartilhado" as "compartilhado" | "exclusivo",
  duracao_segundos: 10,
  dias_semana: [0, 1, 2, 3, 4, 5, 6] as number[],
  tipo_duracao: "periodo" as "periodo" | "insercoes",
  data_inicio: "", data_fim: "",
  limite_insercoes: "" as string | number,
};

function AnunciantesPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [relatorio, setRelatorio] = useState<{ nome: string; dias: { dia: string; total: number }[]; total: number } | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    const { data: q } = await supabase.from("quadras").select("id,nome").eq("arena_id", a.id).order("criado_em");
    setQuadras(q ?? []);
    const { data: an } = await supabase.from("tv_anunciantes").select("*, tv_anunciante_quadras(quadra_id)").eq("arena_id", a.id).order("criado_em", { ascending: false });
    setAnuncios(an ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const abrirNovo = () => { setForm({ ...VAZIO, id: crypto.randomUUID() }); setOpen(true); };
  const abrirEditar = (an: any) => {
    setForm({
      id: an.id, nome: an.nome, imagem_url: an.imagem_url, ativo: an.ativo,
      quadraIds: (an.tv_anunciante_quadras ?? []).map((v: any) => v.quadra_id),
      modo_exibicao: an.modo_exibicao, duracao_segundos: an.duracao_segundos,
      dias_semana: an.dias_semana ?? [0, 1, 2, 3, 4, 5, 6],
      tipo_duracao: an.tipo_duracao, data_inicio: an.data_inicio || "", data_fim: an.data_fim || "",
      limite_insercoes: an.limite_insercoes ?? "",
    });
    setOpen(true);
  };

  const toggleQuadra = (id: string) => {
    setForm((f: any) => ({ ...f, quadraIds: f.quadraIds.includes(id) ? f.quadraIds.filter((x: string) => x !== id) : [...f.quadraIds, id] }));
  };
  const toggleDia = (v: number) => {
    setForm((f: any) => ({ ...f, dias_semana: f.dias_semana.includes(v) ? f.dias_semana.filter((x: number) => x !== v) : [...f.dias_semana, v].sort() }));
  };

  const salvar = async () => {
    if (!arena || !form.nome.trim() || !form.imagem_url) { toast.error("Preencha o nome e envie uma imagem"); return; }
    if (form.quadraIds.length === 0) { toast.error("Escolha pelo menos uma quadra"); return; }
    if (form.dias_semana.length === 0) { toast.error("Escolha pelo menos um dia da semana"); return; }
    if (form.tipo_duracao === "insercoes" && !form.limite_insercoes) { toast.error("Informe o número de inserções"); return; }
    setSalvando(true);
    const editando = anuncios.some((a) => a.id === form.id);
    const { error } = await supabase.from("tv_anunciantes").upsert({
      id: form.id, arena_id: arena.id, nome: form.nome.trim(), imagem_url: form.imagem_url, ativo: form.ativo,
      modo_exibicao: form.modo_exibicao, duracao_segundos: Number(form.duracao_segundos) || 10,
      dias_semana: form.dias_semana, tipo_duracao: form.tipo_duracao,
      data_inicio: form.tipo_duracao === "periodo" ? (form.data_inicio || null) : null,
      data_fim: form.tipo_duracao === "periodo" ? (form.data_fim || null) : null,
      limite_insercoes: form.tipo_duracao === "insercoes" ? Number(form.limite_insercoes) : null,
    } as never);
    if (error) { toast.error(error.message); setSalvando(false); return; }
    // Mais simples recriar os vínculos do zero do que calcular diff.
    await supabase.from("tv_anunciante_quadras").delete().eq("tv_anunciante_id", form.id);
    const { error: eVinc } = await supabase.from("tv_anunciante_quadras").insert(
      form.quadraIds.map((quadra_id: string) => ({ tv_anunciante_id: form.id, quadra_id })) as never
    );
    setSalvando(false);
    if (eVinc) { toast.error(eVinc.message); return; }
    toast.success(editando ? "Anunciante atualizado" : "Anunciante criado");
    setOpen(false);
    void load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("tv_anunciantes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); void load(); }
  };

  const toggleAtivo = async (an: any) => {
    await supabase.from("tv_anunciantes").update({ ativo: !an.ativo } as never).eq("id", an.id);
    void load();
  };

  const verRelatorio = async (an: any) => {
    const desde = new Date(); desde.setDate(desde.getDate() - 6); desde.setHours(0, 0, 0, 0);
    const { data: exs } = await supabase.from("tv_anuncio_exibicoes").select("exibido_em").eq("tv_anunciante_id", an.id).gte("exibido_em", desde.toISOString());
    const porDia: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      porDia[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
    }
    (exs ?? []).forEach((e: any) => {
      const k = new Date(e.exibido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (k in porDia) porDia[k] += 1;
    });
    setRelatorio({
      nome: an.nome,
      dias: Object.entries(porDia).map(([dia, total]) => ({ dia, total })),
      total: an.insercoes_feitas ?? 0,
    });
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold flex items-center gap-1.5"><Megaphone className="h-4 w-4" />Anunciantes</h3>
          <p className="text-xs text-muted-foreground">Banners que aparecem no placar de TV das quadras escolhidas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{anuncios.some((a) => a.id === form.id) ? "Editar anunciante" : "Novo anunciante"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome do anunciante</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lanchonete do Zé" /></div>

              <ImageUploadCropper
                label="Banner"
                value={form.imagem_url}
                onChange={(url) => setForm({ ...form, imagem_url: url })}
                arenaId={arena.id}
                fileSlot={`anuncio-${form.id}`}
                aspect={1920 / 200}
                dimensionsHint="Tamanho padrão da faixa: 1920x200px — essa é a mesma faixa em qualquer tela da TV (lances, espera ou resultado)"
              />

              <div>
                <Label>Como aparece na TV</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, modo_exibicao: "compartilhado" })}
                    className={`rounded-lg border p-2.5 text-left text-xs ${form.modo_exibicao === "compartilhado" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <div className="flex items-center gap-1.5 font-bold"><Repeat className="h-3.5 w-3.5" />Compartilhado</div>
                    <p className="mt-0.5 text-muted-foreground">Reveza com os outros anunciantes compartilhados.</p>
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, modo_exibicao: "exclusivo" })}
                    className={`rounded-lg border p-2.5 text-left text-xs ${form.modo_exibicao === "exclusivo" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <div className="flex items-center gap-1.5 font-bold"><Lock className="h-3.5 w-3.5" />Exclusivo</div>
                    <p className="mt-0.5 text-muted-foreground">Aparece sempre, sem dividir espaço.</p>
                  </button>
                </div>
              </div>

              <div>
                <Label>Tempo em tela</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input type="number" min={1} className="w-24" value={form.duracao_segundos} onChange={(e) => setForm({ ...form, duracao_segundos: e.target.value })} />
                  <span className="text-xs text-muted-foreground">segundos (padrão: 10)</span>
                </div>
              </div>

              <div>
                <Label>Dias da semana</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DIAS.map((d) => (
                    <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${form.dias_semana.includes(d.v) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Duração da campanha</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, tipo_duracao: "periodo" })}
                    className={`rounded-lg border p-2.5 text-left text-xs font-bold ${form.tipo_duracao === "periodo" ? "border-primary bg-primary/10" : "border-border"}`}>
                    Por período
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, tipo_duracao: "insercoes" })}
                    className={`rounded-lg border p-2.5 text-left text-xs font-bold ${form.tipo_duracao === "insercoes" ? "border-primary bg-primary/10" : "border-border"}`}>
                    Por inserções
                  </button>
                </div>
                {form.tipo_duracao === "periodo" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div><Label className="text-xs text-muted-foreground">Início (opcional)</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                    <div><Label className="text-xs text-muted-foreground">Fim (opcional)</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Número de inserções contratadas</Label>
                    <Input type="number" min={1} value={form.limite_insercoes} onChange={(e) => setForm({ ...form, limite_insercoes: e.target.value })} placeholder="Ex: 500" />
                    {anuncios.some((a) => a.id === form.id) && (
                      <p className="mt-1 text-xs text-muted-foreground">Já exibido {anuncios.find((a) => a.id === form.id)?.insercoes_feitas ?? 0} vez(es). Desativa sozinho ao bater o limite.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Aparece nas quadras</Label>
                <div className="space-y-1.5 mt-1.5">
                  {quadras.map((q) => (
                    <label key={q.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.quadraIds.includes(q.id)} onCheckedChange={() => toggleQuadra(q.id)} />
                      {q.nome}
                    </label>
                  ))}
                  {quadras.length === 0 && <p className="text-xs text-muted-foreground">Cadastre uma quadra primeiro em "Quadras".</p>}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Ativo</Label>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>

              <Button onClick={salvar} disabled={salvando} className="w-full">{salvando ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {anuncios.map((an) => (
        <Card key={an.id} className="p-3">
          <div className="flex gap-3">
            <img src={an.imagem_url} alt={an.nome} className="w-24 h-14 object-cover rounded-md border border-border shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{an.nome}</div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>{(an.tv_anunciante_quadras ?? []).length} quadra(s)</span>
                <span>· {an.modo_exibicao === "exclusivo" ? "Exclusivo" : "Compartilhado"}</span>
                <span>· {an.duracao_segundos}s em tela</span>
                <span>· {an.tipo_duracao === "insercoes" ? `${an.insercoes_feitas}/${an.limite_insercoes ?? "?"} inserções` : "por período"}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Switch checked={an.ativo} onCheckedChange={() => toggleAtivo(an)} />
              <Button size="sm" variant="ghost" onClick={() => abrirEditar(an)}>Editar</Button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => verRelatorio(an)}><BarChart3 className="h-3.5 w-3.5 mr-1" />Relatório</Button>
            <Button size="sm" variant="outline" className="text-rose-500" onClick={() => remover(an.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Remover</Button>
          </div>
        </Card>
      ))}
      {anuncios.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum anunciante cadastrado ainda.</p>}

      <Dialog open={!!relatorio} onOpenChange={(v) => !v && setRelatorio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Relatório · {relatorio?.nome}</DialogTitle></DialogHeader>
          {relatorio && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-3xl font-black text-primary">{relatorio.total}</div>
                <div className="text-xs text-muted-foreground">exibições no total</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Últimos 7 dias</Label>
                <div className="mt-1.5 space-y-1">
                  {relatorio.dias.map((d) => (
                    <div key={d.dia} className="flex items-center justify-between rounded bg-secondary/40 px-2.5 py-1.5 text-sm">
                      <span>{d.dia}</span><span className="font-bold">{d.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
