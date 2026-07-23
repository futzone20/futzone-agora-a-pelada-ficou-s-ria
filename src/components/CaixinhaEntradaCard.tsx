import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PiggyBank, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function CaixinhaEntradaCard({ to }: { to: "/jogador/vaquinhas" | "/capitao/vaquinhas" }) {
  const { user } = useAuth();
  const [pendentes, setPendentes] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any).from("vaquinha_participantes").select("status").eq("user_id", user.id);
      setTotal((data || []).length);
      setPendentes((data || []).filter((p: any) => p.status === "pendente").length);
    })();
  }, [user?.id]);

  if (total === 0) return null;

  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <PiggyBank className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-bold">🏆 Caixinha do Time</div>
        {pendentes > 0
          ? <div className="text-xs text-primary font-bold">{pendentes} vaquinha(s) esperando sua resposta</div>
          : <div className="text-xs text-muted-foreground">{total} vaquinha(s) no total</div>}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
