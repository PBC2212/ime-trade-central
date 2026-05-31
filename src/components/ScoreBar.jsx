import { cn } from "@/lib/utils";

export default function ScoreBar({ value = 0, type = "confidence", showLabel = true, size = "md" }) {
  const getColor = () => {
    if (type === "risk") {
      if (value >= 70) return "bg-destructive";
      if (value >= 40) return "bg-amber-500";
      return "bg-accent";
    }
    if (value >= 75) return "bg-accent";
    if (value >= 50) return "bg-primary";
    if (value >= 30) return "bg-amber-500";
    return "bg-destructive";
  };

  const getTextColor = () => {
    if (type === "risk") {
      if (value >= 70) return "text-destructive";
      if (value >= 40) return "text-amber-500";
      return "text-accent";
    }
    if (value >= 75) return "text-accent";
    if (value >= 50) return "text-primary";
    if (value >= 30) return "text-amber-500";
    return "text-destructive";
  };

  const h = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 bg-secondary rounded-full overflow-hidden", h)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", getColor())}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-xs font-mono font-semibold w-7 text-right", getTextColor())}>
          {Math.round(value)}
        </span>
      )}
    </div>
  );
}