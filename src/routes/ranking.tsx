import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/ranking")({
  component: RankingPublico,
  head: () => ({
    meta: [
      { title: "Ranking Global — Futzone" },
      { name: "description", content: "Top jogadores de pelada no Brasil." },
    ],
  }),
});

function RankingPublico() {
  const [todos, setTodos] = useState<any[]>([]);
  const [selosMap, setSelosMap] = useState<Record<string, any>>({});
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const load = async () => {
    const { data } = await supabase.from("profiles")
      .select("user_id, nome, pontos_total, cidade, estado, foto_url")
      .order("pontos_total", { ascending: false }).limit(100);
    setTodos(data || []);
    const uids = (data || []).map((x: any) => x.user_id);
    if (uids.length) {
      const { data: us } = await supabase.from("usuario_selos").select("user_id, selos!inner(icone_emoji, nome, categoria, condicao_valor)").in("user_id", uids);
      const m: Record<string, any> = {};
      (us || []).forEach((x: any) => {
        if (x.selos.categoria === "progressao") {
          if (!m[x.user_id] || m[x.user_id].condicao_valor < x.selos.condicao_valor) m[x.user_id] = x.selos;
        }
      });
      setSelosMap(m);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("ranking-global")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtrados = useMemo(() => todos.filter((p) =>
    (!cidade || (p.cidade || "").toLowerCase().includes(cidade.toLowerCase())) &&
    (!estado || (p.estado || "").toLowerCase().includes(estado.toLowerCase()))
  ), [todos, cidade, estado]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" /> Ranking Global
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <h1 className="text-2xl font-extrabold">Top 100 Peladeiros do Brasil</h1>
        <div className="grid grid-cols-2 gap-2">
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className="rounded-lg border border-border bg-card p-2 text-sm" />
          <input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Estado (UF)" className="rounded-lg border border-border bg-card p-2 text-sm" />
        </div>
        <div className="space-y-2">
          {filtrados.map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <span className={`w-8 text-center text-lg font-extrabold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{p.nome}</div>
                <div className="text-[10px] text-muted-foreground">
                  {selosMap[p.user_id] && <span>{selosMap[p.user_id].icone_emoji} {selosMap[p.user_id].nome} · </span>}
                  {p.cidade || "—"}{p.estado ? `/${p.estado}` : ""}
                </div>
              </div>
              <span className="text-base font-bold text-primary">{p.pontos_total} <span className="text-[10px] font-normal text-muted-foreground">pts</span></span>
            </div>
          ))}
          {filtrados.length === 0 && <p className="text-center text-sm text-muted-foreground">Sem jogadores nesse filtro.</p>}
        </div>
      </main>
    </div>
  );
}
