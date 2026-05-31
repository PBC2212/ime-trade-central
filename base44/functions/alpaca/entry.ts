import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE_URL = Deno.env.get("ALPACA_BASE_URL") || "https://paper-api.alpaca.markets";
const API_KEY = Deno.env.get("ALPACA_API_KEY");
const SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY");

const headers = {
  "APCA-API-KEY-ID": API_KEY,
  "APCA-API-SECRET-KEY": SECRET_KEY,
  "Content-Type": "application/json",
};

async function alpacaFetch(path, options = {}) {
  // Strip any trailing /v2 from BASE_URL to avoid double-path
  const base = BASE_URL.replace(/\/v2\/?$/, "");
  const url = `${base}/v2${path}`;
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Alpaca API error ${res.status} on ${url}: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, ...params } = body;

    if (action === "account") {
      const account = await alpacaFetch("/account");
      return Response.json({ account });
    }

    if (action === "positions") {
      const positions = await alpacaFetch("/positions");
      return Response.json({ positions });
    }

    if (action === "orders") {
      const status = params.status || "open";
      const limit = params.limit || 20;
      const orders = await alpacaFetch(`/orders?status=${status}&limit=${limit}&direction=desc`);
      return Response.json({ orders });
    }

    if (action === "place_order") {
      const { symbol, qty, side, type, time_in_force, limit_price, stop_price } = params;
      const orderBody = { symbol, qty: String(qty), side, type, time_in_force: time_in_force || "day" };
      if (limit_price) orderBody.limit_price = String(limit_price);
      if (stop_price) orderBody.stop_price = String(stop_price);
      const order = await alpacaFetch("/orders", {
        method: "POST",
        body: JSON.stringify(orderBody),
      });
      return Response.json({ order });
    }

    if (action === "cancel_order") {
      const { order_id } = params;
      await fetch(`${BASE_URL}/v2/orders/${order_id}`, { method: "DELETE", headers });
      return Response.json({ success: true });
    }

    if (action === "close_position") {
      const { symbol } = params;
      const res = await fetch(`${BASE_URL}/v2/positions/${symbol}`, { method: "DELETE", headers });
      const data = await res.json();
      return Response.json({ order: data });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});