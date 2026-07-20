export type PeladaStatus = "aguardando" | "confirmada" | "em_andamento" | "encerrada" | "cancelada" | string;

export const statusLabel = (s: PeladaStatus): string => {
  switch (s) {
    case "aguardando": return "Aguardando Lista";
    case "confirmada": return "Escalação Completa";
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
