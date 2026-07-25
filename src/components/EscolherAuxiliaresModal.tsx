import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shuffle, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Jogador = { user_id: string; nome: string; foto_url: string | null; ehAuxiliarDoGrupo: boolean };

export function EscolherAuxiliaresModal({
  open, onOpenChange, peladaId, grupoId, confirmadosIds, numeroTimes, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peladaId: string;
  grupoId: string;
  confirmadosIds: string[];
  numeroTimes: number;
  onDone?: () => void;
}) {
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      const [{ data: profs }, { data: gm }] = await Promise.all([
        confirmadosIds.length ? supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", confirmadosIds) : Promise.resolve({ data: [] as any[] }),
        supabase.from("grupo_membros").select("user_id, papel").eq("grupo_id", grupoId).eq("status", "ativo"),
      ]);
      const auxSet = new Set(((gm as any[]) || []).filter((m) => m.papel === "auxiliar").map((m) => m.user_id));
      const lista = ((profs as any[]) || []).map((p) => ({ user_id: p.user_id, nome: p.nome, foto_url: p.foto_url, ehAuxiliarDoGrupo: auxSet.has(p.user_id) }));
      lista.sort((a, b) => (b.ehAuxiliarDoGrupo ? 1 : 0) - (a.ehAuxiliarDoGrupo ? 1 : 0));
      setJogadores(lista);
      setLoading(false);
    })();
  }, [open, grupoId, confirmadosIds.join(",")]);

  const toggle = (uid: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(uid)) novo.delete(uid); else novo.add(uid);
      return novo;
    });
  };

  const sortear = () => {
    const pool = jogadores.filter((j) => j.ehAuxiliarDoGrupo);
    const base = pool.length >= numeroTimes ? pool : jogadores;
    const embaralhado = [...base].sort(() => Math.random() - 0.5);
    setSelecionados(new Set(embaralhado.slice(0, numeroTimes).map((j) => j.user_id)));
    toast.success(`Sorteado${numeroTimes > 1 ? "s" : ""} ${numeroTimes} auxiliar${numeroTimes > 1 ? "es" : ""}!`);
  };

  const confirmar = async () => {
    if (selecionados.size === 0) return toast.error("Escolha pelo menos um jogador.");
    setEnviando(true);
    const { error } = await (supabase as any).rpc("convidar_auxiliares_pelada", {
      _pelada_id: peladaId, _user_ids: Array.from(selecionados),
    });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Convite enviado! Assim que aceitarem, o Painel de Lances libera pra eles.");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Escolher Auxiliares</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Auxiliares marcam os lances (gol, passe, defesa...) durante a pelada. Recomendado: {numeroTimes} auxiliar{numeroTimes > 1 ? "es" : ""} (um por time). Quem tiver a marcação ⭐ já é auxiliar fixo do grupo.
        </p>

        <Button variant="outline" onClick={sortear} className="w-full">
          <Shuffle className="mr-2 h-4 w-4" /> Sortear {numeroTimes} automaticamente
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {jogadores.map((j) => {
              const sel = selecionados.has(j.user_id);
              return (
                <button
                  key={j.user_id}
                  onClick={() => toggle(j.user_id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${sel ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {j.foto_url ? <AvatarImage src={j.foto_url} /> : null}
                    <AvatarFallback className="bg-secondary text-xs">{j.nome[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-bold">{j.nome} {j.ehAuxiliarDoGrupo && "⭐"}</span>
                  {sel && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        <Button onClick={confirmar} disabled={enviando || selecionados.size === 0} className="w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90">
          {enviando ? "Enviando..." : `Convidar ${selecionados.size || ""} selecionado(s)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
