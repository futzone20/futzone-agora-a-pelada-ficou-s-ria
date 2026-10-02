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
import { Plus, Trash2, ExternalLink, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/anunciantes")({ component: AnunciantesPage });

const VAZIO = { id: "", nome: "", imagem_url: "", link_url: "", ativo: true, quadraIds: [] as string[] };

function AnunciantesPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(VAZIO);
  const [salvando, setSalvando] = useState(false);

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
      id: an.id, nome: an.nome, imagem_url: an.imagem_url, link_url: an.link_url || "",
      ativo: an.ativo, quadraIds: (an.tv_anunciante_quadras ?? []).map((v: any) => v.quadra_id),
    });
    setOpen(true);
  };

  const toggleQuadra = (id: string) => {
    setForm((f: any) => ({
      ...f,
      quadraIds: f.quadraIds.includes(id) ? f.quadraIds.filter((x: string) => x !== id) : [...f.quadraIds, id],
    }));
  };

  const salvar = async () => {
    if (!arena || !form.nome.trim() || !form.imagem_url) { toast.error("Preencha o nome e envie uma imagem"); return; }
    if (form.quadraIds.length === 0) { toast.error("Escolha pelo menos uma quadra"); return; }
    setSalvando(true);
    const editando = anuncios.some((a) => a.id === form.id);
    const { error } = await supabase.from("tv_anunciantes").upsert({
      id: form.id, arena_id: arena.id, nome: form.nome.trim(),
      imagem_url: form.imagem_url, link_url: form.link_url.trim() || null, ativo: form.ativo,
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
            <div className="space-y-3">
              <div><Label>Nome do anunciante</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lanchonete do Zé" /></div>
              <ImageUploadCropper
                label="Banner"
                value={form.imagem_url}
                onChange={(url) => setForm({ ...form, imagem_url: url })}
                arenaId={arena.id}
                fileSlot={`anuncio-${form.id}`}
                aspect={4}
                dimensionsHint="Recomendado: faixa larga, tipo 1200x300px"
              />
              <div><Label>Link ao clicar (opcional)</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://wa.me/55..." /></div>
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
              <div className="text-xs text-muted-foreground truncate">
                {(an.tv_anunciante_quadras ?? []).length} quadra(s)
                {an.link_url && <> · <ExternalLink className="h-3 w-3 inline" /> com link</>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Switch checked={an.ativo} onCheckedChange={() => toggleAtivo(an)} />
              <Button size="sm" variant="ghost" onClick={() => abrirEditar(an)}>Editar</Button>
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full mt-2 text-rose-500" onClick={() => remover(an.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Remover
          </Button>
        </Card>
      ))}
      {anuncios.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum anunciante cadastrado ainda.</p>}
    </div>
  );
}
