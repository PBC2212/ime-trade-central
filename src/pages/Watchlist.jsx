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
import { Plus, Trash2, Edit2, Eye, Search, Star, TrendingUp, TrendingDown, Loader2, Bell } from "lucide-react";
import TradingViewChart from "@/components/TradingViewChart";
import { toast } from "@/components/ui/use-toast";

const EMPTY = {
  symbol: "", watchlist_name: "Default", notes: "", alert_price: "", current_price: "", entry_price: "", direction: "neutral", sector: "", tags: []
};

const directionColor = { long: "text-accent", short: "text-destructive", neutral: "text-muted-foreground" };
const directionBg = {
  long: "bg-accent/10 text-accent border-accent/30",
  short: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-secondary text-muted-foreground border-border",
};

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeList, setActiveList] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities.WatchlistItem.list("-created_date", 100)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const lists = ["All", ...new Set(items.map(i => i.watchlist_name || "Default"))];

  const filtered = items.filter(i => {
    const matchSearch = !search || i.symbol?.toUpperCase().includes(search.toUpperCase());
    const matchList = activeList === "All" || (i.watchlist_name || "Default") === activeList;
    return matchSearch && matchList;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({ ...EMPTY, ...item });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      alert_price: parseFloat(form.alert_price) || undefined,
      current_price: parseFloat(form.current_price) || undefined,
      entry_price: parseFloat(form.entry_price) || undefined,
    };
    try {
      if (editTarget) {
        await base44.entities.WatchlistItem.update(editTarget.id, payload);
      } else {
        await base44.entities.WatchlistItem.create(payload);
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
      await base44.entities.WatchlistItem.delete(id);
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Watchlist" subtitle="Track symbols and monitor positions">
        <Button size="sm" className="text-xs gap-1.5" onClick={openCreate}>
          <Plus className="w-3 h-3" /> Add Symbol
        </Button>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
          {/* List tabs */}
          <div className="p-3 border-b border-border">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search symbol..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary border-border"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {lists.map(l => (
                <button
                  key={l}
                  onClick={() => setActiveList(l)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded border transition-colors",
                    activeList === l
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Eye className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No symbols. Add one to start tracking.</p>
              </div>
            ) : (
              filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={cn(
                    "p-3 border-b border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors",
                    selected?.id === item.id && "bg-secondary border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-foreground">{item.symbol}</span>
                      <Badge className={cn("text-[9px] px-1 border", directionBg[item.direction || "neutral"])}>
                        {(item.direction || "neutral").toUpperCase()}
                      </Badge>
                    </div>
                    {item.current_price && (
                      <span className="text-xs font-mono text-muted-foreground">${item.current_price}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{item.watchlist_name || "Default"}</span>
                    {item.sector && <span className="text-[10px] text-muted-foreground">• {item.sector}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-8">
              <Star className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a symbol to view details</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-mono font-bold text-foreground">{selected.symbol}</span>
                    <Badge className={cn("border", directionBg[selected.direction || "neutral"])}>
                      {selected.direction === "long" && <TrendingUp className="w-3 h-3 mr-1" />}
                      {selected.direction === "short" && <TrendingDown className="w-3 h-3 mr-1" />}
                      {(selected.direction || "neutral").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.watchlist_name || "Default"} {selected.sector && `• ${selected.sector}`}
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

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Current Price", val: selected.current_price ? `$${selected.current_price}` : "–" },
                  { label: "Entry Price", val: selected.entry_price ? `$${selected.entry_price}` : "–" },
                  { label: "Alert Price", val: selected.alert_price ? `$${selected.alert_price}` : "–" },
                ].map(item => (
                  <div key={item.label} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-lg font-mono font-bold text-foreground">{item.val}</div>
                  </div>
                ))}
              </div>

              {/* TradingView Chart */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price Chart</div>
                <TradingViewChart symbol={selected.symbol} height={420} interval="D" />
              </div>

              {selected.alert_price && (
                <div className="flex items-center gap-2 p-3 rounded bg-amber-500/10 border border-amber-500/30">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs text-amber-400">Alert set at ${selected.alert_price}</span>
                </div>
              )}

              {selected.notes && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">NOTES</div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {selected.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Symbol" : "Add to Watchlist"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Symbol *</Label>
              <Input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))} className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="AAPL" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Watchlist</Label>
              <Input value={form.watchlist_name} onChange={e => setForm(p => ({ ...p, watchlist_name: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border" placeholder="Default" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(p => ({ ...p, direction: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sector</Label>
              <Input value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border" placeholder="Technology" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Current Price</Label>
              <Input value={form.current_price} onChange={e => setForm(p => ({ ...p, current_price: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Entry Price</Label>
              <Input value={form.entry_price} onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Alert Price</Label>
              <Input value={form.alert_price} onChange={e => setForm(p => ({ ...p, alert_price: e.target.value }))} className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-xs mt-1 bg-secondary border-border h-20 resize-none" placeholder="Analysis notes..." />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.symbol}>
              {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}