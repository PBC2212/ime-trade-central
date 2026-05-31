import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import StatCard from "@/components/StatCard";
import ScoreBar from "@/components/ScoreBar";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Target, Activity, Shield, Zap,
  ArrowRight, Clock, BarChart2, Bot, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";

const MOCK_EQUITY = [
  { date: "Jan", value: 100000 },
  { date: "Feb", value: 103200 },
  { date: "Mar", value: 101800 },
  { date: "Apr", value: 107400 },
  { date: "May", value: 114200 },
  { date: "Jun", value: 111800 },
  { date: "Jul", value: 118900 },
  { date: "Aug", value: 122400 },
  { date: "Sep", value: 119100 },
  { date: "Oct", value: 127300 },
  { date: "Nov", value: 133100 },
  { date: "Dec", value: 141600 },
];

const MARKET_TICKERS = [
  { symbol: "SPY", price: "598.42", change: "+1.23", pct: "+0.21%", up: true },
  { symbol: "QQQ", price: "512.87", change: "+3.14", pct: "+0.62%", up: true },
  { symbol: "VIX", price: "14.28", change: "-0.82", pct: "-5.43%", up: false },
  { symbol: "GLD", price: "223.14", change: "+0.91", pct: "+0.41%", up: true },
  { symbol: "TLT", price: "92.44", change: "-0.33", pct: "-0.36%", up: false },
  { symbol: "DXY", price: "104.22", change: "+0.14", pct: "+0.13%", up: true },
];

const directionColor = (d) => d === "long" ? "text-accent" : "text-destructive";
const directionBg = (d) => d === "long" ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30";

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Opportunity.list("-created_date", 5),
      base44.entities.TradeJournal.list("-created_date", 10),
    ]).then(([ops, tj]) => {
      setOpportunities(ops);
      setTrades(tj);
    }).finally(() => setLoading(false));
  }, []);

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status === "closed");
  const totalPnl = closedTrades.reduce((a, t) => a + (t.pnl || 0), 0);
  const winRate = closedTrades.length
    ? Math.round((closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Command Center" subtitle="Institutional Trading Dashboard">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </PageHeader>

      {/* Market Ticker Bar */}
      <div className="border-b border-border bg-secondary/30 px-6 py-2 flex items-center gap-6 overflow-x-auto">
        {MARKET_TICKERS.map(t => (
          <div key={t.symbol} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono font-bold text-foreground">{t.symbol}</span>
            <span className="text-xs font-mono text-muted-foreground">{t.price}</span>
            <span className={cn("text-xs font-mono font-medium", t.up ? "text-accent" : "text-destructive")}>
              {t.pct}
            </span>
          </div>
        ))}
        <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          LIVE
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Portfolio Equity"
            value="$141,600"
            change={41.6}
            changeType="positive"
            sub="All-time"
            icon={TrendingUp}
            accent
          />
          <StatCard
            label="Realized P&L"
            value={`$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`}
            change={totalPnl}
            changeType={totalPnl >= 0 ? "positive" : "negative"}
            sub="Closed trades"
            icon={Target}
          />
          <StatCard
            label="Win Rate"
            value={`${winRate}%`}
            sub={`${closedTrades.length} closed trades`}
            icon={Activity}
          />
          <StatCard
            label="Open Positions"
            value={openTrades.length}
            sub={`${opportunities.filter(o => o.status === "active").length} active signals`}
            icon={Shield}
          />
        </div>

        {/* Equity Chart + Opportunities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Equity Curve */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Equity Curve</div>
                <div className="text-xs text-muted-foreground">12-month performance</div>
              </div>
              <Badge variant="outline" className="text-accent border-accent/30 text-xs">+41.6% YTD</Badge>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={MOCK_EQUITY}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(187,92%,50%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(187,92%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(222,30%,16%)", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: "hsl(210,40%,80%)" }}
                  formatter={v => [`$${v.toLocaleString()}`, "Equity"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(187,92%,50%)" strokeWidth={2} fill="url(#eqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Active Signals */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-foreground">Active Signals</div>
              <Link to="/scanner">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-primary">
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : opportunities.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <Zap className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No active signals. Run the scanner.</p>
                <Link to="/scanner">
                  <Button size="sm" className="text-xs mt-1">Open Scanner</Button>
                </Link>
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto">
                {opportunities.slice(0, 5).map(op => (
                  <div key={op.id} className="flex items-center gap-3 p-2 rounded bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-foreground">{op.symbol}</span>
                        <Badge className={cn("text-[9px] px-1 py-0 border", directionBg(op.direction))}>
                          {op.direction?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="mt-0.5">
                        <ScoreBar value={op.confidence_score} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Conf</div>
                      <div className="text-xs font-mono font-bold text-primary">{op.confidence_score}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Trades */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-foreground">Recent Trades</div>
              <Link to="/journal">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-primary">
                  Journal <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            {trades.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No trades logged yet.</p>
            ) : (
              <div className="space-y-1">
                {trades.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground w-14">{t.symbol}</span>
                      <Badge className={cn("text-[9px] px-1 border", directionBg(t.direction))}>
                        {t.direction?.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] px-1", t.status === "open" ? "text-primary border-primary/30" : "text-muted-foreground")}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className={cn("text-xs font-mono font-bold", (t.pnl || 0) >= 0 ? "text-accent" : "text-destructive")}>
                      {t.status === "closed" ? `${(t.pnl || 0) >= 0 ? "+" : ""}$${(t.pnl || 0).toFixed(0)}` : "–"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <div className="text-sm font-semibold text-foreground">AI Market Insights</div>
              </div>
              <Link to="/assistant">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-primary">
                  Chat <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {[
                { icon: TrendingUp, color: "text-accent", text: "SPY momentum building. 200-day MA providing strong support at $580.", time: "2m ago" },
                { icon: Shield, color: "text-amber-500", text: "VIX compression detected. Consider protective positions ahead of FOMC.", time: "15m ago" },
                { icon: Activity, color: "text-primary", text: "Unusual options flow in NVDA. $650 calls sweeping. Bullish conviction.", time: "1h ago" },
              ].map((insight, i) => (
                <div key={i} className="flex gap-2.5 p-2 rounded bg-secondary/40">
                  <insight.icon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", insight.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/90 leading-relaxed">{insight.text}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{insight.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}