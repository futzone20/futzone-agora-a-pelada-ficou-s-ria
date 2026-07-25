import { supabase } from "@/integrations/supabase/client";

/** Cria um post de texto livre (o próprio jogador escrevendo, não gerado pelo sistema).
 *  grupoId null = postar pra "Todos" (visível pra fora do grupo). */
export async function criarPostJogador(userId: string, grupoId: string | null, texto: string) {
  return supabase.from("feed_posts").insert({
    grupo_id: grupoId,
    tipo: "post_jogador",
    user_id: userId,
    conteudo: { texto: texto.slice(0, 500) },
  } as never);
}
