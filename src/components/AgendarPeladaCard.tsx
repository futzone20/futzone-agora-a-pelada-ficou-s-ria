import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CriarPeladaWizard } from "@/components/CriarPeladaWizard";

type GrupoOpcao = { id: string; nome: string };

// Card de atalho pra tela inicial: em vez de precisar ir em Grupos > escolher
// o grupo > Criar Pelada, o capitão clica aqui, escolhe o grupo (se tiver mais
// de um) e já cai direto no assistente de criação.
export function AgendarPeladaCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<GrupoOpcao[] | null>(null);
  const [grupoEscolhido, setGrupoEscolhido] = useState<GrupoOpcao | null>(null);

  const abrir = async () => {
    setAberto(true);
    setGrupoEscolhido(null);
    if (!user) return;
    setCarregando(true);
    const { data: gm } = await (supabase as any)
      .from("grupo_membros")
      .select("grupo_id, papel, grupos:grupo_id(id, nome)")
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .in("papel", ["capitao", "auxiliar"]);
    const lista: GrupoOpcao[] = ((gm as any[]) || [])
      .filter((m) => m.grupos)
      .map((m) => ({ id: m.grupos.id as string, nome: m.grupos.nome as string }));
    setGrupos(lista);
    setCarregando(false);
    // se só tem um grupo onde a pessoa pode criar pelada, pula a escolha
    if (lista.length === 1) setGrupoEscolhido(lista[0]);
  };

  const fechar = () => { setAberto(false); setGrupos(null); setGrupoEscolhido(null); };

  return (
    <>
      <button
        onClick={abrir}
        className="col-span-2 w-full rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left transition active:scale-[0.98]"
      >
        <CalendarPlus className="h-6 w-6 text-primary" />
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-lg font-black leading-tight">Agendar Pelada</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Escolha o grupo e monte a pelada em 3 passos</div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </button>

      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
          {!grupoEscolhido ? (
            <>
              <DialogHeader><DialogTitle>Pra qual grupo é a pelada?</DialogTitle></DialogHeader>
              {carregando ? (
                <p className="text-sm text-muted-foreground">Carregando seus grupos...</p>
              ) : !grupos || grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Você precisa ser capitão ou auxiliar de um grupo pra criar uma pelada. Crie ou peça pra entrar num grupo primeiro.
                </p>
              ) : (
                <div className="space-y-2">
                  {grupos.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGrupoEscolhido(g)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 p-3 text-left font-bold transition hover:border-primary/50"
                    >
                      {g.nome}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>Nova pelada — {grupoEscolhido.nome}</DialogTitle></DialogHeader>
              <CriarPeladaWizard
                grupoId={grupoEscolhido.id}
                onCreated={(peladaId) => {
                  fechar();
                  if (peladaId) navigate({ to: "/peladas/$id", params: { id: peladaId } });
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
