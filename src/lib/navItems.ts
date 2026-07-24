import { Home, CircleDot, Radio, Trophy, User } from "lucide-react";
import type { NavItem } from "@/components/MobileShell";

/**
 * Gera os itens do menu de rodapé de acordo com o papel do usuário (jogador ou capitão).
 * Usado em TODAS as telas que mostram o menu — tanto nos layouts-pai (jogador.tsx/capitao.tsx)
 * quanto em telas de detalhe fora deles (grupos.$id, peladas.$id, etc), pra nunca ficar
 * divergente ou apontando pro papel errado.
 */
export function getNavItems(role: string | undefined): NavItem[] {
  const base = role === "capitao" ? "/capitao" : "/jogador";
  return [
    { to: base, label: "Início", icon: Home },
    { to: `${base}/peladas`, label: "Peladas", icon: CircleDot },
    { to: `${base}/resenha`, label: "Resenha", icon: Radio, destaque: true },
    { to: `${base}/ranking`, label: "Ranking", icon: Trophy },
    { to: `${base}/perfil`, label: "Perfil", icon: User },
  ];
}
