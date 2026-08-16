import { useState } from "react";
import { ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function parse(toolCall) {
  const raw = toolCall.results;
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  }
  const failed =
    toolCall.status === "failed" || toolCall.status === "error" ||
    (typeof raw === "string" && /error|failed/i.test(raw)) ||
    (parsed && typeof parsed === "object" && parsed.success === false);
  const running = ["pending", "running", "in_progress"].includes(toolCall.status);
  const proj = toolCall.display_projection || {};
  const hidden = proj.hide_details && proj.details_redacted;
  return { parsed, failed, running, proj, hidden };
}

export default function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const { parsed, failed, running, proj, hidden } = parse(toolCall);

  const label = failed
    ? (proj.error_label || "Failed")
    : running ? (proj.active_label || "Working…") : (proj.label || "Completed");

  const Icon = failed ? AlertCircle : running ? Loader2 : Check;
  const color = failed ? "text-destructive" : running ? "text-primary" : "text-accent";
  const name = toolCall.name || "tool";

  return (
    <div className="mt-2 text-xs border-t border-border/50 pt-1.5">
      <button
        type="button"
        onClick={() => !hidden && setExpanded(e => !e)}
        className={cn("flex items-center gap-1.5 w-full", !hidden && "cursor-pointer hover:text-foreground")}
        disabled={hidden}
      >
        <Icon className={cn("w-3 h-3 flex-shrink-0", color, running && "animate-spin")} />
        <span className="text-muted-foreground capitalize">{name}</span>
        <span className={cn("text-[10px]", color)}>· {label}</span>
        {!hidden && <ChevronRight className={cn("w-3 h-3 text-muted-foreground ml-auto transition-transform", expanded && "rotate-90")} />}
      </button>
      {expanded && !hidden && (
        <div className="mt-1.5 pl-5 space-y-1.5">
          {toolCall.arguments_string && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Parameters</span>
              <pre className="mt-0.5 text-[10px] font-mono whitespace-pre-wrap break-words text-foreground/80">{toolCall.arguments_string}</pre>
            </div>
          )}
          {parsed !== undefined && parsed !== "" && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Result</span>
              <pre className="mt-0.5 text-[10px] font-mono whitespace-pre-wrap break-words text-foreground/80 max-h-40 overflow-y-auto">
                {typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}