import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Crosshair, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PositionSizer() {
  const [form, setForm] = useState({ entry: "", stop: "", risk_pct: "1.0", account_equity: "100000" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("riskEngine", {
        action: "position_size",
        entry: parseFloat(form.entry),
        stop: parseFloat(form.stop),
        risk_pct: parseFloat(form.risk_pct) || 1.0,
        account_equity: parseFloat(form.account_equity) || 100000,
      });
      if (res.error) throw new Error(res.error);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 max-w-3xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Entry Price", key: "entry", ph: "0.00" },
            { label: "Stop Loss", key: "stop", ph: "0.00" },
            { label: "Risk % per Trade", key: "risk_pct", ph: "1.0" },
            { label: "Account Equity", key: "account_equity", ph: "100000" },
          ].map(f => (
            <div key={f.key}>
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input type="number" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} className="h-8 text-xs mt-1 bg-secondary border-border font-mono" />
            </div>
          ))}
        </div>
        <Button onClick={calculate} disabled={loading || !form.entry || !form.stop} className="w-full h-8 text-xs gap-1.5">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
          Calculate Position Size
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        {!result ? (
          <div className="flex items-center justify-center h-full min-h-[200px] text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            Enter entry and stop to calculate
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Shares", val: result.shares, tone: "text-primary" },
                { label: "Dollar Risk", val: `$${result.dollar_risk}`, tone: "text-destructive" },
                { label: "Exposure", val: `$${result.dollar_exposure?.toLocaleString()}`, tone: "text-foreground" },
                { label: "% Portfolio", val: `${result.pct_portfolio}%`, tone: result.pct_portfolio > 10 ? "text-amber-400" : "text-accent" },
                { label: "Risk / Share", val: `$${result.risk_per_share}`, tone: "text-muted-foreground" },
                { label: "Half-Kelly", val: `${result.kelly_shares} sh`, tone: "text-muted-foreground" },
              ].map(r => (
                <div key={r.label} className="bg-secondary border border-border rounded-lg p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.label}</div>
                  <div className={cn("text-lg font-mono font-bold mt-0.5", r.tone)}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className={cn("px-3 py-2 rounded-lg text-xs border flex items-center gap-1.5",
              result.warning ? "bg-amber-400/5 border-amber-400/20 text-amber-400" : "bg-accent/5 border-accent/20 text-accent")}>
              {result.warning && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
              {result.warning || result.recommendation}
            </div>
          </>
        )}
      </div>
    </div>
  );
}