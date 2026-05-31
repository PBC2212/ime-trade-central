import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({ label, value, sub, change, changeType, icon: Icon, accent = false }) {
  const isPositive = changeType === "positive" || (typeof change === "number" && change > 0);
  const isNegative = changeType === "negative" || (typeof change === "number" && change < 0);

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 flex flex-col gap-2",
      accent && "border-primary/30 bg-primary/5"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className={cn("w-7 h-7 rounded flex items-center justify-center", accent ? "bg-primary/20" : "bg-secondary")}>
            <Icon className={cn("w-3.5 h-3.5", accent ? "text-primary" : "text-muted-foreground")} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground font-mono tracking-tight">{value}</div>
      <div className="flex items-center gap-2">
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isPositive && "text-accent",
            isNegative && "text-destructive",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            <span>{typeof change === "number" ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : change}</span>
          </div>
        )}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}