import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import BacktestConfig from "@/components/backtest/BacktestConfig";
import BacktestResults from "@/components/backtest/BacktestResults";
import { History, Trash2, AlertCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Backtest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    base44.entities.Backtest.list("-created_date", 10)
      .then(records => setHistory(records))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRun = async (config) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("backtestEngine", config);
      const data = res.data;
      if (data?.error) {
        setError(data.error);
        toast({ title: "Backtest failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.result) {
        setResult(data.result);
        toast({
          title: "Backtest complete",
          description: `${data.result.total_trades} trades · ${data.result.win_rate}% win rate · ${data.result.total_return_pct >= 0 ? "+" : ""}${data.result.total_return_pct}% return`,
        });
        loadHistory();
      } else {
        setError("No results returned from engine");
      }
    } catch (e) {
      setError(e.message);
      toast({ title: "Backtest failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Backtest.delete(id);
      setHistory(h => h.filter(r => r.id !== id));
      toast({ title: "Backtest deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const viewHistory = (record) => {
    setResult({
      total_trades: record.total_trades,
      winning_trades: record.winning_trades,
      win_rate: record.win_rate,
      total_return_pct: record.total_return_pct,
      max_drawdown_pct: record.max_drawdown_pct,
      profit_factor: record.profit_factor,
      sharpe_ratio: record.sharpe_ratio,
      avg_trade_pct: record.avg_trade_pct,
      final_equity: record.final_equity,
      equity_curve: record.equity_curve || [],
      trades: record.trades || [],
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Backtest Engine" subtitle="Validate strategies against historical data" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {/* Config */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border sticky top-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BacktestConfig onRun={handleRun} loading={loading} />
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {error && (
              <Card className="bg-card border-destructive/30 mb-4">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-destructive">Backtest Error</div>
                    <div className="text-xs text-muted-foreground mt-1">{error}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!result && !error && !loading && (
              <Card className="bg-card border-border h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-16">
                  <FlaskConical className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm text-muted-foreground">Configure and run a backtest to see results</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">Select symbols, strategy, and date range</div>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card className="bg-card border-border h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-16">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-sm text-muted-foreground">Running simulation...</div>
                </CardContent>
              </Card>
            )}

            {result && <BacktestResults result={result} />}
          </div>
        </div>

        {/* History */}
        <div className="max-w-7xl mx-auto mt-6">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent Backtests</h2>
          </div>

          {loadingHistory ? (
            <div className="text-xs text-muted-foreground py-4">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">No backtests yet</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {history.map(r => (
                <Card key={r.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => viewHistory(r)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {r.symbols?.join(", ")} · {r.start_date} → {r.end_date}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0 -mr-1"
                        onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs">
                      <span className={r.total_return_pct >= 0 ? "text-accent font-medium" : "text-destructive font-medium"}>
                        {r.total_return_pct >= 0 ? "+" : ""}{r.total_return_pct}%
                      </span>
                      <span className="text-muted-foreground">{r.win_rate}% win</span>
                      <span className="text-muted-foreground">{r.total_trades} trades</span>
                      <span className="text-muted-foreground">PF {r.profit_factor}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}