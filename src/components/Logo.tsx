import { Circle } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <Circle className="h-5 w-5 text-primary" strokeWidth={2.5} />
      <span>
        MR<span className="text-primary">FUT</span>
      </span>
    </span>
  );
}
