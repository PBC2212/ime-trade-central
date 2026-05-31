import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SYMBOLS = ["SPY", "QQQ", "VIX", "GLD", "TLT", "DXY"];
const AV_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getQuote(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const q = data["Global Quote"];
  if (!q || !q["05. price"]) return null;
  return {
    symbol,
    price: parseFloat(q["05. price"]).toFixed(2),
    change: parseFloat(q["09. change"]).toFixed(2),
    pct: parseFloat(q["10. change percent"] || "0").toFixed(2),
    up: parseFloat(q["09. change"]) >= 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const symbols = (body.symbols && body.symbols.length) ? body.symbols : SYMBOLS;

    const tickers = [];
    // Fetch sequentially with 300ms delay to respect AV free tier (5 req/min)
    for (const symbol of symbols) {
      const quote = await getQuote(symbol);
      if (quote) tickers.push(quote);
      await sleep(300);
    }

    return Response.json({ tickers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});