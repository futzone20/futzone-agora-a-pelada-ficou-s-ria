import { supabase } from "@/integrations/supabase/client";
import { createTempSupabaseClient } from "@/integrations/supabase/tempClient";

export async function criarMembroManual(grupoId: string, nome: string, ehGoleiro: boolean) {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error("Informe o nome do jogador.");

  const rand = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const tempEmail = `convidado.${rand()}@placeholder.mrfut.app`;
  const tempPassword = `${rand()}${rand()}`;

  const temp = createTempSupabaseClient();
  try {
    const { data: signUpData, error: signUpError } = await temp.auth.signUp({
      email: tempEmail,
      password: tempPassword,
    });
    if (signUpError || !signUpData.user) {
      throw new Error(signUpError?.message || "Não foi possível criar a conta provisória.");
    }
    const novoUserId = signUpData.user.id;

    const { error: updateError } = await temp
      .from("profiles")
      .update({ nome: nomeLimpo, cadastro_completo: false, quer_ser_goleiro: ehGoleiro } as never)
      .eq("user_id", novoUserId);
    if (updateError) throw new Error(updateError.message);

    await temp.auth.signOut();

    const { error: membroError } = await supabase.from("grupo_membros").insert({
      grupo_id: grupoId,
      user_id: novoUserId,
      papel: "jogador",
      status: "ativo",
    } as never);
    if (membroError) throw new Error(membroError.message);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const e = btoa(tempEmail);
    const p = btoa(tempPassword);
    const linkConvite = `${origin}/completar-cadastro?e=${encodeURIComponent(e)}&p=${encodeURIComponent(p)}`;

    return { userId: novoUserId, linkConvite };
  } finally {
    try { await temp.auth.signOut(); } catch { /* noop */ }
  }
}
