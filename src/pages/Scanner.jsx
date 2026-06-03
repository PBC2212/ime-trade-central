import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import ScoreBar from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Zap, Plus, Trash2, Edit2, Search, Filter, RefreshCw, TrendingUp, TrendingDown, Target, Loader2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import TradingViewChart from "@/components/TradingViewChart";

const directionBg = (d) => d === "long"
  ? "bg-accent/10 text-accent border-accent/30"
  : "bg-destructive/10 text-destructive border-destructive/30";

const statusColor = {
  active: "text-primary border-primary/30 bg-primary/10",
  triggered: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  stopped: "text-destructive border-destructive/30 bg-destructive/10",
  target_hit: "text-accent border-accent/30 bg-accent/10",
  expired: "text-muted-foreground border-border bg-secondary",
};

const EMPTY_FORM = {
  symbol: "", direction: "long", entry_price: "", stop_loss: "", target_price: "",
  risk_reward_ratio: "", confidence_score: "", risk_score: "", reward_score: "",
  sector: "", time_horizon: "swing", strategy_type: "momentum", ai_explanation: "", status: "active"
};

export default function Scanner() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDir, setFilterDir] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.Opportunity.list("-created_date", 50)
      .then(setOpportunities)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = opportunities.filter(o => {
    const matchSearch = !searchTerm || o.symbol?.toUpperCase().includes(searchTerm.toUpperCase());
    const matchDir = filterDir === "all" || o.direction === filterDir;
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchDir && matchStatus;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (op) => {
    setEditTarget(op);
    setForm({ ...EMPTY_FORM, ...op });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this signal? This cannot be undone.")) return;
    await base44.entities.Opportunity.delete(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      entry_price: parseFloat(form.entry_price) || undefined,
      stop_loss: parseFloat(form.stop_loss) || undefined,
      target_price: parseFloat(form.target_price) || undefined,
      risk_reward_ratio: parseFloat(form.risk_reward_ratio) || undefined,
      confidence_score: parseFloat(form.confidence_score) || 0,
      risk_score: parseFloat(form.risk_score) || undefined,
      reward_score: parseFloat(form.reward_score) || undefined,
    };
    if (editTarget) {
      const updated = await base44.entities.Opportunity.update(editTarget.id, payload);
      // Keep detail panel in sync
      if (selected?.id === editTarget.id) setSelected({ ...selected, ...payload });
    } else {
      await base44.entities.Opportunity.create(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const generateAIAnalysis = async () => {
    if (!form.symbol) return;
    setGeneratingAI(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Provide a brief institutional-grade trade analysis for ${form.symbol} ${form.direction} trade setup.
Direction: ${form.direction}, Strategy: ${form.strategy_type}, Horizon: ${form.time_horizon}
Entry: ${form.entry_price || "TBD"}, Stop: ${form.stop_loss || "TBD"}, Target: ${form.target_price || "TBD"}

Provide a 2-3 sentence professional analysis explaining the setup rationale, key technical levels, and risk factors.`,
    });
    setForm(f => ({ ...f, ai_explanation: res }));
    setGeneratingAI(false);
  };

  const runScan = async () => {
    setScanning(true);
    const symbols = ["AAPL", "NVDA", "MSFT", "TSLA", "META", "AMZN", "SPY", "QQQ", "AMD", "GOOGL", "GS", "JPM", "XOM", "UNH", "V"];
    const res = await base44.integrations.Core.InvokeLLM({
      add_context_from_internet: true,
      prompt: `You are a senior portfolio manager at a top-tier hedge fund. Today is ${new Date().toDateString()}. Your mandate: MAXIMUM WIN RATE through extreme selectivity and multi-confirmation filtering.

Universe: ${symbols.join(", ")}

═══ MANDATORY PRE-FILTERS (ALL must pass or REJECT the setup) ═══

✅ MARKET REGIME CHECK
- Is SPY above its 200-day MA? If NO → only accept short setups or reject longs entirely.
- Is the VIX elevated (>25)? If YES → tighten stops, reduce position size, prefer mean-reversion over momentum.
- What is the prevailing macro trend (bull/bear/sideways)? Only trade WITH it.

✅ MULTI-TIMEFRAME ALIGNMENT (required for entry)
- Weekly trend must AGREE with daily trend direction.
- Daily setup must AGREE with 4H momentum direction.
- Minimum 2 of 3 timeframes (weekly/daily/4H) must confirm the trade direction.
- DO NOT enter counter-trend trades unless mean-reversion score is exceptional (>85).

✅ SECTOR CONFIRMATION
- The stock's sector ETF must be in an uptrend for longs (downtrend for shorts).
- Stock must outperform its sector ETF on 5-day AND 20-day basis for longs.
- Avoid longs in the 2 weakest-performing sectors of the past 20 days.

✅ ENTRY QUALITY GATE
- Only enter longs on pullbacks to support OR confirmed breakouts with volume > 1.5x average.
- Avoid chasing extended moves (price >5% above nearest support = skip).
- Prefer setups in volatility compression zones (tight Bollinger Bands, low ATR% vs 20-day avg).
- Skip ALL setups on major macro event days (FOMC, CPI, NFP).

✅ INSTITUTIONAL QUALITY GATE (score ≥75 required)
- Sufficient liquidity (ADV > 5M shares)
- Risk/reward ≥ 2:1 minimum
- Clear directional bias with defined technical catalyst
- Relative strength rank top-25% vs SPY over 20 days
- Volume confirmation on last 2-3 sessions
- Options flow confirming direction (net call buying for longs, net put buying for shorts)

═══ SCORING FRAMEWORK ═══
1. LIQUIDITY (0-100): ADV, relative volume, bid/ask quality
2. RELATIVE STRENGTH (0-100): vs SPY + sector, 5/20/60/252-day basis
3. MARKET STRUCTURE (0-100): trend quality, S/R levels, breakout validity
4. OPTIONS FLOW (0-100): unusual activity, OI changes, IV signals
5. VOLUME QUALITY (0-100): accumulation/distribution, dark pool, conviction
6. CATALYST STRENGTH (0-100): magnitude and timing of primary catalyst
7. RISK PROFILE (0-100): lower = safer — volatility, gap risk, event risk
8. ENTRY TIMING (0-100): pullback quality, compression, confirmation

═══ OUTPUT FORMAT ═══
Return only the TOP 3 highest-conviction setups that pass ALL pre-filters. If fewer than 3 pass, return only those that qualify. Quality over quantity.

For each setup return:
- symbol, direction (long/short), sector
- strategy_type (momentum/breakout/mean_reversion/trend_continuation/volume_anomaly)
- time_horizon (intraday/swing/position)
- confidence_score (0-100)
- institutional_quality_score (0-100) — must be ≥75
- risk_score (0-100) — risk level, lower is safer
- reward_score (0-100)
- liquidity_score (0-100)
- relative_strength_score (0-100)
- entry_price (realistic pullback/breakout price, NOT current extended price)
- stop_loss (ATR-based technical level, tight but logical)
- target_price (Target 1 — first key resistance/support, conservative)
- target_price_2 (Target 2 — extended move target)
- risk_reward_ratio (to Target 1, minimum 2.0)
- position_sizing ("X% portfolio risk, Y shares at $Z — scale in Z% at entry, Z% on confirmation")
- primary_catalyst (most important near-term catalyst with expected timing)
- institutional_thesis (4-5 sentences: macro context, technicals, fundamentals, options signal, risk factors)
- ai_explanation (2-3 sentences: concise setup summary for quick review)

Return JSON with array "setups". Rank by institutional_quality_score descending. REJECT any setup below 75.`,
      response_json_schema: {
        type: "object",
        properties: {
          setups: {
            type: "array",
            items: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                direction: { type: "string" },
                sector: { type: "string" },
                strategy_type: { type: "string" },
                time_horizon: { type: "string" },
                confidence_score: { type: "number" },
                institutional_quality_score: { type: "number" },
                risk_score: { type: "number" },
                reward_score: { type: "number" },
                liquidity_score: { type: "number" },
                relative_strength_score: { type: "number" },
                entry_price: { type: "number" },
                stop_loss: { type: "number" },
                target_price: { type: "number" },
                target_price_2: { type: "number" },
                risk_reward_ratio: { type: "number" },
                position_sizing: { type: "string" },
                primary_catalyst: { type: "string" },
                institutional_thesis: { type: "string" },
                ai_explanation: { type: "string" }
              }
            }
          }
        }
      }
    });
    // Sort by institutional quality score descending
    const sorted = (res.setups || []).sort((a, b) => (b.institutional_quality_score || 0) - (a.institutional_quality_score || 0));
    for (const setup of sorted) {
      await base44.entities.Opportunity.create({ ...setup, status: "active" });
    }
    setScanning(false);
    load();
    toast({ title: `${sorted.length} institutional signals generated`, description: "AI scan complete — ranked by institutional quality." });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Opportunity Scanner" subtitle="AI-powered trade signal detection">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={openCreate}>
          <Plus className="w-3 h-3" /> Add Signal
        </Button>
        <Button size="sm" className="text-xs gap-1.5" onClick={runScan} disabled={scanning}>
          {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {scanning ? "Scanning..." : "AI Scan"}
        </Button>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* List Panel */}
        <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
          {/* Filters */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search symbol..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary border-border"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterDir} onValueChange={setFilterDir}>
                <SelectTrigger className="h-7 text-xs flex-1 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-7 text-xs flex-1 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="triggered">Triggered</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="target_hit">Target Hit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Signal List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No signals found. Run an AI scan.</p>
              </div>
            ) : (
              filtered.map(op => (
                <div
                  key={op.id}
                  onClick={() => setSelected(op)}
                  className={cn(
                    "p-3 border-b border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors",
                    selected?.id === op.id && "bg-secondary border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-mono font-bold text-foreground">{op.symbol}</span>
                      <Badge className={cn("text-[9px] px-1 border", directionBg(op.direction))}>
                        {op.direction?.toUpperCase()}
                      </Badge>
                    </div>
                    <Badge className={cn("text-[9px] px-1 border", statusColor[op.status] || "")}>
                      {op.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Inst. Quality</span>
                      <span className="font-mono text-primary">{op.institutional_quality_score ?? op.confidence_score ?? "–"}</span>
                    </div>
                    <ScoreBar value={op.institutional_quality_score || op.confidence_score} size="sm" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{op.strategy_type?.replace(/_/g, " ")}</span>
                      <span className="text-primary font-mono">{op.time_horizon}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <Target className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a signal to view analysis</p>
              <p className="text-xs text-muted-foreground/60">Or run an AI scan to generate new opportunities</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-mono font-bold text-foreground">{selected.symbol}</span>
                    <Badge className={cn("border", directionBg(selected.direction))}>
                      {selected.direction === "long"
                        ? <TrendingUp className="w-3 h-3 mr-1" />
                        : <TrendingDown className="w-3 h-3 mr-1" />}
                      {selected.direction?.toUpperCase()}
                    </Badge>
                    <Badge className={cn("border", statusColor[selected.status] || "")}>
                      {selected.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{selected.strategy_type?.replace(/_/g, " ")}</span>
                    <span>•</span>
                    <span>{selected.time_horizon}</span>
                    {selected.sector && <><span>•</span><span>{selected.sector}</span></>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(selected)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Score Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Confidence", val: selected.confidence_score, type: "confidence" },
                  { label: "Inst. Quality", val: selected.institutional_quality_score, type: "confidence" },
                  { label: "Risk", val: selected.risk_score, type: "risk" },
                  { label: "Reward", val: selected.reward_score, type: "confidence" },
                  { label: "Liquidity", val: selected.liquidity_score, type: "confidence" },
                  { label: "Rel. Strength", val: selected.relative_strength_score, type: "confidence" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground mb-1.5">{s.label}</div>
                    <div className="text-lg font-mono font-bold text-foreground mb-1">{s.val ?? "–"}</div>
                    <ScoreBar value={s.val || 0} type={s.type} size="sm" showLabel={false} />
                  </div>
                ))}
              </div>

              {/* Price Levels */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Price Levels</div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Entry", val: selected.entry_price, color: "text-foreground" },
                    { label: "Stop Loss", val: selected.stop_loss, color: "text-destructive" },
                    { label: "Target 1", val: selected.target_price, color: "text-accent" },
                    { label: "Target 2", val: selected.target_price_2, color: "text-accent/70" },
                    { label: "R:R Ratio", val: selected.risk_reward_ratio, color: "text-primary" },
                  ].map(p => (
                    <div key={p.label}>
                      <div className="text-[10px] text-muted-foreground mb-1">{p.label}</div>
                      <div className={cn("text-sm font-mono font-bold", p.color)}>
                        {p.val ? (p.label === "R:R Ratio" ? `1:${p.val.toFixed(2)}` : `$${p.val.toFixed(2)}`) : "–"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catalyst & Position Sizing */}
              {(selected.primary_catalyst || selected.position_sizing) && (
                <div className="grid grid-cols-2 gap-3">
                  {selected.primary_catalyst && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                      <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">Primary Catalyst</div>
                      <p className="text-xs text-foreground/90">{selected.primary_catalyst}</p>
                    </div>
                  )}
                  {selected.position_sizing && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5">Position Sizing</div>
                      <p className="text-xs text-foreground/90">{selected.position_sizing}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Institutional Thesis */}
              {selected.institutional_thesis && (
                <div className="bg-secondary border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Institutional Thesis</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{selected.institutional_thesis}</p>
                </div>
              )}

              {/* TradingView Chart */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price Chart</div>
                <TradingViewChart symbol={selected.symbol} height={420} interval="D" />
              </div>

              {/* AI Setup Summary */}
              {selected.ai_explanation && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Setup Summary</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{selected.ai_explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Signal" : "New Signal"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Symbol", key: "symbol", placeholder: "AAPL" },
              { label: "Sector", key: "sector", placeholder: "Technology" },
              { label: "Entry Price", key: "entry_price", placeholder: "0.00" },
              { label: "Stop Loss", key: "stop_loss", placeholder: "0.00" },
              { label: "Target Price", key: "target_price", placeholder: "0.00" },
              { label: "R:R Ratio", key: "risk_reward_ratio", placeholder: "2.5" },
              { label: "Confidence (0-100)", key: "confidence_score", placeholder: "75" },
              { label: "Risk Score (0-100)", key: "risk_score", placeholder: "30" },
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  value={form[f.key] || ""}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="h-8 text-xs mt-1 bg-secondary border-border"
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
              <Label className="text-xs text-muted-foreground">Strategy</Label>
              <Select value={form.strategy_type} onValueChange={v => setForm(p => ({ ...p, strategy_type: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["momentum", "breakout", "mean_reversion", "trend_continuation", "volume_anomaly"].map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">AI Analysis</Label>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-primary" onClick={generateAIAnalysis} disabled={generatingAI}>
                {generatingAI ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                Generate
              </Button>
            </div>
            <Textarea
              value={form.ai_explanation || ""}
              onChange={e => setForm(p => ({ ...p, ai_explanation: e.target.value }))}
              className="text-xs bg-secondary border-border h-20 resize-none"
              placeholder="AI analysis..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}