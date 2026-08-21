import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_API_KEY = Deno.env.get("ALPACA_API_KEY");
const APP_SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY");

// ── Fetch daily bars from Alpaca ─────────────────────────────
async function fetchBars(symbol: string, startDate: string, endDate: string) {
  const url = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=1Day&start=${startDate}&end=${endDate}&feed=iex&limit=1000`;
  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": APP_API_KEY!,
      "APCA-API-SECRET-KEY": APP_SECRET_KEY!,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Alpaca bars error ${res.status} for ${symbol}: ${err}`);
  }
  const data = await res.json();
  return (data.bars || []).map((b: any) => ({
    t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v,
  }));
}

// ── Indicator series ─────────────────────────────────────────
function smaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function atrSeries(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(highs.length).fill(null);
  if (highs.length < period + 1) return out;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period] = atr;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out[i + 1] = atr;
  }
  return out;
}

function rollingHigh(highs: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(highs.length).fill(null);
  for (let i = period; i < highs.length; i++) {
    let mx = -Infinity;
    for (let j = i - period; j < i; j++) if (highs[j] > mx) mx = highs[j];
    out[i] = mx;
  }
  return out;
}

// ── Signal detection ─────────────────────────────────────────
type Signal = 'long' | null;
function checkSignal(
  strategy: string, i: number,
  closes: number[], sma20: (number|null)[], sma50: (number|null)[],
  rsi: (number|null)[], atr: (number|null)[], rollHigh: (number|null)[]
): Signal {
  if (!sma20[i] || !sma50[i] || !rsi[i] || !atr[i]) return null;
  if (strategy === 'trend_continuation') {
    if (sma20[i]! > sma50[i]! && rsi[i]! > 40 && rsi[i]! < 65) return 'long';
  }
  if (strategy === 'breakout') {
    const prevHigh = rollHigh[i];
    if (prevHigh && closes[i] > prevHigh) return 'long';
  }
  if (strategy === 'mean_reversion') {
    if (rsi[i]! < 30) return 'long';
  }
  return null;
}

// ── Per-symbol simulation ────────────────────────────────────
interface SimTrade {
  symbol: string; direction: string;
  entry_date: string; entry_price: number;
  exit_date: string; exit_price: number;
  return_pct: number; hold_days: number;
  exit_reason: string; pnl: number;
}

function simulateSymbol(
  symbol: string, bars: any[],
  strategy: string, capital: number,
  posSizePct: number, maxHold: number
): SimTrade[] {
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const rsi = rsiSeries(closes, 14);
  const atr = atrSeries(highs, lows, closes, 14);
  const rollHigh = rollingHigh(highs, 20);

  const trades: SimTrade[] = [];
  let position: any = null;

  for (let i = 50; i < bars.length; i++) {
    // Check exit on open position
    if (position) {
      const bar = bars[i];
      let exit: { price: number; reason: string; date: string } | null = null;
      if (bar.l <= position.stop) {
        exit = { price: position.stop, reason: 'stop', date: bar.t };
      } else if (bar.h >= position.target) {
        exit = { price: position.target, reason: 'target', date: bar.t };
      } else if (i - position.entryBar >= maxHold) {
        exit = { price: bar.c, reason: 'timeout', date: bar.t };
      }
      if (exit) {
        const pnl = (exit.price - position.entryPrice) * position.shares;
        const returnPct = ((exit.price - position.entryPrice) / position.entryPrice) * 100;
        trades.push({
          symbol, direction: 'long',
          entry_date: position.entryDate, entry_price: +position.entryPrice.toFixed(2),
          exit_date: exit.date, exit_price: +exit.price.toFixed(2),
          return_pct: +returnPct.toFixed(2), hold_days: i - position.entryBar,
          exit_reason: exit.reason, pnl: +pnl.toFixed(2),
        });
        position = null;
      }
    }

    // Arm breakeven stop once trade moves +0.5 ATR in favor (applies on next bar)
    if (position && !position.breakevenArmed && bars[i].h >= position.entryPrice + 0.5 * position.atrVal) {
      position.stop = position.entryPrice;
      position.breakevenArmed = true;
    }

    // Check for new entry
    if (!position) {
      const signal = checkSignal(strategy, i, closes, sma20, sma50, rsi, atr, rollHigh);
      if (signal === 'long') {
        const entryPrice = bars[i].c;
        const atrVal = atr[i]!;
        // High-win-rate config: tight target, wide stop (inverted R/R)
        const stop = entryPrice - 2.0 * atrVal;
        const target = entryPrice + 1.0 * atrVal;
        const tradeEquity = capital * (posSizePct / 100);
        const shares = Math.floor(tradeEquity / entryPrice);
        if (shares > 0) {
          position = {
            symbol, entryBar: i, entryPrice, stop, target, shares,
            entryDate: bars[i].t, atrVal, breakevenArmed: false,
          };
        }
      }
    }
  }

  // Close remaining position at last bar
  if (position) {
    const lastBar = bars[bars.length - 1];
    const pnl = (lastBar.c - position.entryPrice) * position.shares;
    const returnPct = ((lastBar.c - position.entryPrice) / position.entryPrice) * 100;
    trades.push({
      symbol, direction: 'long',
      entry_date: position.entryDate, entry_price: +position.entryPrice.toFixed(2),
      exit_date: lastBar.t, exit_price: +lastBar.c.toFixed(2),
      return_pct: +returnPct.toFixed(2), hold_days: bars.length - 1 - position.entryBar,
      exit_reason: 'eod', pnl: +pnl.toFixed(2),
    });
  }

  return trades;
}

