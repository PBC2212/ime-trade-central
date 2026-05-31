import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [opportunities, trades] = await Promise.all([
      base44.entities.Opportunity.list("-created_date", 10),
      base44.entities.TradeJournal.list("-created_date", 20),
    ]);

    const closedTrades = trades.filter(t => t.status === "closed");
    const openTrades = trades.filter(t => t.status === "open");
    const totalPnl = closedTrades.reduce((a, t) => a + (t.pnl || 0), 0);
    const winRate = closedTrades.length
      ? Math.round((closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100)
      : 0;

    const topSignals = opportunities
      .filter(o => o.status === "active")
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 3)
      .map(o => `${o.symbol} ${o.direction} (confidence: ${o.confidence_score}, strategy: ${o.strategy_type})`);

    const prompt = `You are an institutional trading AI assistant. Based on this portfolio data, generate exactly 3 concise market insights (1 sentence each).

Portfolio context:
- ${closedTrades.length} closed trades, win rate: ${winRate}%, total P&L: $${totalPnl.toFixed(0)}
- ${openTrades.length} open positions
- Top signals: ${topSignals.join("; ") || "none"}

Generate 3 actionable, professional insights. Focus on risk management, current signals, and portfolio health. Be specific and data-driven.

Return JSON: { "insights": [{"text": "...", "type": "bullish"|"warning"|"neutral"}] }`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          insights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                type: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({ insights: result.insights || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});