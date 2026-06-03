import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── POSITION SIZER ───────────────────────────────────────────
    if (action === 'position_size') {
      const { entry, stop, risk_pct = 1.0, account_equity = 100000 } = body;
      if (!entry || !stop) return Response.json({ error: 'entry and stop required' }, { status: 400 });
      const riskPerShare = Math.abs(entry - stop);
      if (riskPerShare === 0) return Response.json({ error: 'Entry and stop cannot be equal' }, { status: 400 });
      const dollarRisk = (account_equity * risk_pct) / 100;
      const shares = Math.floor(dollarRisk / riskPerShare);
      const exposure = shares * entry;
      const pctPortfolio = (exposure / account_equity) * 100;
      // Kelly criterion (simplified): assume 55% win rate, 2:1 R/R
      const kellyPct = (0.55 - (0.45 / 2)) * 100;
      const halfKellyShares = Math.floor(account_equity * (kellyPct / 200) / entry);
      return Response.json({
        shares, dollar_risk: +dollarRisk.toFixed(2),
        dollar_exposure: +exposure.toFixed(2), pct_portfolio: +pctPortfolio.toFixed(1),
        risk_per_share: +riskPerShare.toFixed(2),
        kelly_shares: halfKellyShares,
        warning: pctPortfolio > 10 ? `⚠️ Position is ${pctPortfolio.toFixed(1)}% of portfolio — exceeds 10% limit` : null,
        recommendation: pctPortfolio > 15 ? 'Reduce size — high concentration risk' : pctPortfolio > 10 ? 'Borderline — consider reducing' : 'Within limits',
      });
    }

    // ── PERFORMANCE METRICS ──────────────────────────────────────
    if (action === 'performance_metrics') {
      const { trades = [] } = body;
      const closed = trades.filter(t => t.status === 'closed' && t.pnl != null);
      if (closed.length === 0) return Response.json({ metrics: null, message: 'No closed trades' });

      const wins   = closed.filter(t => t.pnl > 0);
      const losses = closed.filter(t => t.pnl <= 0);
      const winRate = (wins.length / closed.length) * 100;
      const avgWin  = wins.length > 0   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length     : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length) : 0;
      const grossProfit = wins.reduce((s,t)=>s+t.pnl,0);
      const grossLoss   = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
      const profitFactor= grossLoss>0 ? grossProfit/grossLoss : (grossProfit>0?999:0);
      const expectancy  = (winRate/100)*avgWin - ((100-winRate)/100)*avgLoss;
      const totalPnl    = closed.reduce((s,t)=>s+t.pnl,0);

      // Returns array for Sharpe/Sortino
      const pnlPcts = closed.map(t => t.pnl_percent ?? (t.pnl / (t.entry_price * (t.quantity||1)) * 100));
      const meanRet = pnlPcts.reduce((s,v)=>s+v,0) / pnlPcts.length;
      const std = Math.sqrt(pnlPcts.reduce((s,v)=>s+(v-meanRet)**2,0)/pnlPcts.length);
      const downside = pnlPcts.filter(r=>r<0);
      const downsideDev = downside.length>0 ? Math.sqrt(downside.reduce((s,v)=>s+v**2,0)/pnlPcts.length) : 0.001;
      const tradingPeriodFactor = Math.sqrt(252/Math.max(closed.length,1));
      const sharpe  = std>0 ? (meanRet/std)*tradingPeriodFactor : 0;
      const sortino = downsideDev>0 ? (meanRet/downsideDev)*tradingPeriodFactor : 0;

      // Equity curve & Max Drawdown
      let peak=0, maxDD=0, running=0;
      const equityCurve = closed.map(t => {
        running += t.pnl;
        if (running > peak) peak = running;
        const dd = peak > 0 ? ((peak-running)/peak)*100 : 0;
        if (dd > maxDD) maxDD = dd;
        return { pnl: running, date: t.exit_date||t.entry_date };
      });

      // Max consecutive losses
      let maxCL=0, curCL=0;
      for (const t of closed) {
        if (t.pnl<=0) { curCL++; if(curCL>maxCL) maxCL=curCL; } else curCL=0;
      }

      // Annualized return (rough)
      const dates = closed.map(t=>new Date(t.exit_date||t.entry_date)).filter(d=>!isNaN(d));
      const daysDiff = dates.length>=2 ? Math.max((Math.max(...dates)-Math.min(...dates))/86400000,1) : 365;
      const annRet = (totalPnl / Math.max(Math.abs(closed[0]?.entry_price * (closed[0]?.quantity||1)), 1000)) * (365/daysDiff) * 100;
      const calmar = maxDD>0 ? annRet/maxDD : 0;

      // Monthly returns
      const monthlyMap = {};
      for (const t of closed) {
        const dt = new Date(t.exit_date||t.entry_date);
        if (isNaN(dt)) continue;
        const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
        monthlyMap[key] = (monthlyMap[key]||0) + t.pnl;
      }

      // Hold time
      const holdTimes = closed.map(t => {
        if (!t.entry_date || !t.exit_date) return null;
        return Math.round((new Date(t.exit_date)-new Date(t.entry_date))/86400000);
      }).filter(x=>x!==null);
      const avgHold = holdTimes.length>0 ? holdTimes.reduce((s,v)=>s+v,0)/holdTimes.length : 0;

      return Response.json({
        total_trades: closed.length, winning_trades: wins.length, losing_trades: losses.length,
        win_rate: +winRate.toFixed(1), avg_win: +avgWin.toFixed(2), avg_loss: +avgLoss.toFixed(2),
        gross_profit: +grossProfit.toFixed(2), gross_loss: +grossLoss.toFixed(2),
        profit_factor: +Math.min(profitFactor,999).toFixed(2), expectancy: +expectancy.toFixed(2),
        total_pnl: +totalPnl.toFixed(2), sharpe_ratio: +sharpe.toFixed(2),
        sortino_ratio: +sortino.toFixed(2), calmar_ratio: +calmar.toFixed(2),
        max_drawdown_pct: +maxDD.toFixed(1), max_consecutive_losses: maxCL,
        largest_loss: losses.length>0 ? +Math.min(...losses.map(t=>t.pnl)).toFixed(2) : 0,
        equity_curve: equityCurve, monthly_returns: monthlyMap,
        avg_hold_days: +avgHold.toFixed(1),
      });
    }

    // ── PORTFOLIO RISK ────────────────────────────────────────────
    if (action === 'portfolio_risk') {
      const { positions=[], account_equity=100000, trades=[] } = body;
      const posRisks = positions.map(p => {
        const mktVal = Math.abs(parseFloat(p.market_value||0));
        return {
          symbol: p.symbol, market_value: mktVal,
          unrealized_pl: parseFloat(p.unrealized_pl||0),
          pct_portfolio: +(mktVal/account_equity*100).toFixed(1),
          risk_flag: mktVal/account_equity>0.1?'red':mktVal/account_equity>0.07?'amber':'green',
          side: parseFloat(p.qty||0) >= 0 ? 'long' : 'short',
        };
      });

      const totalExposure = posRisks.reduce((s,p)=>s+p.market_value,0);
      const portfolioHeat = (totalExposure/account_equity)*100;

      // Drawdown from journal
      const closedTrades = trades.filter(t=>t.status==='closed' && t.pnl!=null);
      let peak=account_equity, running=account_equity, maxDD=0;
      for (const t of closedTrades) {
        running += t.pnl;
        if (running>peak) peak=running;
        const dd = ((peak-running)/peak)*100;
        if (dd>maxDD) maxDD=dd;
      }

      const ddStatus = maxDD>=15?'halt':maxDD>=10?'reduce_50':maxDD>=5?'reduce_25':'normal';
      const sizingMult = ddStatus==='halt'?0:ddStatus==='reduce_50'?0.5:ddStatus==='reduce_25'?0.75:1;

      return Response.json({
        account_equity, total_exposure: +totalExposure.toFixed(2),
        portfolio_heat_pct: +portfolioHeat.toFixed(1),
        positions: posRisks, max_drawdown_pct: +maxDD.toFixed(1),
        drawdown_status: ddStatus, sizing_multiplier: sizingMult,
        heat_flag: portfolioHeat>100?'red':portfolioHeat>80?'amber':'green',
        warnings: [
          portfolioHeat>100 && '⚠️ Portfolio fully deployed — no cash buffer',
          maxDD>=15 && '🛑 Drawdown ≥15% — HALT all new positions',
          maxDD>=10 && '⚠️ Drawdown ≥10% — Reduce position size 50%',
          maxDD>=5  && '⚡ Drawdown ≥5% — Reduce position size 25%',
        ].filter(Boolean),
      });
    }

    return Response.json({ error: 'Unknown action. Use: position_size | performance_metrics | portfolio_risk' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});