import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Crown, Users, User, Star } from "lucide-react";

export const Route = createFileRoute("/admin/grupos")({ component: AdminGrupos });

type Nivel = "capitaes" | "grupos" | "membros" | "avaliacoes";

async function buscarPerfis(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, any>;
  const { data, error } = await (supabase as any).from("profiles").select("user_id, nome, email, handle").in("user_id", userIds);
  if (error) { toast.error(`Erro ao buscar perfis: ${error.message}`); return {}; }
  const map: Record<string, any> = {};
  (data || []).forEach((p: any) => { map[p.user_id] = p; });
  return map;
}

function AdminGrupos() {
  const [nivel, setNivel] = useState<Nivel>("capitaes");
  const [capitao, setCapitao] = useState<any>(null);
  const [grupo, setGrupo] = useState<any>(null);
  const [membro, setMembro] = useState<any>(null);

  const [capitaes, setCapitaes] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: gm, error } = await (supabase as any).from("grupo_membros").select("user_id, grupo_id").eq("papel", "capitao");
      if (error) { toast.error(`Erro ao buscar capitães: ${error.message}`); setLoading(false); return; }
      const perfis = await buscarPerfis(Array.from(new Set((gm || []).map((r: any) => r.user_id))));
      const porCapitao: Record<string, any> = {};
      (gm || []).forEach((r: any) => {
        if (!porCapitao[r.user_id]) {
          const p = perfis[r.user_id];
          porCapitao[r.user_id] = { user_id: r.user_id, nome: p?.nome || "—", email: p?.email, handle: p?.handle, totalGrupos: 0 };
        }
        porCapitao[r.user_id].totalGrupos++;
      });
      setCapitaes(Object.values(porCapitao).sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || "")));
      setLoading(false);
    })();
  }, []);

  const abrirCapitao = async (cap: any) => {
    setCapitao(cap); setLoading(true);
    const { data: gm, error } = await (supabase as any).from("grupo_membros").select("grupo_id").eq("papel", "capitao").eq("user_id", cap.user_id);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const grupoIds = (gm || []).map((r: any) => r.grupo_id);
    const { data: gs } = await supabase.from("grupos").select("id, nome").in("id", grupoIds.length ? grupoIds : ["00000000-0000-0000-0000-000000000000"]);
    setGrupos(gs || []);
    setLoading(false); setNivel("grupos");
  };

  const abrirGrupo = async (g: any) => {
    setGrupo(g); setLoading(true);
    const { data: gm, error } = await (supabase as any).from("grupo_membros").select("user_id, papel").eq("grupo_id", g.id);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const userIds = (gm || []).map((r: any) => r.user_id);
    const perfis = await buscarPerfis(userIds);
    const { data: sk } = await (supabase as any)
      .from("skills")
      .select("user_id, total_avaliacoes_recebidas, velocidade, drible, passe, chute, resistencia, posicionamento")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const skMap: Record<string, any> = {};
    (sk || []).forEach((s: any) => { skMap[s.user_id] = s; });
    setMembros((gm || []).map((r: any) => ({ ...r, perfil: perfis[r.user_id], skill: skMap[r.user_id] })));
    setLoading(false); setNivel("membros");
  };

  const abrirMembro = async (m: any) => {
    setMembro(m); setLoading(true);
    const { data, error } = await (supabase as any)
      .from("avaliacoes_skill_membro")
      .select("id, criado_em, velocidade, drible, passe, chute, resistencia, posicionamento, avaliador_id")
      .eq("avaliado_id", m.user_id)
      .eq("tipo", "conhecimento_previo").eq("conhece_jogador", true)
      .order("criado_em", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const perfis = await buscarPerfis(Array.from(new Set((data || []).map((r: any) => r.avaliador_id))));
    setAvaliacoes((data || []).map((r: any) => ({ ...r, avaliador: perfis[r.avaliador_id] })));
    setLoading(false); setNivel("avaliacoes");
  };

  const voltar = () => {
    if (nivel === "avaliacoes") setNivel("membros");
    else if (nivel === "membros") setNivel("grupos");
    else if (nivel === "grupos") setNivel("capitaes");
  };

  const mediaLinha = (r: any) => ((r.velocidade + r.drible + r.passe + r.chute + r.resistencia + r.posicionamento) / 6);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Avaliações por grupo</h1>
        <p className="text-sm text-muted-foreground">Capitães → grupos → membros → quem avaliou e com que nota.</p>
      </div>

      {nivel !== "capitaes" && (
        <button onClick={voltar} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {nivel === "grupos" && "Voltar pra capitães"}
          {nivel === "membros" && `Voltar pros grupos de ${capitao?.nome}`}
          {nivel === "avaliacoes" && `Voltar pros membros de ${grupo?.nome}`}
        </button>
      )}

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && nivel === "capitaes" && (
        <div className="space-y-2">
          {capitaes.map((c) => (
            <Card key={c.user_id} className="flex cursor-pointer items-center justify-between p-4 hover:bg-secondary/40" onClick={() => abrirCapitao(c)}>
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-bold">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{c.email}{c.handle ? ` · @${c.handle}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {c.totalGrupos} grupo{c.totalGrupos === 1 ? "" : "s"} <ChevronRight className="h-4 w-4" />
              </div>
            </Card>
          ))}
          {capitaes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum capitão encontrado.</p>}
        </div>
      )}

      {!loading && nivel === "grupos" && (
        <div className="space-y-2">
          {grupos.map((g) => (
            <Card key={g.id} className="flex cursor-pointer items-center justify-between p-4 hover:bg-secondary/40" onClick={() => abrirGrupo(g)}>
              <div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><span className="font-bold">{g.nome}</span></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {!loading && nivel === "membros" && (
        <div className="space-y-2">
          {membros.map((m) => (
            <Card key={m.user_id} className="flex cursor-pointer items-center justify-between p-4 hover:bg-secondary/40" onClick={() => abrirMembro(m)}>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-bold">{m.perfil?.nome || "—"} {m.papel === "capitao" && <span className="text-xs text-primary">(capitão)</span>}</div>
                  <div className="text-xs text-muted-foreground">{m.perfil?.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {m.skill ? (
                  <span className="flex items-center gap-1 font-bold text-primary"><Star className="h-3.5 w-3.5 fill-primary" /> {mediaLinha(m.skill).toFixed(1)} ({m.skill.total_avaliacoes_recebidas || 0})</span>
                ) : <span className="text-xs text-muted-foreground">sem skill</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && nivel === "avaliacoes" && (
        <div className="space-y-2">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="font-bold">{membro?.perfil?.nome}</span> — {avaliacoes.length} avaliaç{avaliacoes.length === 1 ? "ão" : "ões"}
            <p className="mt-1 text-xs font-normal text-muted-foreground">O nível do jogador é único pra pessoa (não muda por grupo) — se ele estiver em mais de um grupo, avaliações de qualquer um deles aparecem aqui.</p>
          </div>
          {avaliacoes.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{a.avaliador?.nome || "Usuário"}</div>
                  <div className="text-xs text-muted-foreground">{a.avaliador?.email} · {new Date(a.criado_em).toLocaleDateString("pt-BR")}</div>
                </div>
                <span className="flex items-center gap-1 text-lg font-black text-primary"><Star className="h-4 w-4 fill-primary" /> {mediaLinha(a).toFixed(1)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>⚡ Vel: <b className="text-foreground">{a.velocidade}</b></span>
                <span>🎯 Drible: <b className="text-foreground">{a.drible}</b></span>
                <span>🤝 Passe: <b className="text-foreground">{a.passe}</b></span>
                <span>👟 Chute: <b className="text-foreground">{a.chute}</b></span>
                <span>🛡️ Marcação: <b className="text-foreground">{a.resistencia}</b></span>
                <span>📍 Posição: <b className="text-foreground">{a.posicionamento}</b></span>
              </div>
            </Card>
          ))}
          {avaliacoes.length === 0 && <p className="text-sm text-muted-foreground">Ninguém avaliou esse jogador ainda.</p>}
        </div>
      )}
    </div>
  );
}
