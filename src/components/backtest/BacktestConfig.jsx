import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";

const STRATEGIES = [
  { value: "trend_continuation", label: "Trend Continuation", desc: "SMA20 > SMA50 with RSI pullback (40-65)" },
  { value: "breakout", label: "Breakout", desc: "Close above 20-day high" },
  { value: "mean_reversion", label: "Mean Reversion", desc: "RSI < 30 oversold bounce" },
];

export default function BacktestConfig({ onRun, loading }) {
  const [symbols, setSymbols] = useState("AAPL,MSFT,NVDA");
  const [strategy, setStrategy] = useState("trend_continuation");
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [capital, setCapital] = useState("100000");
  const [posSize, setPosSize] = useState("10");
  const [maxHold, setMaxHold] = useState("20");

  const handleSubmit = (e) => {
    e.preventDefault();
    const symArr = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!symArr.length) return;
    onRun({
      symbols: symArr,
      strategy,
      start_date: startDate,
      end_date: endDate,
      initial_capital: parseFloat(capital) || 100000,
      position_size_pct: parseFloat(posSize) || 10,
      max_hold_days: parseInt(maxHold) || 20,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="symbols">Symbols (comma-separated)</Label>
        <Input id="symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="AAPL, MSFT, NVDA" />
      </div>

      <div className="space-y-1.5">
        <Label>Strategy</Label>
        <Select value={strategy} onValueChange={setStrategy}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STRATEGIES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <div className="flex flex-col">
                  <span>{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start">Start Date</Label>
          <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End Date</Label>
          <Input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cap">Capital ($)</Label>
          <Input id="cap" type="number" value={capital} onChange={e => setCapital(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps">Pos Size (%)</Label>
          <Input id="ps" type="number" value={posSize} onChange={e => setPosSize(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mh">Max Hold (days)</Label>
          <Input id="mh" type="number" value={maxHold} onChange={e => setMaxHold(e.target.value)} />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Backtest...</> : <><Play className="w-4 h-4" /> Run Backtest</>}
      </Button>
    </form>
  );
}