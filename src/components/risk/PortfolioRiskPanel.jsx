import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import RiskKpiCard from "./RiskKpiCard";
import { Loader2, AlertTriangle, Flame, TrendingDown, ShieldAlert, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const riskFlagColor = {
  green: "text-accent bg-accent/10 border-accent/20",
  amber: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  red: "text-destructive bg-destructive/10 border-destructive/20",
};

export default function PortfolioRiskPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        const connected = !!(me?.data?.alpaca_api_key && me?.data?.alpaca_secret_key);
        if (!connected) { setNotConnected(true); setLoading(false); return; }

        const [acctRes, posRes, trades] = await Promise.all([
          base44.functions.invoke("alpaca", { action: "account" }),
          base44.functions.invoke("alpaca", { action: "positions" }),
          base44.entities.TradeJournal.list("-created_date", 100),
        ]);
        const equity = acctRes.account?.equity || me?.data?.portfolio_equity || 100000;
        const positions = posRes.positions || [];
        const risk = await base44.functions.invoke("riskEngine", {
          action: "portfolio_risk",
          positions, account_equity: equity, trades,
        });
        if (risk.error) throw new Error(risk.error);
        setData({ ...risk, equity, positions: risk.positions || [] });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (notConnected) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <AlertTriangle className="w-8 h-8 text-amber-500/50" />
      <p className="text-sm text-muted-foreground max-w-xs">Connect your Alpaca account in the Broker page to view portfolio risk.</p>
      <a href="/broker"><button className="text-xs text-primary hover:underline">Go to Broker →</button></a>
    </div>
  );
  if (error) return <div className="text-center py-16 text-destructive text-sm">Failed to load risk data: {error}</div>;
  if (!data) return null;

  const ddTone = data.max_drawdown_pct >= 10 ? "red" : data.max_drawdown_pct >= 5 ? "amber" : "green";
  const sizeTone = data.sizing_multiplier === 0 ? "red" : data.sizing_multiplier < 1 ? "amber" : "green";
  const statusTone = data.drawdown_status === "halt" ? "red" : data.drawdown_status === "normal" ? "green" : "amber";

  return (
    <div className="space-y-4">
      {data.warnings?.length > 0 && (
        <div className="space-y-1.5">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <RiskKpiCard label="Portfolio Heat" value={data.portfolio_heat_pct} unit="%" icon={Flame}
          tone={data.heat_flag} sub={`${data.positions?.length || 0} positions`} />
        <RiskKpiCard label="Max Drawdown" value={data.max_drawdown_pct} unit="%" icon={TrendingDown} tone={ddTone} />
        <RiskKpiCard label="Sizing Multiplier" value={data.sizing_multiplier} unit="×" icon={ShieldAlert}
          tone={sizeTone} sub={data.sizing_multiplier === 0 ? "HALT" : data.sizing_multiplier < 1 ? "Reduced" : "Normal"} />
        <RiskKpiCard label="Status" value={data.drawdown_status?.replace(/_/g, " ")} icon={Activity}
          tone={statusTone} sub={`Equity $${data.equity?.toLocaleString()}`} />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-secondary border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Position Exposure
        </div>
        {(!data.positions || data.positions.length === 0) ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Symbol</th>
                  <th className="text-right px-3 py-2 font-medium">Side</th>
                  <th className="text-right px-3 py-2 font-medium">Mkt Value</th>
                  <th className="text-right px-3 py-2 font-medium">Unreal. P&L</th>
                  <th className="text-right px-3 py-2 font-medium">% Port</th>
                  <th className="text-center px-3 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map(p => (
                  <tr key={p.symbol} className="border-t border-border/50 hover:bg-secondary/30">
                    <td className="px-3 py-2 font-mono font-bold text-foreground">{p.symbol}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground capitalize">{p.side}</td>
                    <td className="px-3 py-2 text-right font-mono">${p.market_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", p.unrealized_pl >= 0 ? "text-accent" : "text-destructive")}>
                      {p.unrealized_pl >= 0 ? "+" : ""}{p.unrealized_pl?.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{p.pct_portfolio}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("inline-block px-2 py-0.5 rounded text-[9px] font-bold border", riskFlagColor[p.risk_flag])}>
                        {p.risk_flag?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}