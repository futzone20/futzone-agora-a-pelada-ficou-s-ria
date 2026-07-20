import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
}

const initials = (n?: string | null) =>
  (n || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

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
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao processar imagem"))), "image/jpeg", 0.85)
  );
}

export function AvatarUpload({ size = 96, className }: Props) {
  const { user, updateUser } = useAuth();
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
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
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
    if (!src || !areaPx || !user) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, areaPx);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const url = `${signed.signedUrl}&t=${Date.now()}`;
      await updateUser({ foto_url: url });
      toast.success("✅ Foto atualizada!");
      setSrc(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar foto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn("relative group rounded-full overflow-hidden", className)}
        style={{ width: size, height: size }}
        aria-label="Alterar foto"
      >
        <Avatar className="h-full w-full border border-border">
          {user?.foto_url && <AvatarImage src={user.foto_url} alt={user.nome} />}
          <AvatarFallback className="bg-secondary text-foreground font-bold" style={{ fontSize: size * 0.3 }}>
            {initials(user?.nome)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
          <Camera className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />

      <Dialog open={!!src} onOpenChange={(o) => !o && setSrc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajuste sua foto</DialogTitle></DialogHeader>
          <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onComplete}
              />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Arraste para reposicionar • Use o slider para zoom</div>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSrc(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Salvando..." : "Salvar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
