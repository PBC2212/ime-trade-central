import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  RefreshCw, TrendingUp, TrendingDown, DollarSign, Activity,
  Loader2, Plus, X, AlertTriangle, Wallet, BarChart2, Clock
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import BrokerConnection from "@/components/BrokerConnection";

const fmt = (n, dec = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtMoney = (n) => `$${fmt(n)}`;

export default function Broker() {
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderTab, setOrderTab] = useState("open");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    symbol: "", qty: "", side: "buy", type: "market",
    time_in_force: "day", limit_price: "", stop_price: ""
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [closingSymbol, setClosingSymbol] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const invoke = (action, params = {}) =>
    base44.functions.invoke("alpaca", { action, ...params }).then(r => r.data);

  const [connected, setConnected] = useState(false);
  const [notConnected, setNotConnected] = useState(false);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setNotConnected(false);
    const [acct, pos, ord] = await Promise.all([
      invoke("account").catch(e => {
        if (e?.error === "NOT_CONNECTED") { setNotConnected(true); return null; }
        throw e;
      }),
      invoke("positions").catch(() => ({ positions: [] })),
      invoke("orders", { status: orderTab, limit: 20 }).catch(() => ({ orders: [] })),
    ]);
    if (acct?.account) setAccount(acct.account);
    else if (acct === null) { setLoading(false); return; }
    setPositions(pos.positions || []);
    setOrders(ord.orders || []);
    setLoading(false);
  }, [orderTab, connected]);

  useEffect(() => { if (connected) load(); }, [load]);

  // Detect existing connection on mount
  useEffect(() => {
    base44.auth.me().then(me => {
      if (me?.data?.alpaca_api_key && me?.data?.alpaca_secret_key) setConnected(true);
    }).catch(() => {});
  }, []);

  const loadOrders = async (status) => {
    const ord = await invoke("orders", { status, limit: 20 });
    setOrders(ord.orders || []);
  };

  const handlePlaceOrder = async () => {
    if (!orderForm.symbol || !orderForm.qty) return;
    setPlacingOrder(true);
    const res = await invoke("place_order", orderForm);
    setPlacingOrder(false);
    if (res.order) {
      toast({ title: "Order placed", description: `${orderForm.side.toUpperCase()} ${orderForm.qty} ${orderForm.symbol}` });
      setShowOrderForm(false);
      setOrderForm({ symbol: "", qty: "", side: "buy", type: "market", time_in_force: "day", limit_price: "", stop_price: "" });
      load();
    } else {
      toast({ title: "Order failed", description: res.error, variant: "destructive" });
    }
  };

  const handleCancelOrder = async (orderId) => {
    setCancellingId(orderId);
    await invoke("cancel_order", { order_id: orderId });
    setCancellingId(null);
    toast({ title: "Order cancelled" });
    load();
  };

  const handleClosePosition = async (symbol) => {
    if (!window.confirm(`Close entire ${symbol} position?`)) return;
    setClosingSymbol(symbol);
    await invoke("close_position", { symbol });
    setClosingSymbol(null);
    toast({ title: `${symbol} position closed` });
    load();
  };

  const equity = parseFloat(account?.equity || 0);
  const cash = parseFloat(account?.cash || 0);
  const dayPnl = parseFloat(account?.equity || 0) - parseFloat(account?.last_equity || 0);
  const dayPnlPct = account?.last_equity ? (dayPnl / parseFloat(account.last_equity)) * 100 : 0;
  const buyingPower = parseFloat(account?.buying_power || 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Live Trading Desk" subtitle={`Alpaca ${account?.account_type === "live" ? "Live" : "Paper"} Account`}>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={load} disabled={loading || !connected}>
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
        </Button>
        <Button size="sm" className="text-xs gap-1.5" onClick={() => setShowOrderForm(true)} disabled={!connected}>
          <Plus className="w-3 h-3" /> Place Order
        </Button>
      </PageHeader>

      {/* Broker Connection */}
      <div className="px-6 pt-4">
        <BrokerConnection onConnected={() => { setConnected(true); load(); }} />
      </div>

      {!connected ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <p className="text-sm text-muted-foreground">Connect your Alpaca account above to view positions and place orders.</p>
        </div>
      ) : loading && !account ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Loading your account...</span>
        </div>
      ) : notConnected ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Unable to reach your Alpaca account. Check your credentials.</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Account Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Portfolio Equity", val: fmtMoney(equity), icon: Wallet, color: "text-primary" },
              { label: "Cash Available", val: fmtMoney(cash), icon: DollarSign, color: "text-foreground" },
              {
                label: "Day P&L",
                val: `${dayPnl >= 0 ? "+" : ""}${fmtMoney(dayPnl)} (${dayPnl >= 0 ? "+" : ""}${fmt(dayPnlPct)}%)`,
                icon: dayPnl >= 0 ? TrendingUp : TrendingDown,
                color: dayPnl >= 0 ? "text-accent" : "text-destructive"
              },
              { label: "Buying Power", val: fmtMoney(buyingPower), icon: BarChart2, color: "text-foreground" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <div className={cn("text-lg font-mono font-bold", s.color)}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Account status */}
          {account && (
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: account?.status, color: account?.status === "ACTIVE" ? "text-accent border-accent/30 bg-accent/10" : "text-amber-400 border-amber-400/30 bg-amber-400/10" },
                { label: account?.pattern_day_trader ? "PDT" : "Non-PDT", color: "text-muted-foreground border-border bg-secondary" },
                { label: account?.trading_blocked ? "Trading Blocked" : "Trading Enabled", color: account?.trading_blocked ? "text-destructive border-destructive/30 bg-destructive/10" : "text-accent border-accent/30 bg-accent/10" },
              ].map(b => (
                <Badge key={b.label} className={cn("text-xs border px-2 py-0.5", b.color)}>{b.label}</Badge>
              ))}
              <span className="text-xs text-muted-foreground">Account: {account?.id?.slice(0, 8)}...</span>
            </div>
          )}

          {/* Positions */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Open Positions</span>
                <Badge variant="outline" className="text-xs">{positions.length}</Badge>
              </div>
            </div>
            {positions.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">No open positions</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {["Symbol", "Side", "Qty", "Avg Entry", "Current Price", "Market Value", "P&L", "P&L %", ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => {
                      const pnl = parseFloat(pos.unrealized_pl || 0);
                      const pnlPct = parseFloat(pos.unrealized_plpc || 0) * 100;
                      const isLong = pos.side === "long";
                      return (
                        <tr key={pos.symbol} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-foreground">{pos.symbol}</td>
                          <td className="px-4 py-3">
                            <Badge className={cn("text-[9px] border", isLong ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
                              {pos.side?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono">{pos.qty}</td>
                          <td className="px-4 py-3 font-mono">{fmtMoney(pos.avg_entry_price)}</td>
                          <td className="px-4 py-3 font-mono">{fmtMoney(pos.current_price)}</td>
                          <td className="px-4 py-3 font-mono">{fmtMoney(pos.market_value)}</td>
                          <td className={cn("px-4 py-3 font-mono font-bold", pnl >= 0 ? "text-accent" : "text-destructive")}>
                            {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}
                          </td>
                          <td className={cn("px-4 py-3 font-mono", pnlPct >= 0 ? "text-accent" : "text-destructive")}>
                            {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                              onClick={() => handleClosePosition(pos.symbol)}
                              disabled={closingSymbol === pos.symbol}
                            >
                              {closingSymbol === pos.symbol ? <Loader2 className="w-3 h-3 animate-spin" /> : "Close"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Orders</span>
              </div>
              <div className="flex gap-1">
                {["open", "closed", "all"].map(s => (
                  <button key={s} onClick={() => { setOrderTab(s); loadOrders(s); }}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded border transition-colors",
                      orderTab === s ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border bg-secondary hover:text-foreground"
                    )}
                  >{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                ))}
              </div>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">No {orderTab} orders</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {["Symbol", "Side", "Type", "Qty", "Limit", "Status", "Submitted", ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(ord => (
                      <tr key={ord.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">{ord.symbol}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn("text-[9px] border", ord.side === "buy" ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
                            {ord.side?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{ord.type}</td>
                        <td className="px-4 py-3 font-mono">{ord.qty}</td>
                        <td className="px-4 py-3 font-mono">{ord.limit_price ? fmtMoney(ord.limit_price) : "–"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn("text-[9px]",
                            ord.status === "filled" ? "text-accent border-accent/30" :
                            ord.status === "canceled" ? "text-muted-foreground" :
                            "text-amber-400 border-amber-400/30"
                          )}>{ord.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ord.submitted_at ? new Date(ord.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–"}
                        </td>
                        <td className="px-4 py-3">
                          {ord.status === "new" || ord.status === "accepted" || ord.status === "pending_new" ? (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                              onClick={() => handleCancelOrder(ord.id)}
                              disabled={cancellingId === ord.id}
                            >
                              {cancellingId === ord.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Place Order Dialog */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Place Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Symbol *</Label>
                <Input value={orderForm.symbol} onChange={e => setOrderForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="AAPL" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Quantity *</Label>
                <Input value={orderForm.qty} onChange={e => setOrderForm(p => ({ ...p, qty: e.target.value }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="100" type="number" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Side</Label>
                <Select value={orderForm.side} onValueChange={v => setOrderForm(p => ({ ...p, side: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Order Type</Label>
                <Select value={orderForm.type} onValueChange={v => setOrderForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                    <SelectItem value="stop">Stop</SelectItem>
                    <SelectItem value="stop_limit">Stop Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(orderForm.type === "limit" || orderForm.type === "stop_limit") && (
                <div>
                  <Label className="text-xs text-muted-foreground">Limit Price</Label>
                  <Input value={orderForm.limit_price} onChange={e => setOrderForm(p => ({ ...p, limit_price: e.target.value }))}
                    className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="0.00" />
                </div>
              )}
              {(orderForm.type === "stop" || orderForm.type === "stop_limit") && (
                <div>
                  <Label className="text-xs text-muted-foreground">Stop Price</Label>
                  <Input value={orderForm.stop_price} onChange={e => setOrderForm(p => ({ ...p, stop_price: e.target.value }))}
                    className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="0.00" />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Time in Force</Label>
                <Select value={orderForm.time_in_force} onValueChange={v => setOrderForm(p => ({ ...p, time_in_force: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="gtc">GTC</SelectItem>
                    <SelectItem value="opg">OPG</SelectItem>
                    <SelectItem value="ioc">IOC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              ⚠️ This will place a real order on your Alpaca account. Paper trading is recommended for testing.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowOrderForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handlePlaceOrder} disabled={placingOrder || !orderForm.symbol || !orderForm.qty}
              className={orderForm.side === "sell" ? "bg-destructive hover:bg-destructive/90" : ""}>
              {placingOrder ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {orderForm.side === "buy" ? "Buy" : "Sell"} {orderForm.symbol}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}