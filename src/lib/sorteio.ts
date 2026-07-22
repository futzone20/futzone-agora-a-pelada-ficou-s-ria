export const SKILL_KEYS = ["velocidade", "drible", "passe", "chute", "resistencia", "posicionamento"] as const;

export const CORES_TIMES: { nome: string; cor: string }[][] = [
  [],
  [],
  [
    { nome: "Time Amarelo", cor: "#FFD700" },
    { nome: "Time Azul", cor: "#1E90FF" },
  ],
  [
    { nome: "Time Amarelo", cor: "#FFD700" },
    { nome: "Time Vermelho", cor: "#FF4444" },
    { nome: "Time Preto", cor: "#222222" },
  ],
  [
    { nome: "Time Amarelo", cor: "#FFD700" },
    { nome: "Time Vermelho", cor: "#FF4444" },
    { nome: "Time Preto", cor: "#222222" },
    { nome: "Time Verde", cor: "#00CC44" },
  ],
  [
    { nome: "Time Amarelo", cor: "#FFD700" },
    { nome: "Time Vermelho", cor: "#FF4444" },
    { nome: "Time Preto", cor: "#222222" },
    { nome: "Time Verde", cor: "#00CC44" },
    { nome: "Time Branco", cor: "#F0F0F0" },
  ],
  [
    { nome: "Time Amarelo", cor: "#FFD700" },
    { nome: "Time Vermelho", cor: "#FF4444" },
    { nome: "Time Preto", cor: "#222222" },
    { nome: "Time Verde", cor: "#00CC44" },
    { nome: "Time Branco", cor: "#F0F0F0" },
    { nome: "Time Laranja", cor: "#FF8C00" },
  ],
];

export type SkillRow = {
  user_id: string;
  velocidade: number; drible: number; passe: number; chute: number; resistencia: number; posicionamento: number;
};

export function mediaSkill(s?: SkillRow | null): number {
  if (!s) return 3;
  return SKILL_KEYS.reduce((acc, k) => acc + (s[k] || 0), 0) / SKILL_KEYS.length;
}

export type Jogador = { user_id: string; nome: string; media: number; eh_goleiro: boolean };

/** Distribuição em serpentina: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A... */
export function serpentina(jogadores: Jogador[], numTimes: number): Jogador[][] {
  const ordenados = [...jogadores].sort((a, b) => b.media - a.media);
  const times: Jogador[][] = Array.from({ length: numTimes }, () => []);
  let idx = 0;
  let dir = 1;
  for (const j of ordenados) {
    times[idx].push(j);
    if (dir === 1) {
      if (idx === numTimes - 1) dir = -1;
      else idx++;
    } else {
      if (idx === 0) dir = 1;
      else idx--;
    }
  }
  return times;
}

export function sortear(
  confirmados: Jogador[],
  numTimes: number,
  modalidadeGoleiro: "fixo" | "sorteado" = "fixo",
): { jogadores: Jogador[][]; goleiros: Jogador[][]; goleirosFixos: Jogador[] } {
  const shuffle = <T,>(arr: T[]) => arr.map(v => [Math.random(), v] as const).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);

  if (modalidadeGoleiro === "sorteado") {
    // Goleiros entram no sorteio como jogadores de linha
    return {
      jogadores: serpentina(shuffle(confirmados), numTimes),
      goleiros: Array.from({ length: numTimes }, () => []),
      goleirosFixos: [],
    };
  }

  // modalidade fixo: goleiros fora do sorteio dos times de linha
  const linha = confirmados.filter((c) => !c.eh_goleiro);
  const gks = confirmados.filter((c) => c.eh_goleiro);
  const timesLinha = serpentina(shuffle(linha), numTimes);
  return {
    jogadores: timesLinha,
    goleiros: distribuirGoleiros(gks, timesLinha),
    goleirosFixos: shuffle(gks),
  };
}


export function mediaTime(t: Jogador[]): number {
  if (!t.length) return 0;
  return t.reduce((a, j) => a + j.media, 0) / t.length;
}

/**
 * Distribui os goleiros confirmados entre os times de linha já montados.
 * Caso especial: 3 times e 2 goleiros — os índices 1 e 2 (que começam jogando)
 * recebem os goleiros de forma compensatória (mais forte com pior goleiro).
 */
export function distribuirGoleiros(goleiros: Jogador[], timesLinha: Jogador[][]): Jogador[][] {
  const numTimes = timesLinha.length;
  const resultado: Jogador[][] = Array.from({ length: numTimes }, () => []);
  if (!goleiros.length) return resultado;

  if (numTimes === 3 && goleiros.length === 2) {
    const [melhor, pior] = [...goleiros].sort((a, b) => b.media - a.media);
    const forcaTime1 = mediaTime(timesLinha[1] || []);
    const forcaTime2 = mediaTime(timesLinha[2] || []);
    const [idxMaisForte, idxMaisFraco] = forcaTime1 >= forcaTime2 ? [1, 2] : [2, 1];
    resultado[idxMaisForte] = [pior];
    resultado[idxMaisFraco] = [melhor];
    return resultado;
  }

  const ordenados = [...goleiros].sort((a, b) => b.media - a.media);
  let idx = 0, dir = 1;
  for (const g of ordenados) {
    resultado[idx].push(g);
    if (dir === 1) { if (idx === numTimes - 1) dir = -1; else idx++; }
    else { if (idx === 0) dir = 1; else idx--; }
  }
  return resultado;
}


export function sugerirTrocaGoleiro(params: {
  times: { id: string; nome: string; cor: string; nivelGeral: number; goleiro?: { user_id: string; nome: string; nivel: number } | null }[];
  timeVencedorId: string;
  timePerdedorId: string;
  timeForaId: string | null;
}): { sugestao: boolean; trocas: { goleiroId: string; nomeGoleiro: string; deTimeId: string; paraTimeId: string }[] } {
  const { times, timeVencedorId, timePerdedorId, timeForaId } = params;
  const timeVencedor = times.find((t) => t.id === timeVencedorId);
  const timeFora = timeForaId ? times.find((t) => t.id === timeForaId) : null;
  if (!timeVencedor || !timeFora) return { sugestao: false, trocas: [] };
  const diferencaForce = timeVencedor.nivelGeral - timeFora.nivelGeral;
  if (diferencaForce <= 0.3) return { sugestao: false, trocas: [] };

  const trocas: { goleiroId: string; nomeGoleiro: string; deTimeId: string; paraTimeId: string }[] = [];
  if (timeVencedor.goleiro) {
    trocas.push({
      goleiroId: timeVencedor.goleiro.user_id,
      nomeGoleiro: timeVencedor.goleiro.nome,
      deTimeId: timeVencedorId,
      paraTimeId: timeFora.id,
    });
  }
  const timePerdedor = times.find((t) => t.id === timePerdedorId);
  if (timePerdedor?.goleiro) {
    trocas.push({
      goleiroId: timePerdedor.goleiro.user_id,
      nomeGoleiro: timePerdedor.goleiro.nome,
      deTimeId: timePerdedorId,
      paraTimeId: timeVencedorId,
    });
  }
  return { sugestao: trocas.length > 0, trocas };
}
