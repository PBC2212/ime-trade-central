import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Target, Zap, BarChart3, AlertTriangle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function MetricCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
          <Icon className={`w-4 h-4 ${accent || "text-muted-foreground"}`} />
        </div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function BacktestResults({ result }) {
  if (!result) return null;

  const {
    total_trades, winning_trades, win_rate, total_return_pct,
    max_drawdown_pct, profit_factor, sharpe_ratio, avg_trade_pct,
    final_equity, equity_curve = [], trades = [],
  } = result;

  const isProfit = total_return_pct >= 0;
  const equityData = equity_curve.map((p, i) => ({
    idx: i,
    date: p.date?.slice(0, 10) || "",
    equity: p.equity,
  }));

  const MIN_TRADES = 30;
  const isSmallSample = total_trades < MIN_TRADES;
  const sampleLabel =
    total_trades < 10 ? "Insufficient sample — results are not statistically meaningful"
    : total_trades < MIN_TRADES ? "Small sample — treat results with caution"
    : null;

  return (
    <div className="space-y-4">
      {/* Sample-size warning */}
      {isSmallSample && sampleLabel && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-amber-500">Small Sample Warning: </span>
            <span className="text-muted-foreground">{sampleLabel} Only {total_trades} trade{total_trades === 1 ? "" : "s"} were simulated — need {MIN_TRADES}+ for a reliable read on edge.</span>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={isProfit ? TrendingUp : TrendingDown}
          label="Total Return"
          value={`${isProfit ? "+" : ""}${total_return_pct}%`}
          sub={`$${Number(final_equity || 0).toLocaleString()}`}
          accent={isProfit ? "text-accent" : "text-destructive"}
        />
        <MetricCard icon={Activity} label="Win Rate" value={`${win_rate}%`} sub={`${winning_trades}/${total_trades} trades`} accent="text-primary" />
        <MetricCard icon={Zap} label="Profit Factor" value={profit_factor} sub={profit_factor >= 1.5 ? "Strong" : profit_factor >= 1 ? "Moderate" : "Weak"} accent={profit_factor >= 1 ? "text-accent" : "text-destructive"} />
        <MetricCard icon={BarChart3} label="Sharpe Ratio" value={sharpe_ratio} sub={sharpe_ratio >= 1 ? "Good" : "Poor"} accent="text-primary" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Target} label="Avg Trade" value={`${avg_trade_pct >= 0 ? "+" : ""}${avg_trade_pct}%`} accent={avg_trade_pct >= 0 ? "text-accent" : "text-destructive"} />
        <MetricCard icon={TrendingDown} label="Max Drawdown" value={`-${max_drawdown_pct}%`} accent="text-destructive" />
      </div>

      {/* Equity curve */}
      {equityData.length > 1 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(187 92% 50%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(187 92% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(222 30% 16%)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="equity" stroke="hsl(187 92% 50%)" strokeWidth={2} fill="url(#eqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trade list */}
      {trades.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Simulated Trades ({trades.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2 font-medium">Symbol</th>
                    <th className="py-2 pr-2 font-medium">Entry</th>
                    <th className="py-2 pr-2 font-medium">Exit</th>
                    <th className="py-2 pr-2 font-medium text-right">Return</th>
                    <th className="py-2 pr-2 font-medium text-right">P&L</th>
                    <th className="py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-1.5 pr-2 font-medium">{t.symbol}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">${t.entry_price}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">${t.exit_price}</td>
                      <td className={`py-1.5 pr-2 text-right font-medium ${t.return_pct >= 0 ? "text-accent" : "text-destructive"}`}>
                        {t.return_pct >= 0 ? "+" : ""}{t.return_pct}%
                      </td>
                      <td className={`py-1.5 pr-2 text-right ${t.pnl >= 0 ? "text-accent" : "text-destructive"}`}>
                        {t.pnl >= 0 ? "+" : ""}${Number(t.pnl).toLocaleString()}
                      </td>
                      <td className="py-1.5">
                        <Badge variant={t.exit_reason === 'target' ? 'default' : t.exit_reason === 'stop' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {t.exit_reason}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}