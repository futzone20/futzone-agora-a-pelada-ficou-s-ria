import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/aparencia")({ component: Page });

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";

type Asset = {
  chave: "logo" | "favicon" | "pwa-icon";
  titulo: string;
  descricao: string;
  dica: string;
};

const ASSETS: Asset[] = [
  {
    chave: "logo",
    titulo: "Logo do sistema",
    descricao: "Aparece no topo do app, na tela de login e nas telas de cadastro.",
    dica: "Recomendado: PNG com fundo transparente, altura maior que largura (ex: 512x128px).",
  },
  {
    chave: "favicon",
    titulo: "Favicon",
    descricao: "O iconezinho que aparece na aba do navegador.",
    dica: "Recomendado: PNG ou ICO quadrado, 32x32px ou 64x64px.",
  },
  {
    chave: "pwa-icon",
    titulo: "Ícone do app (PWA)",
    descricao: "O ícone que aparece quando alguém instala o MrFut na tela inicial do celular.",
    dica: "Recomendado: PNG quadrado, pelo menos 512x512px, sem cantos arredondados (o sistema arredonda sozinho).",
  },
];

function publicUrl(chave: string, v: number | null) {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${chave}${v ? `?v=${v}` : ""}`;
}

function Page() {
  const [versoes, setVersoes] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("configuracoes_marca").select("chave, atualizado_em");
    const v: Record<string, number | null> = {};
    ASSETS.forEach((a) => { v[a.chave] = null; });
    (data || []).forEach((row: any) => { v[row.chave] = new Date(row.atualizado_em).getTime(); });
    setVersoes(v);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const enviar = async (chave: string, file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem.");
    if (file.size > 3 * 1024 * 1024) return toast.error("Arquivo muito grande (máximo 3MB).");
    setEnviando(chave);
    try {
      const { error: errUpload } = await supabase.storage.from("branding").upload(chave, file, {
        upsert: true,
        contentType: file.type,
      });
      if (errUpload) throw errUpload;

      const { error: errConfig } = await (supabase as any)
        .from("configuracoes_marca")
        .upsert({ chave, atualizado_em: new Date().toISOString() } as never, { onConflict: "chave" });
      if (errConfig) throw errConfig;

      toast.success("Enviado! Pode levar alguns minutos pra atualizar em todo lugar (cache do navegador).");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar arquivo");
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Aparência</h2>
        <p className="text-sm text-muted-foreground">Logo, favicon e ícone do app — usados em todo o sistema.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {ASSETS.map((a) => {
            const url = publicUrl(a.chave, versoes[a.chave] ?? null);
            const temArquivo = versoes[a.chave] != null;
            return (
              <Card key={a.chave} className="flex flex-col gap-3 p-4">
                <div>
                  <div className="font-bold">{a.titulo}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.descricao}</p>
                </div>

                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30">
                  {temArquivo && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={a.titulo} className="max-h-24 max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">{a.dica}</p>

                <input
                  ref={(el) => { inputRefs.current[a.chave] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void enviar(a.chave, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={enviando === a.chave}
                  onClick={() => inputRefs.current[a.chave]?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {enviando === a.chave ? "Enviando..." : temArquivo ? "Substituir" : "Enviar arquivo"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
