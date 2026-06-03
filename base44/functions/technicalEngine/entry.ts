import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bars, symbol } = body;

    if (!bars || !Array.isArray(bars) || bars.length < 30) {
      return Response.json({ error: 'Need at least 30 OHLCV bars' }, { status: 400 });
    }

    const closes = bars.map(b => b.c ?? b.close);
    const highs  = bars.map(b => b.h ?? b.high);
    const lows   = bars.map(b => b.l ?? b.low);
    const volumes= bars.map(b => b.v ?? b.volume);
    const n = closes.length;

    // ── SMA ──────────────────────────────────────────────────────
    const calcSMA = (arr, p) => {
      if (arr.length < p) return null;
      return arr.slice(-p).reduce((s, v) => s + v, 0) / p;
    };

    // ── EMA ──────────────────────────────────────────────────────
    const calcEMA = (arr, p) => {
      if (arr.length < p) return null;
      const k = 2 / (p + 1);
      let val = arr.slice(0, p).reduce((s, v) => s + v, 0) / p;
      for (let i = p; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
      return val;
    };

    // ── RSI (Wilder smoothing) ────────────────────────────────────
    const calcRSI = (arr, p = 14) => {
      if (arr.length < p + 1) return null;
      let gains = 0, losses = 0;
      for (let i = 1; i <= p; i++) {
        const d = arr[i] - arr[i - 1];
        if (d > 0) gains += d; else losses -= d;
      }
      let ag = gains / p, al = losses / p;
      for (let i = p + 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        ag = (ag * (p - 1) + Math.max(d, 0)) / p;
        al = (al * (p - 1) + Math.max(-d, 0)) / p;
      }
      if (al === 0) return 100;
      return 100 - 100 / (1 + ag / al);
    };

    // ── MACD (12/26/9) ────────────────────────────────────────────
    const calcMACD = (arr) => {
      if (arr.length < 35) return null;
      const k12 = 2/13, k26 = 2/27, k9 = 2/10;
      let e12 = arr.slice(0,12).reduce((s,v)=>s+v,0)/12;
      let e26 = arr.slice(0,26).reduce((s,v)=>s+v,0)/26;
      const macdLine = [];
      for (let i = 12; i < arr.length; i++) {
        e12 = arr[i]*k12 + e12*(1-k12);
        if (i >= 25) { e26 = arr[i]*k26 + e26*(1-k26); macdLine.push(e12-e26); }
      }
      if (macdLine.length < 9) return null;
      let sig = macdLine.slice(0,9).reduce((s,v)=>s+v,0)/9;
      for (let i = 9; i < macdLine.length; i++) sig = macdLine[i]*k9 + sig*(1-k9);
      const last = macdLine[macdLine.length-1];
      return { macd: last, signal: sig, histogram: last - sig };
    };

    // ── ATR (Wilder) ──────────────────────────────────────────────
    const calcATR = (p = 14) => {
      if (n < p+1) return null;
      const trs = [];
      for (let i = 1; i < n; i++) {
        trs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
      }
      let atr = trs.slice(0,p).reduce((s,v)=>s+v,0)/p;
      for (let i = p; i < trs.length; i++) atr = (atr*(p-1)+trs[i])/p;
      return atr;
    };

    // ── Bollinger Bands (20,2) ────────────────────────────────────
    const calcBB = (p=20, mult=2) => {
      if (n < p) return null;
      const slice = closes.slice(-p);
      const mid = slice.reduce((s,v)=>s+v,0)/p;
      const std = Math.sqrt(slice.reduce((s,v)=>s+(v-mid)**2,0)/p);
      return { upper: mid+mult*std, middle: mid, lower: mid-mult*std, std, bandwidth: (4*std)/mid };
    };

    // ── Stochastic (14,3,3) ───────────────────────────────────────
    const calcStoch = (kP=14, smooth=3) => {
      if (n < kP+smooth*2) return null;
      const rawK = [];
      for (let i = kP-1; i < n; i++) {
        const hh = Math.max(...highs.slice(i-kP+1, i+1));
        const ll = Math.min(...lows.slice(i-kP+1, i+1));
        rawK.push(hh===ll ? 50 : ((closes[i]-ll)/(hh-ll))*100);
      }
      const slowK = [];
      for (let i = smooth-1; i < rawK.length; i++)
        slowK.push(rawK.slice(i-smooth+1,i+1).reduce((s,v)=>s+v,0)/smooth);
      const dArr = [];
      for (let i = smooth-1; i < slowK.length; i++)
        dArr.push(slowK.slice(i-smooth+1,i+1).reduce((s,v)=>s+v,0)/smooth);
      if (!slowK.length || !dArr.length) return null;
      return { k: slowK[slowK.length-1], d: dArr[dArr.length-1] };
    };

    // ── OBV ───────────────────────────────────────────────────────
    const calcOBV = () => {
      let obv = 0;
      for (let i = 1; i < n; i++) {
        if (closes[i] > closes[i-1]) obv += volumes[i];
        else if (closes[i] < closes[i-1]) obv -= volumes[i];
      }
      return obv;
    };

    // ── Historical Volatility (annualized) ───────────────────────
    const calcHV = (p=20) => {
      if (n < p+1) return null;
      const rets = [];
      for (let i = n-p; i < n; i++) rets.push(Math.log(closes[i]/closes[i-1]));
      const mean = rets.reduce((s,v)=>s+v,0)/p;
      const variance = rets.reduce((s,v)=>s+(v-mean)**2,0)/p;
      return Math.sqrt(variance*252)*100;
    };

    // ── ROC ───────────────────────────────────────────────────────
    const calcROC = (p) => {
      if (n <= p) return null;
      return ((closes[n-1]-closes[n-1-p])/closes[n-1-p])*100;
    };

    // ── Relative Volume ───────────────────────────────────────────
    const calcRelVol = () => {
      if (n < 21) return 1;
      const avg = volumes.slice(-21,-1).reduce((s,v)=>s+v,0)/20;
      return avg > 0 ? volumes[n-1]/avg : 1;
    };

    // ── Support & Resistance ──────────────────────────────────────
    const calcSR = (lookback=60) => {
      const price = closes[n-1];
      const rh = highs.slice(-lookback);
      const rl = lows.slice(-lookback);
      const swingH=[], swingL=[];
      for (let i = 2; i < rh.length-2; i++) {
        if (rh[i]>rh[i-1] && rh[i]>rh[i-2] && rh[i]>rh[i+1] && rh[i]>rh[i+2]) swingH.push(rh[i]);
        if (rl[i]<rl[i-1] && rl[i]<rl[i-2] && rl[i]<rl[i+1] && rl[i]<rl[i+2]) swingL.push(rl[i]);
      }
      const res = swingH.filter(h=>h>price).sort((a,b)=>a-b).slice(0,3).map(p=>({ price:+p.toFixed(2), pct:+((p-price)/price*100).toFixed(2) }));
      const sup = swingL.filter(l=>l<price).sort((a,b)=>b-a).slice(0,3).map(p=>({ price:+p.toFixed(2), pct:+((price-p)/price*100).toFixed(2) }));
      return { resistance: res, support: sup };
    };

    // ── Market Structure ──────────────────────────────────────────
    const calcStructure = () => {
      const price = closes[n-1];
      const fhH = Math.max(...highs.slice(n-40, n-20));
      const shH = Math.max(...highs.slice(n-20));
      const fhL = Math.min(...lows.slice(n-40, n-20));
      const shL = Math.min(...lows.slice(n-20));
      const high52 = Math.max(...highs.slice(-Math.min(252,n)));
      const low52  = Math.min(...lows.slice(-Math.min(252,n)));
      return {
        uptrend:  shH>fhH && shL>fhL,
        downtrend:shH<fhH && shL<fhL,
        high_52w: +high52.toFixed(2),
        low_52w:  +low52.toFixed(2),
        pct_from_52w_high: +((high52-price)/high52*100).toFixed(2),
        pct_from_52w_low:  +((price-low52)/low52*100).toFixed(2),
        near_52w_high: (high52-price)/high52 < 0.05,
        near_52w_low:  (price-low52)/low52  < 0.05,
      };
    };

    // ── Volatility Compression ────────────────────────────────────
    const calcVolCompression = () => {
      if (n < 20) return false;
      const atrAt = (end) => {
        const trs = [];
        for (let i = end-13; i <= end; i++) {
          if (i <= 0) continue;
          trs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
        }
        return trs.reduce((s,v)=>s+v,0)/(trs.length||1);
      };
      const atrNow  = atrAt(n-1);
      const atr5ago = atrAt(n-6);
      return atrNow < atr5ago;
    };

    // ── Compute everything ────────────────────────────────────────
    const price  = closes[n-1];
    const sma20  = calcSMA(closes,20);
    const sma50  = calcSMA(closes,50);
    const sma200 = calcSMA(closes,200);
    const ema9   = calcEMA(closes,9);
    const ema21  = calcEMA(closes,21);
    const rsiVal = calcRSI(closes,14);
    const macd   = calcMACD(closes);
    const atr14  = calcATR(14);
    const bb     = calcBB(20,2);
    const stoch  = calcStoch(14,3);
    const obvVal = calcOBV();
    const hv20   = calcHV(20);
    const roc5   = calcROC(5);
    const roc20  = calcROC(20);
    const relVol = calcRelVol();
    const sr     = calcSR(60);
    const struct = calcStructure();
    const avgVol = n>=21 ? volumes.slice(-21,-1).reduce((s,v)=>s+v,0)/20 : volumes[n-1];
    const volComp= calcVolCompression();
    const breakout = price > Math.max(...highs.slice(-21,-1)) && relVol > 1.5;

    // Golden/Death cross
    const sma50p  = n>=51  ? calcSMA(closes.slice(0,-1),50)  : null;
    const sma200p = n>=201 ? calcSMA(closes.slice(0,-1),200) : null;
    const goldenCross = sma50p && sma200p && sma50p < sma200p && sma50 > sma200;
    const deathCross  = sma50p && sma200p && sma50p > sma200p && sma50 < sma200;

    // Confluence
    const bullish = [
      price > (sma20??0), price > (sma50??0), sma200 ? price>sma200 : false,
      rsiVal>50 && rsiVal<70, macd?.histogram>0, relVol>1.2,
      struct.uptrend, bb ? price>bb.middle : false,
      stoch?.k>50 && stoch?.k<80,
    ].filter(Boolean).length;

    const bearish = [
      price < (sma20??999999), price < (sma50??999999), sma200 ? price<sma200 : false,
      rsiVal<50 && rsiVal>30, macd?.histogram<0, relVol>1.2,
      struct.downtrend, bb ? price<bb.middle : false,
      stoch?.k<50 && stoch?.k>20,
    ].filter(Boolean).length;

    return Response.json({
      symbol: symbol||'UNKNOWN', price: +price.toFixed(2),
      // Trend
      sma20: sma20?+sma20.toFixed(2):null, sma50: sma50?+sma50.toFixed(2):null,
      sma200: sma200?+sma200.toFixed(2):null, ema9: ema9?+ema9.toFixed(2):null, ema21: ema21?+ema21.toFixed(2):null,
      above_sma20: price>(sma20??0), above_sma50: price>(sma50??0), above_sma200: sma200?price>sma200:null,
      golden_cross: !!goldenCross, death_cross: !!deathCross,
      // Momentum
      rsi: rsiVal?+rsiVal.toFixed(1):null,
      macd_line: macd?+macd.macd.toFixed(4):null, macd_signal: macd?+macd.signal.toFixed(4):null,
      macd_histogram: macd?+macd.histogram.toFixed(4):null, macd_bullish: !!(macd?.histogram>0),
      stoch_k: stoch?+stoch.k.toFixed(1):null, stoch_d: stoch?+stoch.d.toFixed(1):null,
      roc_5d: roc5?+roc5.toFixed(2):null, roc_20d: roc20?+roc20.toFixed(2):null,
      // Volatility
      atr14: atr14?+atr14.toFixed(4):null, atr_pct: atr14?+(atr14/price*100).toFixed(2):null,
      bb_upper: bb?+bb.upper.toFixed(2):null, bb_middle: bb?+bb.middle.toFixed(2):null,
      bb_lower: bb?+bb.lower.toFixed(2):null, bb_bandwidth: bb?+bb.bandwidth.toFixed(4):null,
      bb_position: bb?+((price-bb.lower)/(bb.upper-bb.lower)*100).toFixed(1):null,
      volatility_compression: volComp, historical_volatility: hv20?+hv20.toFixed(1):null,
      // Volume
      volume: volumes[n-1], avg_volume_20d: Math.round(avgVol), relative_volume: +relVol.toFixed(2),
      obv: Math.round(obvVal),
      volume_trend: volumes.slice(-5).reduce((s,v)=>s+v,0)/5 > volumes.slice(-10,-5).reduce((s,v)=>s+v,0)/5 ? 'expanding':'contracting',
      // Structure & S/R
      ...struct, trend_direction: struct.uptrend?'bullish':struct.downtrend?'bearish':'sideways',
      resistance_levels: sr.resistance, support_levels: sr.support,
      nearest_resistance: sr.resistance[0]||null, nearest_support: sr.support[0]||null,
      // Signals
      breakout_signal: breakout,
      // Confluence
      bullish_confluence: bullish, bearish_confluence: bearish,
      dominant_bias: bullish>bearish?'bullish':bearish>bullish?'bearish':'neutral',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});