// ── Metrics ──────────────────────────────────────────────────
function computeMetrics(trades: SimTrade[], initialCapital: number) {
  if (!trades.length) {
    return {
      total_trades: 0, winning_trades: 0, win_rate: 0,
      total_return_pct: 0, max_drawdown_pct: 0, profit_factor: 0,
      sharpe_ratio: 0, avg_trade_pct: 0, final_equity: initialCapital,
      equity_curve: [{ date: new Date().toISOString().slice(0, 10), equity: initialCapital }],
    };
  }

  trades.sort((a, b) => new Date(a.exit_date) - new Date(b.exit_date));

  let equity = initialCapital;
  const equityCurve = [{ date: trades[0].entry_date, equity: initialCapital }];
  for (const t of trades) {
    equity += t.pnl;
    equityCurve.push({ date: t.exit_date, equity: +equity.toFixed(2) });
  }

  // Breakeven (pnl = 0) counts as a win — no capital was lost
  const wins = trades.filter(t => t.pnl >= 0);
  const losses = trades.filter(t => t.pnl < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const totalReturn = ((equity - initialCapital) / initialCapital) * 100;

  // Max drawdown
  let peak = equityCurve[0].equity;
  let maxDD = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = peak > 0 ? ((peak - pt.equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe (trade-based)
  const rets = trades.map(t => t.return_pct);
  const meanRet = rets.reduce((s, v) => s + v, 0) / rets.length;
  const variance = rets.reduce((s, v) => s + (v - meanRet) ** 2, 0) / rets.length;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (meanRet / std) * Math.sqrt(252 / 4) : 0; // approx annualized

  return {
    total_trades: trades.length,
    winning_trades: wins.length,
    win_rate: +((wins.length / trades.length) * 100).toFixed(1),
    total_return_pct: +totalReturn.toFixed(2),
    max_drawdown_pct: +maxDD.toFixed(2),
    profit_factor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 99 : 0,
    sharpe_ratio: +sharpe.toFixed(2),
    avg_trade_pct: +meanRet.toFixed(2),
    final_equity: +equity.toFixed(2),
    equity_curve: equityCurve,
  };
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!APP_API_KEY || !APP_SECRET_KEY) {
      return Response.json({ error: 'Server not configured with Alpaca credentials' }, { status: 500 });
    }

    const body = await req.json();
    const {
      symbols, strategy, start_date, end_date,
      initial_capital = 100000, position_size_pct = 10, max_hold_days = 20,
      save = true,
    } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return Response.json({ error: 'symbols array required' }, { status: 400 });
    }
    if (!strategy) return Response.json({ error: 'strategy required' }, { status: 400 });
    if (!start_date || !end_date) return Response.json({ error: 'start_date and end_date required' }, { status: 400 });

    // Fetch bars for all symbols in parallel (with warmup lookback)
    const warmupStart = new Date(start_date);
    warmupStart.setDate(warmupStart.getDate() - 120);
    const fetchStart = warmupStart.toISOString();

    const barsResults = await Promise.all(
      symbols.map(async (sym: string) => {
        try {
          const bars = await fetchBars(sym, fetchStart, end_date);
          return { symbol: sym.toUpperCase(), bars };
        } catch (e) {
          return { symbol: sym.toUpperCase(), bars: [], error: e.message };
        }
      })
    );

    const valid = barsResults.filter(r => r.bars.length >= 60);
    if (!valid.length) {
      return Response.json({
        error: 'Not enough historical data (need 60+ bars per symbol)',
        details: barsResults.map(r => ({ symbol: r.symbol, bars: r.bars.length, error: r.error })),
      }, { status: 400 });
    }

    // Run simulation per symbol
    const perSymbolCapital = initial_capital / valid.length;
    const allTrades: SimTrade[] = [];
    for (const { symbol, bars } of valid) {
      const t = simulateSymbol(symbol, bars, strategy, perSymbolCapital, position_size_pct, max_hold_days);
      allTrades.push(...t);
    }

    // Filter trades to the backtest date range
    const filteredTrades = allTrades.filter(t => new Date(t.exit_date) >= new Date(start_date));
    const filteredMetrics = computeMetrics(filteredTrades, initial_capital);

    const result = {
      ...filteredMetrics,
      trades: filteredTrades.sort((a, b) => new Date(a.exit_date) - new Date(b.exit_date)),
    };

    // Save to Backtest entity
    let saved = null;
    if (save) {
      const name = `${strategy} ${valid.map(v => v.symbol).join(',')} ${start_date}`;
      try {
        saved = await base44.entities.Backtest.create({
          name,
          strategy_type: strategy,
          symbols: valid.map(v => v.symbol),
          start_date, end_date,
          initial_capital, position_size_pct, max_hold_days,
          status: 'completed',
          ...filteredMetrics,
          trades: filteredTrades,
        });
      } catch (e) {
        // Non-fatal — return results even if save fails, but surface the failure
        return Response.json({ result, saved: null, save_error: e.message, symbols_fetched: valid.map(v => v.symbol) });
      }
    }

    return Response.json({ result, saved, symbols_fetched: valid.map(v => v.symbol) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});