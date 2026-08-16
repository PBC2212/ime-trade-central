import { cn } from "@/lib/utils";

const toneClass = {
  green: "border-accent/20 bg-accent/5",
  amber: "border-amber-400/20 bg-amber-400/5",
  red: "border-destructive/20 bg-destructive/5",
  default: "border-primary/20 bg-primary/5",
};

export default function RiskKpiCard({ label, value, unit, icon: Icon, tone = "default", sub }) {
  return (
    <div className={cn("border rounded-lg p-3", toneClass[tone])}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <div className="text-xl font-mono font-bold text-foreground">
        {value}{unit && <span className="text-xs ml-0.5 text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}