import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// App-level credentials (fallback for market data + app-owner operations)
const APP_BASE_URL = Deno.env.get("ALPACA_BASE_URL") || "https://paper-api.alpaca.markets";
const APP_API_KEY = Deno.env.get("ALPACA_API_KEY");
const APP_SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY");

// Actions that require the user's own broker account (trading + account-specific)
const USER_ACCOUNT_ACTIONS = ["account", "positions", "orders", "place_order", "cancel_order", "close_position"];
// Actions that use shared app credentials (market data is universal)
const SHARED_ACTIONS = ["bars"];

async function alpacaFetch(creds, path, options = {}) {
  const base = (creds.base_url || APP_BASE_URL).replace(/\/v2\/?$/, "");
  const url = `${base}/v2${path}`;
  const headers = {
    "APCA-API-KEY-ID": creds.api_key,
    "APCA-API-SECRET-KEY": creds.secret_key,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Alpaca API error ${res.status} on ${url}: ${err}`);
  }
  return res.json();
}

function getUserCreds(user) {
  const apiKey = user.data?.alpaca_api_key || user.alpaca_api_key;
  const secretKey = user.data?.alpaca_secret_key || user.alpaca_secret_key;
  const baseUrl = user.data?.alpaca_base_url || user.alpaca_base_url || APP_BASE_URL;
  return { api_key: apiKey, secret_key: secretKey, base_url: baseUrl, has: !!(apiKey && secretKey) };
}

function getAppCreds() {
  return { api_key: APP_API_KEY, secret_key: APP_SECRET_KEY, base_url: APP_BASE_URL, has: !!(APP_API_KEY && APP_SECRET_KEY) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, ...params } = body;

    // ── Resolve credentials ──────────────────────────────────────
    let creds;
    if (USER_ACCOUNT_ACTIONS.includes(action)) {
      const userCreds = getUserCreds(user);
      if (!userCreds.has) {
        return Response.json({
          error: "NOT_CONNECTED",
          message: "Connect your Alpaca account in the Broker page to access live trading data.",
        }, { status: 403 });
      }
      creds = userCreds;
    } else {
      // Market data (bars) — use shared app credentials (universal)
      creds = getAppCreds();
      if (!creds.has) {
        return Response.json({ error: "Server not configured with Alpaca credentials" }, { status: 500 });
      }
    }

    // ── Account-specific actions (user's broker) ─────────────────
    if (action === "account") {
      const account = await alpacaFetch(creds, "/account");
      return Response.json({ account });
    }

    if (action === "positions") {
      const positions = await alpacaFetch(creds, "/positions");
      return Response.json({ positions });
    }

    if (action === "orders") {
      const status = params.status || "open";
      const limit = params.limit || 20;
      const orders = await alpacaFetch(creds, `/orders?status=${status}&limit=${limit}&direction=desc`);
      return Response.json({ orders });
    }

    if (action === "place_order") {
      const { symbol, qty, side, type, time_in_force, limit_price, stop_price } = params;
      const orderBody = { symbol, qty: String(qty), side, type, time_in_force: time_in_force || "day" };
      if (limit_price) orderBody.limit_price = String(limit_price);
      if (stop_price) orderBody.stop_price = String(stop_price);
      const order = await alpacaFetch(creds, "/orders", {
        method: "POST",
        body: JSON.stringify(orderBody),
      });
      return Response.json({ order });
    }

    if (action === "cancel_order") {
      const { order_id } = params;
      const base = (creds.base_url || APP_BASE_URL).replace(/\/v2\/?$/, "");
      const res = await fetch(`${base}/v2/orders/${order_id}`, {
        method: "DELETE",
        headers: {
          "APCA-API-KEY-ID": creds.api_key,
          "APCA-API-SECRET-KEY": creds.secret_key,
        },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Alpaca cancel failed (${res.status}): ${err || res.statusText}`);
      }
      return Response.json({ success: true });
    }

    if (action === "close_position") {
      const { symbol } = params;
      const base = (creds.base_url || APP_BASE_URL).replace(/\/v2\/?$/, "");
      const res = await fetch(`${base}/v2/positions/${symbol}`, {
        method: "DELETE",
        headers: {
          "APCA-API-KEY-ID": creds.api_key,
          "APCA-API-SECRET-KEY": creds.secret_key,
        },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Alpaca close position failed (${res.status}): ${err || res.statusText}`);
      }
      const data = await res.json();
      return Response.json({ order: data });
    }

    // ── Market data (shared app credentials — universal) ─────────
    if (action === "bars") {
      const { symbol, limit = 300 } = params;
      if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });
      const end = new Date();
      end.setHours(end.getHours() - 4); // avoid "recent SIP data" restriction on free tier
      const start = new Date();
      start.setDate(start.getDate() - 400);
      const fmt = (d) => d.toISOString();
      const dataUrl = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=1Day&limit=${limit}&start=${fmt(start)}&end=${fmt(end)}&feed=iex`;
      const dataRes = await fetch(dataUrl, {
        headers: {
          "APCA-API-KEY-ID": creds.api_key,
          "APCA-API-SECRET-KEY": creds.secret_key,
        },
      });
      if (!dataRes.ok) {
        const err = await dataRes.text();
        throw new Error(`Alpaca market data error ${dataRes.status}: ${err}`);
      }
      const data = await dataRes.json();
      const bars = (data.bars || []).map(b => ({
        t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, vw: b.vw,
      }));
      return Response.json({ symbol: symbol.toUpperCase(), bars, raw_count: (data.bars || []).length });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});