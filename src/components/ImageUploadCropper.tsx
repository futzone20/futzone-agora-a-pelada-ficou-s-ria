import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Image as ImageIcon, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  /** Rótulo exibido acima do campo (ex: "Logo", "Foto de capa") */
  label: string;
  /** URL atual da imagem já salva (ou vazio) */
  value?: string | null;
  /** Chamado com a nova URL assinada após o upload */
  onChange: (url: string) => void;
  /** Id da arena — define a pasta no bucket (um arquivo por arena/slot) */
  arenaId: string;
  /** Nome do arquivo dentro da pasta da arena, ex: "logo" ou "capa" */
  fileSlot: string;
  /** Proporção largura/altura da máscara de corte, ex: 1 (quadrado) ou 16/9 */
  aspect: number;
  /** Formato da máscara de corte */
  cropShape?: "round" | "rect";
  /** Texto auxiliar, ex: "Recomendado: 1200x400px (proporção 3:1)" */
  dimensionsHint?: string;
  /** Altura do preview antes de abrir o editor */
  previewClassName?: string;
}

async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao processar imagem"))), "image/jpeg", 0.9)
  );
}

export function ImageUploadCropper({
  label, value, onChange, arenaId, fileSlot, aspect, cropShape = "rect", dimensionsHint, previewClassName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onComplete = useCallback((_: Area, a: Area) => setAreaPx(a), []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 8MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    const r = new FileReader();
    r.onload = () => setSrc(r.result as string);
    r.readAsDataURL(f);
  };

  const save = async () => {
    if (!src || !areaPx || !arenaId) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, areaPx);
      const path = `${arenaId}/${fileSlot}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("arena-assets")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("arena-assets")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const url = `${signed.signedUrl}&t=${Date.now()}`;
      onChange(url);
      toast.success("✅ Imagem atualizada!");
      setSrc(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar imagem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative group w-full overflow-hidden border border-dashed border-border bg-muted/40 flex items-center justify-center",
          cropShape === "round" ? "rounded-full aspect-square mx-auto" : "rounded-lg",
          previewClassName || "h-32"
        )}
      >
        {value ? (
          <img src={value} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs py-4">
            <ImageIcon className="h-6 w-6" />
            <span>Clique para enviar</span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
          <Pencil className="text-white h-5 w-5" />
        </span>
      </button>
      {dimensionsHint && <p className="text-xs text-muted-foreground">{dimensionsHint}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />

      <Dialog open={!!src} onOpenChange={(o) => !o && setSrc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajustar {label.toLowerCase()}</DialogTitle></DialogHeader>
          <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={cropShape}
                showGrid={cropShape === "rect"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onComplete}
              />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Arraste para reposicionar • Use o slider para zoom/diminuir</div>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0])} />
          </div>
          {dimensionsHint && <p className="text-xs text-muted-foreground">{dimensionsHint}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSrc(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
