import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, RotateCcw, Dices, Trophy, Beer, Shirt, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tente-a-sua-sorte")({
  head: () => ({
    meta: [
      { title: "Tente a sua sorte — MRFUT" },
      { name: "description", content: "Gire a roleta e descubra o destino da sua pelada." },
      { property: "og:title", content: "Tente a sua sorte — MRFUT" },
      { property: "og:description", content: "Gire a roleta e descubra o destino da sua pelada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenteASuaSortePage,
});

const OPCOES = [
  { label: "Paga a cerveja", icon: Beer, cor: "#00FF87" },
  { label: "Vai de goleiro", icon: Shirt, cor: "#1E90FF" },
  { label: "Escolhe os times", icon: Dices, cor: "#FFD700" },
  { label: "Faz o churrasco", icon: Trophy, cor: "#FF4444" },
  { label: "Leva o placar", icon: Trophy, cor: "#FF8C00" },
  { label: "Compra a bola", icon: Dices, cor: "#9B59B6" },
];

function TenteASuaSortePage() {
  const [girando, setGirando] = useState(false);
  const [indiceResultado, setIndiceResultado] = useState<number | null>(null);
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const roletaRef = useRef<HTMLDivElement>(null);

  const girar = () => {
    if (girando) return;
    setGirando(true);
    setMostrarResultado(false);

    const sorteado = Math.floor(Math.random() * OPCOES.length);
    setIndiceResultado(sorteado);

    const voltas = 5 + Math.floor(Math.random() * 3);
    const anguloPorOpcao = 360 / OPCOES.length;
    const anguloSorteado = sorteado * anguloPorOpcao + anguloPorOpcao / 2;
    const anguloFinal = voltas * 360 + (360 - anguloSorteado);

    if (roletaRef.current) {
      roletaRef.current.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
      roletaRef.current.style.transform = `rotate(${anguloFinal}deg)`;
    }

    setTimeout(() => {
      setGirando(false);
      setMostrarResultado(true);
    }, 4200);
  };

  const resetar = () => {
    setMostrarResultado(false);
    setIndiceResultado(null);
    if (roletaRef.current) {
      roletaRef.current.style.transition = "none";
      roletaRef.current.style.transform = "rotate(0deg)";
    }
  };

  useEffect(() => {
    return () => resetar();
  }, []);

  const resultado = indiceResultado !== null ? OPCOES[indiceResultado] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Link to="/">
          <Logo className="text-xl" />
        </Link>
        <Link to="/">
          <Button variant="ghost" className="gap-2 text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-12 text-center">
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
          Tente a sua sorte
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
          Gire a roleta e descubra quem leva a bronca da pelada de hoje.
        </p>

        <Card className="relative mt-10 flex aspect-square w-full max-w-[360px] items-center justify-center rounded-3xl border border-border bg-card p-6 shadow-2xl">
          {/* Ponteiro */}
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-primary" />
          </div>

          {/* Roleta */}
          <div
            ref={roletaRef}
            className="relative h-full w-full rounded-full"
            style={{
              background: `conic-gradient(${OPCOES.map((o, i) => `${o.cor} ${i * (360 / OPCOES.length)}deg ${(i + 1) * (360 / OPCOES.length)}deg`).join(", ")})`,
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.4)",
            }}
          >
            {OPCOES.map((opcao, i) => {
              const angulo = i * (360 / OPCOES.length) + 360 / OPCOES.length / 2;
              return (
                <div
                  key={opcao.label}
                  className="absolute left-1/2 top-1/2 flex w-[45%] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angulo}deg) translateY(-75px)`,
                  }}
                >
                  <div className="flex flex-col items-center gap-1 text-[10px] font-bold text-black drop-shadow-md md:text-xs">
                    <opcao.icon className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="w-16 leading-tight">{opcao.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centro */}
          <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-card shadow-xl">
            <Dices className="h-6 w-6 text-primary" />
          </div>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={girar}
            disabled={girando}
            className="gap-2 bg-primary px-8 text-lg font-black uppercase tracking-wide text-black shadow-[0_0_30px_rgba(0,255,135,0.35)] transition hover:scale-105 hover:bg-primary/90 disabled:opacity-60"
          >
            {girando ? "Girando..." : "Girar a roleta"}
            <Sparkles className="h-5 w-5" />
          </Button>

          {mostrarResultado && resultado && (
            <div className="animate-fade-in-up mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-8 py-6">
              <p className="text-sm text-muted-foreground">O destino escolheu:</p>
              <div className="mt-2 flex items-center justify-center gap-2 text-2xl font-black text-primary md:text-3xl">
                <resultado.icon className="h-7 w-7" />
                {resultado.label}
              </div>
            </div>
          )}

          {indiceResultado !== null && !girando && (
            <Button variant="outline" onClick={resetar} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Jogar de novo
            </Button>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        MRFUT © {new Date().getFullYear()} — A pelada ficou séria.
      </footer>
    </div>
  );
}
