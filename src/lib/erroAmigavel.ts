/**
 * Traduz erros técnicos do Supabase/Postgres (em inglês, com código) pra
 * mensagens claras em português — em vez da pessoa ver algo tipo
 * "new row violates row-level security policy for table...", ela vê uma
 * frase que explica o que fazer.
 */
export function mensagemErroAmigavel(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Algo deu errado. Tente novamente.";
  const msg = error.message || "";

  if (error.code === "42501" || /row-level security|permission denied|insufficient_privilege/i.test(msg)) {
    return "Você não tem permissão de capitão (ou auxiliar) nesse grupo pra fazer isso. Se acha que deveria ter, fale com quem criou o grupo.";
  }
  if (/JWT|not authenticated|401/i.test(msg)) {
    return "Sua sessão expirou. Atualize a página e entre de novo.";
  }
  if (/is not unique|choose the best candidate function/i.test(msg)) {
    return "Erro interno no sistema (função duplicada no banco). Já foi reportado — tenta de novo em instantes.";
  }
  return msg;
}
