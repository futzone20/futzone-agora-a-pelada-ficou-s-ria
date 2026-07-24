import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";

// Cache simples em nível de módulo — todas as instâncias de <Logo/> na página compartilham
// a mesma checagem, em vez de cada uma consultar o banco por conta própria.
let cachedLogoUrl: string | null | undefined;
let pending: Promise<string | null> | null = null;

async function resolveLogoUrl(): Promise<string | null> {
  if (cachedLogoUrl !== undefined) return cachedLogoUrl;
  if (pending) return pending;
  pending = (async () => {
    const { data } = await (supabase as any).from("configuracoes_marca").select("atualizado_em").eq("chave", "logo").maybeSingle();
    if (!data || !SUPABASE_URL) { cachedLogoUrl = null; return null; }
    const v = new Date((data as any).atualizado_em).getTime();
    cachedLogoUrl = `${SUPABASE_URL}/storage/v1/object/public/branding/logo?v=${v}`;
    return cachedLogoUrl;
  })();
  return pending;
}

export function Logo({ className = "" }: { className?: string }) {
  const [url, setUrl] = useState<string | null>(cachedLogoUrl ?? null);

  useEffect(() => {
    let vivo = true;
    void resolveLogoUrl().then((u) => { if (vivo) setUrl(u); });
    return () => { vivo = false; };
  }, []);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="MrFut" className={className} style={{ height: "1.4em", width: "auto", objectFit: "contain", display: "inline-block" }} />;
  }

  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <Circle className="h-5 w-5 text-primary" strokeWidth={2.5} />
      <span>
        MR<span className="text-primary">FUT</span>
      </span>
    </span>
  );
}
