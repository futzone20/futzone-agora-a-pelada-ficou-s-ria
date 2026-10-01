import { Input } from "@/components/ui/input";

const NOTAS = [200, 100, 50, 20, 10, 5, 2];
const MOEDAS = [1, 0.5, 0.25, 0.1, 0.05];

function brl(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type ContagemDetalhe = Record<string, number>;

export function totalContagem(detalhe: ContagemDetalhe | null | undefined): number {
  if (!detalhe) return 0;
  return Object.entries(detalhe).reduce((s, [den, qtd]) => s + Number(den) * (Number(qtd) || 0), 0);
}

interface Props {
  value: ContagemDetalhe;
  onChange: (v: ContagemDetalhe) => void;
}

/** Grade de contagem de cédulas e moedas, estilo "fechamento de caixa" físico. */
export function ContagemCaixa({ value, onChange }: Props) {
  const setQtd = (den: number, qtd: string) => {
    const n = qtd === "" ? 0 : Math.max(0, parseInt(qtd, 10) || 0);
    onChange({ ...value, [den]: n });
  };

  const linha = (den: number) => {
    const qtd = value[den] || 0;
    return (
      <div key={den} className="flex items-center gap-2 text-sm">
        <span className="w-20 shrink-0 font-mono">{brl(den)}</span>
        <span className="text-muted-foreground">x</span>
        <Input type="number" min={0} className="h-8 w-20" value={qtd || ""} onChange={e => setQtd(den, e.target.value)} />
        <span className="text-muted-foreground w-24 text-right ml-auto">{brl(den * qtd)}</span>
      </div>
    );
  };

  const total = totalContagem(value);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-bold text-muted-foreground mb-1">NOTAS</div>
        <div className="space-y-1">{NOTAS.map(linha)}</div>
      </div>
      <div>
        <div className="text-xs font-bold text-muted-foreground mb-1">MOEDAS</div>
        <div className="space-y-1">{MOEDAS.map(linha)}</div>
      </div>
      <div className="flex justify-between items-center border-t border-border pt-2 font-bold">
        <span>Total contado</span>
        <span className="text-primary">{brl(total)}</span>
      </div>
    </div>
  );
}
