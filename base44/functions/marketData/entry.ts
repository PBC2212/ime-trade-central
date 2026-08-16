import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Institutional market proxy ETFs (all tradeable on Alpaca / IEX feed).
// Replaces non-tradeable indices (VIX, DXY) with ETF proxies for a live snapshot.
const SYMBOLS = ["SPY", "QQQ", "IWM", "GLD", "TLT", "UUP"];
const API_KEY = Deno.env.get("ALPACA_API_KEY");
const SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!API_KEY || !SECRET_KEY) {
      return Response.json({ error: "Alpaca credentials not configured" }, { status: 500 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const symbols = (body.symbols && body.symbols.length) ? body.symbols : SYMBOLS;

    // Single batched request — no per-symbol rate limits.
    const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols.join(",")}&feed=iex`;
    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": API_KEY,
        "APCA-API-SECRET-KEY": SECRET_KEY,
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Alpaca snapshots error ${res.status}: ${errText}` }, { status: 502 });
    }
    const data = await res.json();

    const tickers = [];
    for (const sym of symbols) {
      const snap = data[sym];
      if (!snap) continue;
      const price = snap.latestTrade?.p ?? snap.dailyBar?.c;
      const prevClose = snap.prevDailyBar?.c ?? snap.dailyBar?.o;
      if (price == null) continue;
      const change = prevClose ? price - prevClose : 0;
      const pct = prevClose ? (change / prevClose) * 100 : 0;
      tickers.push({
        symbol: sym,
        price: price.toFixed(2),
        change: change.toFixed(2),
        pct: pct.toFixed(2),
        up: change >= 0,
      });
    }

    return Response.json({ tickers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});