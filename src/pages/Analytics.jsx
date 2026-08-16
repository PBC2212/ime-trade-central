import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { BarChart2, TrendingUp, TrendingDown, Target, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";

const COLORS = ["hsl(187,92%,50%)", "hsl(142,72%,50%)", "hsl(38,92%,55%)", "hsl(280,65%,60%)", "hsl(0,72%,55%)"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded p-2 text-xs">
      {label && <div className="text-muted-foreground mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "hsl(210,40%,96%)" }}>
          {p.name}: {typeof p.value === "number" ? (p.value >= 0 ? "+" : "") + "$" + p.value.toFixed(0) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.TradeJournal.list("-entry_date", 200)
      .then(setTrades)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const closed = trades.filter(t => t.status === "closed");
  const totalPnl = closed.reduce((a, t) => a + (t.pnl || 0), 0);
  const winners = closed.filter(t => (t.pnl || 0) > 0);
  const losers = closed.filter(t => (t.pnl || 0) <= 0);
  const winRate = closed.length ? Math.round((winners.length / closed.length) * 100) : 0;
  const avgWin = winners.length ? winners.reduce((a, t) => a + (t.pnl || 0), 0) / winners.length : 0;
  const avgLoss = losers.length ? Math.abs(losers.reduce((a, t) => a + (t.pnl || 0), 0) / losers.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "∞";

  // P&L by trade (bar chart)
  const pnlByTrade = closed.slice(-20).map((t, i) => ({
    name: t.symbol,
    pnl: t.pnl || 0,
    fill: (t.pnl || 0) >= 0 ? "hsl(142,72%,50%)" : "hsl(0,72%,55%)",
  }));

  // Running P&L (area)
  let running = 0;
  const runningPnl = closed.map(t => {
    running += t.pnl || 0;
    return { name: t.symbol || "–", cumulative: running };
  });

  // Strategy breakdown (pie)
  const strategyMap = {};
  closed.forEach(t => {
    const s = t.strategy || "Other";
    strategyMap[s] = (strategyMap[s] || 0) + 1;
  });
  const strategyData = Object.entries(strategyMap).map(([name, value]) => ({ name, value }));

  // W/L Pie
  const wlData = [
    { name: "Winners", value: winners.length },
    { name: "Losers", value: losers.length },
  ];

  const tickStyle = { fontSize: 10, fill: "hsl(215,20%,55%)" };
  const gridStyle = { stroke: "hsl(222,30%,16%)" };

  if (loading) return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" subtitle="Performance metrics and portfolio insights" />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" subtitle="Performance metrics and portfolio insights" />
      <div className="flex-1 flex items-center justify-center text-sm text-destructive">Failed to load analytics: {error}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" subtitle="Performance metrics and portfolio insights" />

      <div className="p-6 space-y-5 overflow-y-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total P&L", val: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? "text-accent" : "text-destructive", icon: Target },
            { label: "Win Rate", val: `${winRate}%`, color: "text-primary", icon: TrendingUp },
            { label: "Profit Factor", val: profitFactor, color: "text-foreground", icon: BarChart2 },
            { label: "Avg Win vs Loss", val: `$${avgWin.toFixed(0)} / $${avgLoss.toFixed(0)}`, color: "text-foreground", icon: TrendingDown },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
                <k.icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className={cn("text-xl font-mono font-bold", k.color)}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Running P&L */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Cumulative P&L</div>
            {runningPnl.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">No closed trades yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={runningPnl}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142,72%,50%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(142,72%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                  <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative" stroke="hsl(142,72%,50%)" strokeWidth={2} fill="url(#pnlGrad)" name="Cumulative P&L" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* W/L Pie */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Win / Loss Ratio</div>
            {closed.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">No closed trades yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={wlData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    <Cell fill="hsl(142,72%,50%)" />
                    <Cell fill="hsl(0,72%,55%)" />
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(222,30%,16%)", borderRadius: 6, fontSize: 11 }} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215,20%,55%)", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* P&L by Trade */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">P&L by Trade (Last 20)</div>
            {pnlByTrade.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">No closed trades yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pnlByTrade}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                  <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pnl" name="P&L">
                    {pnlByTrade.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Strategy Pie */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Strategy Breakdown</div>
            {strategyData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={strategyData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value">
                    {strategyData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(222,30%,16%)", borderRadius: 6, fontSize: 11 }} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215,20%,55%)", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}