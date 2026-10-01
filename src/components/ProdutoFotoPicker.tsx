import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Image as ImageIcon, Pencil, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** URL atual da foto do produto (ou vazio) */
  value?: string | null;
  onChange: (url: string) => void;
  /** Nome do produto digitado no formulário — usado para pré-preencher a busca na galeria */
  nomeSugestao?: string;
}

interface ItemGaleria { id: string; nome: string; url: string; }

/**
 * Seletor de foto de produto com galeria GLOBAL compartilhada entre todas as
 * arenas (tabela produtos_galeria_global). Primeiro busca se já existe uma
 * foto cadastrada por qualquer dono para aquele produto (evita duplicar a
 * mesma imagem, ex: "Coca-Cola lata 350ml", em várias contas); se não
 * encontrar, o usuário envia uma foto nova, que fica disponível pra todo
 * mundo buscar depois.
 */
export function ProdutoFotoPicker({ value, onChange, nomeSugestao }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ItemGaleria[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [nomeNovaFoto, setNomeNovaFoto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const buscar = async (q: string) => {
    setBuscando(true);
    let req = supabase.from("produtos_galeria_global").select("id,nome,url").order("criado_em", { ascending: false }).limit(24);
    if (q.trim()) req = req.ilike("nome", `%${q.trim()}%`);
    const { data } = await req;
    setResultados((data as any) ?? []);
    setBuscando(false);
  };

  useEffect(() => {
    if (!open) return;
    const inicial = nomeSugestao || "";
    setQuery(inicial);
    setNomeNovaFoto(inicial);
    void buscar(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void buscar(query), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const escolher = (item: ItemGaleria) => {
    onChange(item.url);
    setOpen(false);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo 5MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { toast.error("Formato inválido. Use JPG, PNG ou WEBP."); return; }
    void enviar(f);
  };

  const enviar = async (file: File) => {
    if (!user) return;
    setEnviando(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("produtos-galeria").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("produtos-galeria").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const url = `${signed.signedUrl}&t=${Date.now()}`;
      const nome = (nomeNovaFoto || nomeSugestao || "Produto").trim();
      await supabase.from("produtos_galeria_global").insert({ nome, url, criado_por: user.id } as never);
      onChange(url);
      toast.success("✅ Foto enviada e adicionada à galeria!");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar foto");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label>Foto do produto</Label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("relative group w-full h-28 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center")}
      >
        {value ? (
          <img src={value} alt="Produto" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs py-4">
            <ImageIcon className="h-6 w-6" />
            <span>Buscar na galeria ou enviar</span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
          <Pencil className="text-white h-5 w-5" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader><DialogTitle>Foto do produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar na galeria (ex: Coca-Cola lata 350ml)" value={query} onChange={e => setQuery(e.target.value)} />
            </div>

            {buscando && <p className="text-xs text-muted-foreground text-center py-2">Buscando...</p>}
            {!buscando && resultados.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {resultados.map(item => (
                  <button key={item.id} type="button" onClick={() => escolher(item)} className="text-left group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted/40">
                      <img src={item.url} alt={item.nome} className="w-full h-full object-cover group-hover:opacity-80 transition" />
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{item.nome}</div>
                  </button>
                ))}
              </div>
            )}
            {!buscando && resultados.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma foto encontrada na galeria para "{query || "esse produto"}".</p>
            )}

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Não encontrou? Envie uma foto nova — ela fica salva na galeria pra outras arenas usarem também.</p>
              <div><Label className="text-xs">Nome pra identificar na galeria</Label><Input value={nomeNovaFoto} onChange={e => setNomeNovaFoto(e.target.value)} placeholder="Ex: Coca-Cola lata 350ml" /></div>
              <Button type="button" variant="outline" className="w-full" disabled={enviando} onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />{enviando ? "Enviando..." : "Enviar nova foto"}
              </Button>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
