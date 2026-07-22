import { useEffect, useState } from "react";

export type PeladaStatus = "aguardando" | "confirmada" | "em_andamento" | "encerrada" | "cancelada" | string;

export const statusLabel = (s: PeladaStatus): string => {
  switch (s) {
    case "aguardando": return "Lista Liberada";
    case "confirmada": return "Lista Encerrada";
    case "em_andamento": return "Em Andamento";
    case "encerrada": return "Encerrada";
    case "cancelada": return "Cancelada";
    default: return s;
  }
};

export const statusClasses = (s: PeladaStatus): string => {
  switch (s) {
    case "aguardando": return "bg-yellow-500/15 text-yellow-500";
    case "confirmada": return "bg-blue-500/15 text-blue-400";
    case "em_andamento": return "bg-green-500/15 text-green-500 animate-pulse";
    case "encerrada": return "bg-muted text-muted-foreground";
    case "cancelada": return "bg-destructive/15 text-destructive";
    default: return "bg-primary/10 text-primary";
  }
};

export function StatusBadge({ status }: { status: PeladaStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function ConfirmadosProgress({ confirmados, capacidade }: { confirmados: number; capacidade: number }) {
  const pct = capacidade > 0 ? Math.min(100, Math.round((confirmados / capacidade) * 100)) : 0;
  const color = confirmados >= capacidade ? "bg-green-500" : confirmados > 0 ? "bg-yellow-500" : "bg-muted";
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs"><span className="font-bold text-primary">{confirmados}</span> <span className="text-muted-foreground">de {capacidade} jogadores confirmados</span></div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Relógio que atualiza a cada segundo — usado pra alimentar contagens regressivas ao vivo. */
export function useAgora(intervaloMs = 1000) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(i);
  }, [intervaloMs]);
  return agora;
}

export function formatarContagem(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

/** Formata sempre com dias, horas, minutos e segundos (ex: "2d 4h 12min 05s"). */
export function formatarContagemComDias(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const partes: string[] = [];
  if (d > 0) partes.push(`${d}d`);
  if (d > 0 || h > 0) partes.push(`${h}h`);
  partes.push(`${m}min`);
  if (d === 0) partes.push(`${s}s`);
  return partes.join(" ");
}

/**
 * Mostra o badge de status normal (agora com os textos "Lista Liberada"/"Lista Encerrada"
 * pra aguardando/confirmada). Quando a lista já fechou (status "confirmada") e o horário
 * marcado ainda não chegou, mostra também uma contagem regressiva ao vivo embaixo do badge,
 * no formato "Começa em Xd Yh Zmin Ws". Enquanto a lista ainda está aberta (status
 * "aguardando"), não mostra contagem — quem quiser ver quantas vagas faltam usa o
 * <ConfirmadosProgress> normalmente exibido logo abaixo no card.
 */
export function PeladaStatusOuContagem({
  status, data, horarioInicio, agora,
}: { status: PeladaStatus; data: string; horarioInicio: string; agora: number }) {
  if (status !== "confirmada") return <StatusBadge status={status} />;

  let inicio: number;
  try {
    inicio = new Date(`${data}T${horarioInicio}`).getTime();
  } catch {
    return <StatusBadge status={status} />;
  }
  const faltam = inicio - agora;
  if (!Number.isFinite(inicio) || faltam <= 0) return <StatusBadge status={status} />;

  return (
    <div className="flex flex-col items-end gap-1">
      <StatusBadge status={status} />
      <span className="text-[9px] font-bold text-blue-400">Começa em {formatarContagemComDias(faltam)}</span>
    </div>
  );
}
