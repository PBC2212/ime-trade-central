import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import RiskKpiCard from "./RiskKpiCard";
import { Loader2, Activity, Target, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const tooltipStyle = { background: "hsl(222 47% 8%)", border: "1px solid hsl(222 30% 16%)", borderRadius: "0.5rem", fontSize: 11 };

export default function PerformanceMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const trades = await base44.entities.TradeJournal.list("-created_date", 200);
        const res = await base44.functions.invoke("riskEngine", { action: "performance_metrics", trades });
        if (res.error) throw new Error(res.error);
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error) return <div className="text-center py-16 text-destructive text-sm">Failed to load metrics: {error}</div>;
  if (!data?.metrics) return <div className="text-center py-16 text-xs text-muted-foreground">No closed trades yet — close some trades in the Journal to see performance metrics.</div>;

  const m = data.metrics;
  const equityData = (m.equity_curve || []).map((e, i) => ({ idx: i + 1, pnl: e.pnl }));
  const monthlyData = Object.entries(m.monthly_returns || {}).map(([k, v]) => ({ month: k, pnl: +v.toFixed(2) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <RiskKpiCard label="Sharpe Ratio" value={m.sharpe_ratio} icon={Activity} tone={m.sharpe_ratio >= 1 ? "green" : m.sharpe_ratio >= 0 ? "amber" : "red"} />
        <RiskKpiCard label="Sortino" value={m.sortino_ratio} icon={Activity} tone={m.sortino_ratio >= 1.5 ? "green" : m.sortino_ratio >= 0.5 ? "amber" : "red"} />
        <RiskKpiCard label="Calmar" value={m.calmar_ratio} icon={Activity} tone={m.calmar_ratio >= 1 ? "green" : "amber"} />
        <RiskKpiCard label="Profit Factor" value={m.profit_factor} icon={Activity} tone={m.profit_factor >= 1.5 ? "green" : m.profit_factor >= 1 ? "amber" : "red"} />
        <RiskKpiCard label="Expectancy" value={`$${m.expectancy}`} icon={Activity} tone={m.expectancy >= 0 ? "green" : "red"} />
      </div>
      <div className="grid grid-cols-5 gap-3">
        <RiskKpiCard label="Win Rate" value={m.win_rate} unit="%" icon={Target} tone={m.win_rate >= 50 ? "green" : "amber"} sub={`${m.winning_trades}W / ${m.losing_trades}L`} />
        <RiskKpiCard label="Avg Win" value={`$${m.avg_win}`} icon={TrendingUp} tone="green" />
        <RiskKpiCard label="Avg Loss" value={`$${m.avg_loss}`} icon={TrendingDown} tone="red" />
        <RiskKpiCard label="Max Drawdown" value={m.max_drawdown_pct} unit="%" icon={TrendingDown} tone={m.max_drawdown_pct >= 10 ? "red" : "amber"} />
        <RiskKpiCard label="Max Consec Loss" value={m.max_consecutive_losses} icon={AlertTriangle} tone={m.max_consecutive_losses >= 5 ? "red" : "amber"} />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Equity Curve</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={equityData}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(187 92% 50%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(187 92% 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
            <XAxis dataKey="idx" stroke="hsl(215 20% 55%)" fontSize={10} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="pnl" stroke="hsl(187 92% 50%)" strokeWidth={2} fill="url(#eqGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {monthlyData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Monthly Returns</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={10} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {monthlyData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "hsl(142 72% 50%)" : "hsl(0 72% 55%)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}