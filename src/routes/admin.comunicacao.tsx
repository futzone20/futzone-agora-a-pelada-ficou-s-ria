import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/comunicacao")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [publico, setPublico] = useState("todos");
  const [filtro, setFiltro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [link, setLink] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);

  const loadHist = async () => { const { data } = await supabase.from("admin_comunicacoes").select("*").order("criado_em", { ascending: false }).limit(50); setHist(data ?? []); };
  useEffect(() => { void loadHist(); }, []);

  const buildQuery = () => {
    let qb = supabase.from("profiles").select("user_id", { count: "exact" });
    if (publico === "jogadores") qb = qb.eq("role","jogador");
    else if (publico === "capitaes") qb = qb.eq("role","capitao");
    else if (publico === "donos_quadra") qb = qb.eq("role","dono_quadra");
    else if (publico === "parceiros") qb = qb.eq("role","parceiro");
    else if (publico === "cidade" && filtro) qb = qb.eq("cidade", filtro);
    else if (publico === "estado" && filtro) qb = qb.eq("estado", filtro);
    return qb;
  };

  const contar = async () => { const { count: c } = await buildQuery().limit(1); setCount(c ?? 0); };
  useEffect(() => { void contar(); }, [publico, filtro]);

  const enviar = async () => {
    if (!user || !titulo || !mensagem) return;
    // limite 1/hora
    const oneHour = new Date(Date.now() - 3600*1000).toISOString();
    const { count: recent } = await supabase.from("admin_comunicacoes").select("*", { count: "exact", head: true }).eq("enviado_por", user.id).gte("criado_em", oneHour);
    if ((recent ?? 0) >= 1) { toast.error("Limite: 1 envio por hora"); return; }

    setEnviando(true);
    const { data: ids } = await buildQuery();
    const users = (ids ?? []) as any[];
    const chunks: any[][] = [];
    const rows = users.map(u => ({ user_id: u.user_id, titulo, mensagem, link: link || null }));
    for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i+500));
    for (const c of chunks) await supabase.from("notificacoes").insert(c as never);
    await supabase.from("admin_comunicacoes").insert({ enviado_por: user.id, publico: publico + (filtro?":"+filtro:""), titulo, mensagem, link, quantidade_enviada: rows.length } as never);
    toast.success(`Enviado para ${rows.length} usuários`);
    setTitulo(""); setMensagem(""); setLink(""); setEnviando(false); void loadHist();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Comunicação em massa</h2>
      <Card className="p-3 space-y-2">
        <div><Label>Público</Label><Select value={publico} onValueChange={setPublico}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
          {["todos","jogadores","capitaes","donos_quadra","parceiros","cidade","estado"].map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent></Select></div>
        {(publico==="cidade"||publico==="estado") && <Input placeholder={publico} value={filtro} onChange={e=>setFiltro(e.target.value)}/>}
        <div><Label>Título (max 80)</Label><Input maxLength={80} value={titulo} onChange={e=>setTitulo(e.target.value)}/></div>
        <div><Label>Mensagem (max 300)</Label><Textarea maxLength={300} value={mensagem} onChange={e=>setMensagem(e.target.value)}/></div>
        <div><Label>Link (opcional)</Label><Input value={link} onChange={e=>setLink(e.target.value)}/></div>
        <Card className="p-2 bg-accent/30"><div className="text-xs text-muted-foreground">Preview:</div><div className="font-bold text-sm">{titulo || "Título"}</div><div className="text-xs">{mensagem || "Mensagem"}</div></Card>
        <Button onClick={enviar} disabled={!titulo || !mensagem || enviando} className="w-full">Enviar para {count ?? 0} usuários</Button>
      </Card>
      <h3 className="font-bold">Histórico</h3>
      {hist.map(h=>(
        <Card key={h.id} className="p-3"><div className="font-bold text-sm">{h.titulo}</div><div className="text-xs text-muted-foreground">{new Date(h.criado_em).toLocaleString("pt-BR")} · {h.publico} · {h.quantidade_enviada} enviadas</div></Card>
      ))}
    </div>
  );
}
