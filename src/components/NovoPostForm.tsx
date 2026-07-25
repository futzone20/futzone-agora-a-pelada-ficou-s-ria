import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Smile, AtSign, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { criarPostJogador } from "@/lib/postJogador";

const EMOJIS = ["😂", "🔥", "⚽", "👏", "😅", "😭", "🥶", "💪", "🐔", "🎯", "😤", "🏆", "👀", "🤝", "💀", "🙌"];
const LIMITE = 500;

export type MembroPost = { user_id: string; nome: string; handle: string | null; foto_url: string | null };

/**
 * Formulário de "novo post" — usado tanto direto na tela de Resenha quanto no atalho de
 * segurar a bola do menu. Foco no campo de texto: só @menção, emoji e escolha de público
 * (um grupo específico ou "Todos").
 */
export function NovoPostForm({
  gruposMap, membrosPorGrupo, titulo = false, onPosted,
}: {
  gruposMap: Record<string, string>;
  membrosPorGrupo: Record<string, MembroPost[]>;
  titulo?: boolean;
  onPosted?: () => void;
}) {
  const { user } = useAuth();
  const gruposIds = Object.keys(gruposMap);
  const [publicoSel, setPublicoSel] = useState<string>(gruposIds[0] || "todos");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [sugestoes, setSugestoes] = useState<MembroPost[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const membrosDisponiveis = publicoSel === "todos"
    ? Object.values(membrosPorGrupo).flat().filter((m, i, arr) => arr.findIndex((x) => x.user_id === m.user_id) === i)
    : membrosPorGrupo[publicoSel] || [];

  const onChangeTexto = (v: string) => {
    const val = v.slice(0, LIMITE);
    setTexto(val);
    const m = val.match(/@([a-zA-Z0-9_]*)$/);
    if (m) {
      const termo = m[1].toLowerCase();
      setSugestoes(membrosDisponiveis.filter((u) => (u.handle || "").toLowerCase().startsWith(termo) || u.nome.toLowerCase().startsWith(termo)).slice(0, 5));
    } else {
      setSugestoes([]);
    }
  };

  const escolherMencao = (m: MembroPost) => {
    const alvo = m.handle || m.nome.split(" ")[0].toLowerCase();
    setTexto((prev) => prev.replace(/@([a-zA-Z0-9_]*)$/, `@${alvo} `).slice(0, LIMITE));
    setSugestoes([]);
    inputRef.current?.focus();
  };

  const inserirEmoji = (e: string) => {
    setTexto((prev) => (prev + e).slice(0, LIMITE));
  };

  const postar = async () => {
    if (!user || !texto.trim()) return;
    setEnviando(true);
    const grupoId = publicoSel === "todos" ? null : publicoSel;
    const { error } = await criarPostJogador(user.id, grupoId, texto);
    setEnviando(false);
    if (error) return toast.error(error.message);
    setTexto("");
    setEmojiAberto(false);
    toast.success("Postado na Resenha! 🎉");
    onPosted?.();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
      {titulo && (
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Pencil className="h-4 w-4" /></div>
          <span className="font-bold">Nova resenha</span>
        </div>
      )}

      <div className="flex items-start gap-2">
        <Avatar className="h-9 w-9 shrink-0">
          {user?.foto_url ? <AvatarImage src={user.foto_url} /> : null}
          <AvatarFallback className="bg-secondary text-xs">{(user?.nome || "?")[0]}</AvatarFallback>
        </Avatar>
        <div className="relative flex-1">
          {sugestoes.length > 0 && (
            <div className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {sugestoes.map((m) => (
                <button key={m.user_id} onClick={() => escolherMencao(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                  <Avatar className="h-6 w-6"><AvatarImage src={m.foto_url || undefined} /><AvatarFallback className="text-[10px]">{m.nome[0]}</AvatarFallback></Avatar>
                  <span className="font-medium">{m.nome}</span>
                  {m.handle && <span className="text-xs text-primary">@{m.handle}</span>}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => onChangeTexto(e.target.value)}
            placeholder="Compartilhe um lance, uma resenha ou um destaque..."
            rows={3}
            className="w-full resize-none rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
          />
          <div className="mt-0.5 text-right text-[10px] text-muted-foreground">{texto.length}/{LIMITE}</div>
        </div>
      </div>

      {emojiAberto && (
        <div className="grid grid-cols-8 gap-1 rounded-lg border border-border bg-secondary/30 p-2">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => inserirEmoji(e)} className="text-xl transition hover:scale-125">{e}</button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setEmojiAberto((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground" title="Emoji">
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => { setTexto((prev) => (prev.endsWith(" ") || !prev ? prev + "@" : prev + " @")); inputRef.current?.focus(); }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Marcar alguém"
          >
            <AtSign className="h-5 w-5" />
          </button>
        </div>

        {gruposIds.length > 0 && (
          <select
            value={publicoSel}
            onChange={(e) => setPublicoSel(e.target.value)}
            className="h-9 rounded-lg border border-border bg-secondary px-2 text-xs outline-none"
          >
            {gruposIds.map((id) => <option key={id} value={id}>{gruposMap[id]}</option>)}
            <option value="todos">🌍 Todos</option>
          </select>
        )}
      </div>

      <Button onClick={postar} disabled={!texto.trim() || enviando} className="w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90">
        <Send className="mr-2 h-4 w-4" /> {enviando ? "Publicando..." : "Publicar na Resenha"}
      </Button>
    </div>
  );
}
