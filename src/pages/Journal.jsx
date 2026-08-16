import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Edit2, BookOpen, TrendingUp, TrendingDown, Zap, Loader2, Star } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EMPTY = {
  symbol: "", direction: "long", entry_price: "", exit_price: "", quantity: "",
  entry_date: "", exit_date: "", pnl: "", pnl_percent: "", strategy: "",
  setup_type: "", notes: "", ai_review: "", lessons_learned: "", rating: "", status: "open", tags: []
};

const directionBg = (d) => d === "long"
  ? "bg-accent/10 text-accent border-accent/30"
  : "bg-destructive/10 text-destructive border-destructive/30";

const statusBg = { open: "text-primary border-primary/30 bg-primary/10", closed: "text-muted-foreground border-border bg-secondary", cancelled: "text-destructive border-destructive/30 bg-destructive/10" };

export default function Journal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = () => {
    setLoading(true);
    base44.entities.TradeJournal.list("-created_date", 100)
      .then(setTrades)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = trades.filter(t => filterStatus === "all" || t.status === filterStatus);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (t) => { setEditTarget(t); setForm({ ...EMPTY, ...t }); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      entry_price: parseFloat(form.entry_price) || undefined,
      exit_price: parseFloat(form.exit_price) || undefined,
      quantity: parseFloat(form.quantity) || undefined,
      pnl: parseFloat(form.pnl) || undefined,
      pnl_percent: parseFloat(form.pnl_percent) || undefined,
      rating: parseFloat(form.rating) || undefined,
    };
    try {
      if (editTarget) {
        await base44.entities.TradeJournal.update(editTarget.id, payload);
      } else {
        await base44.entities.TradeJournal.create(payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.TradeJournal.delete(id);
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const generateAIReview = async () => {
    if (!form.symbol) return;
    setGeneratingReview(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide an institutional-grade trade review for this completed trade:
Symbol: ${form.symbol}, Direction: ${form.direction}
Entry: $${form.entry_price}, Exit: $${form.exit_price}, Qty: ${form.quantity}
P&L: $${form.pnl} (${form.pnl_percent}%)
Strategy: ${form.strategy}, Setup: ${form.setup_type}
Notes: ${form.notes}

Provide a 2-3 paragraph professional review covering: execution quality, setup validity, risk management, what worked or didn't, and actionable improvements.`,
      });
      setForm(f => ({ ...f, ai_review: res }));
    } catch (err) {
      toast({ title: "AI review failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingReview(false);
    }
  };

  const stats = {
    totalPnl: trades.filter(t => t.status === "closed").reduce((a, t) => a + (t.pnl || 0), 0),
    winRate: (() => {
      const closed = trades.filter(t => t.status === "closed");
      return closed.length ? Math.round((closed.filter(t => (t.pnl || 0) > 0).length / closed.length) * 100) : 0;
    })(),
    open: trades.filter(t => t.status === "open").length,
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Trade Journal" subtitle="Log, review, and learn from every trade">
        <Button size="sm" className="text-xs gap-1.5" onClick={openCreate}>
          <Plus className="w-3 h-3" /> Log Trade
        </Button>
      </PageHeader>

      {/* Summary Bar */}
      <div className="px-6 py-3 border-b border-border bg-secondary/20 flex items-center gap-8">
        {[
          { label: "Total P&L", val: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(0)}`, color: stats.totalPnl >= 0 ? "text-accent" : "text-destructive" },
          { label: "Win Rate", val: `${stats.winRate}%`, color: "text-foreground" },
          { label: "Open Trades", val: stats.open, color: "text-primary" },
          { label: "Total Logged", val: trades.length, color: "text-foreground" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
            <div className={cn("text-lg font-mono font-bold", s.color)}>{s.val}</div>
          </div>
        ))}
        <div className="ml-auto flex gap-2">
          {["all", "open", "closed"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "text-[10px] px-2 py-1 rounded border transition-colors",
                filterStatus === s ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border bg-secondary hover:text-foreground"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No trades logged yet.</p>
            </div>
          ) : (
            filtered.map(trade => (
              <div
                key={trade.id}
                onClick={() => setSelected(trade)}
                className={cn(
                  "p-3 border-b border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors",
                  selected?.id === trade.id && "bg-secondary border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-bold text-foreground">{trade.symbol}</span>
                    <Badge className={cn("text-[9px] px-1 border", directionBg(trade.direction))}>
                      {trade.direction?.toUpperCase()}
                    </Badge>
                  </div>
                  <span className={cn("text-xs font-mono font-bold", (trade.pnl || 0) >= 0 ? "text-accent" : "text-destructive")}>
                    {trade.status === "closed" ? `${(trade.pnl || 0) >= 0 ? "+" : ""}$${(trade.pnl || 0).toFixed(0)}` : "–"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{trade.entry_date || "–"}</span>
                    {trade.strategy && <><span>•</span><span>{trade.strategy}</span></>}
                  </div>
                  <Badge className={cn("text-[9px] px-1 border", statusBg[trade.status] || "")}>
                    {trade.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-8">
              <BookOpen className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a trade to view details</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-mono font-bold text-foreground">{selected.symbol}</span>
                    <Badge className={cn("border", directionBg(selected.direction))}>
                      {selected.direction === "long" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {selected.direction?.toUpperCase()}
                    </Badge>
                    <Badge className={cn("border", statusBg[selected.status] || "")}>{selected.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.strategy} {selected.setup_type && `• ${selected.setup_type}`}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(selected)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Entry", val: selected.entry_price ? `$${selected.entry_price}` : "–", color: "text-foreground" },
                  { label: "Exit", val: selected.exit_price ? `$${selected.exit_price}` : "–", color: "text-foreground" },
                  { label: "P&L", val: selected.pnl ? `${selected.pnl >= 0 ? "+" : ""}$${selected.pnl.toFixed(0)}` : "–", color: (selected.pnl || 0) >= 0 ? "text-accent" : "text-destructive" },
                  { label: "P&L %", val: selected.pnl_percent ? `${selected.pnl_percent >= 0 ? "+" : ""}${selected.pnl_percent.toFixed(2)}%` : "–", color: (selected.pnl_percent || 0) >= 0 ? "text-accent" : "text-destructive" },
                ].map(p => (
                  <div key={p.label} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground mb-1">{p.label}</div>
                    <div className={cn("text-base font-mono font-bold", p.color)}>{p.val}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { label: "Quantity", val: selected.quantity || "–" },
                  { label: "Entry Date", val: selected.entry_date || "–" },
                  { label: "Exit Date", val: selected.exit_date || "–" },
                ].map(p => (
                  <div key={p.label}>
                    <span className="text-muted-foreground">{p.label}: </span>
                    <span className="text-foreground font-mono">{p.val}</span>
                  </div>
                ))}
              </div>

              {selected.rating && (
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={cn("w-4 h-4", s <= selected.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground")} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">Trade rating</span>
                </div>
              )}

              {selected.notes && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">NOTES</div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {selected.ai_review && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI Trade Review</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{selected.ai_review}</p>
                </div>
              )}

              {selected.lessons_learned && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                  <div className="text-xs font-semibold text-accent mb-2">LESSONS LEARNED</div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{selected.lessons_learned}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Trade" : "Log New Trade"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Symbol *", key: "symbol", placeholder: "AAPL" },
              { label: "Entry Price", key: "entry_price", placeholder: "0.00" },
              { label: "Exit Price", key: "exit_price", placeholder: "0.00" },
              { label: "Quantity", key: "quantity", placeholder: "100" },
              { label: "P&L ($)", key: "pnl", placeholder: "0.00" },
              { label: "P&L (%)", key: "pnl_percent", placeholder: "0.00" },
              { label: "Entry Date", key: "entry_date", placeholder: "2024-01-01" },
              { label: "Exit Date", key: "exit_date", placeholder: "2024-01-10" },
              { label: "Rating (1-5)", key: "rating", placeholder: "3" },
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  value={form[f.key] || ""}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(p => ({ ...p, direction: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="long">Long</SelectItem><SelectItem value="short">Short</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Strategy", key: "strategy", placeholder: "Breakout" },
              { label: "Setup Type", key: "setup_type", placeholder: "Bull Flag" },
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border" placeholder={f.placeholder} />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-xs mt-1 bg-secondary border-border h-20 resize-none" placeholder="Trade rationale, market context..." />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">AI Review</Label>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-primary" onClick={generateAIReview} disabled={generatingReview}>
                {generatingReview ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                Generate
              </Button>
            </div>
            <Textarea value={form.ai_review || ""} onChange={e => setForm(p => ({ ...p, ai_review: e.target.value }))} className="text-xs mt-1 bg-secondary border-border h-20 resize-none" placeholder="AI-generated review..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Lessons Learned</Label>
            <Textarea value={form.lessons_learned || ""} onChange={e => setForm(p => ({ ...p, lessons_learned: e.target.value }))} className="text-xs mt-1 bg-secondary border-border h-16 resize-none" placeholder="Key takeaways..." />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.symbol}>
              {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Save Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}