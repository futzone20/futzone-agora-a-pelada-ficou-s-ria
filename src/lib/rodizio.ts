export type RegraEmpate = "time_atual_sai" | "time_atual_fica";

export type SaidaEntrada = { entrouEm: "A" | "B"; timeQueSaiu: string };

export type ResultadoRodada = {
  novoA: string;
  novoB: string;
  novaFila: string[];
  saidas: SaidaEntrada[];
  empateResolvidoPorSorteio?: boolean;
};

export function proximaRodada(params: {
  timeAId: string;
  timeBId: string;
  filaAtual: string[];
  placarA: number;
  placarB: number;
  numeroPartida: number;
  regraEmpate: RegraEmpate;
}): ResultadoRodada | null {
  const { timeAId, timeBId, filaAtual, placarA, placarB, numeroPartida, regraEmpate } = params;
  if (!filaAtual.length) return null;

  const empate = placarA === placarB;
  const numTimesNoRodizio = filaAtual.length + 2;

  if (empate && numTimesNoRodizio >= 4) {
    const [proxA, proxB, ...restoFila] = filaAtual;
    return {
      novoA: proxA,
      novoB: proxB,
      novaFila: [...restoFila, timeAId, timeBId],
      saidas: [
        { entrouEm: "A", timeQueSaiu: timeAId },
        { entrouEm: "B", timeQueSaiu: timeBId },
      ],
    };
  }

  if (empate && numeroPartida === 1) {
    const fica = Math.random() < 0.5 ? timeAId : timeBId;
    const sai = fica === timeAId ? timeBId : timeAId;
    return {
      novoA: fica,
      novoB: filaAtual[0],
      novaFila: [sai],
      saidas: [{ entrouEm: "B", timeQueSaiu: sai }],
      empateResolvidoPorSorteio: true,
    };
  }

  if (empate) {
    const fica = regraEmpate === "time_atual_fica" ? timeAId : timeBId;
    const sai = fica === timeAId ? timeBId : timeAId;
    return {
      novoA: fica,
      novoB: filaAtual[0],
      novaFila: [sai],
      saidas: [{ entrouEm: "B", timeQueSaiu: sai }],
    };
  }

  const vencedor = placarA > placarB ? timeAId : timeBId;
  const perdedor = vencedor === timeAId ? timeBId : timeAId;
  const [proximo, ...restoFila] = filaAtual;
  return {
    novoA: vencedor,
    novoB: proximo,
    novaFila: [...restoFila, perdedor],
    saidas: [{ entrouEm: "B", timeQueSaiu: perdedor }],
  };
}

export function escolherTimesIniciais<T extends { id: string }>(
  times: T[],
  timeIdsComGoleiro: Set<string>,
): { jogam: T[]; fila: T[] } {
  const comGoleiro = times.filter((t) => timeIdsComGoleiro.has(t.id));
  const semGoleiro = times.filter((t) => !timeIdsComGoleiro.has(t.id));
  const ordenados = [...comGoleiro, ...semGoleiro];
  return { jogam: ordenados.slice(0, 2), fila: ordenados.slice(2) };
}
