import { useEffect, useRef } from "react";

export default function TradingViewChart({ symbol, height = 400, interval = "D" }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    // Clean up previous widget
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (!containerRef.current || !window.TradingView) return;
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: interval,
        timezone: "America/New_York",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0d1117",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: containerRef.current.id,
        backgroundColor: "rgba(13, 17, 27, 1)",
        gridColor: "rgba(255, 255, 255, 0.04)",
        studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
        show_popup_button: true,
        popup_width: "1000",
        popup_height: "650",
      });
    };

    // If TradingView is already loaded, initialize directly
    if (window.TradingView) {
      script.onload();
    } else {
      document.head.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval]);

  const containerId = `tv_chart_${symbol?.replace(/[^a-zA-Z0-9]/g, "_")}`;

  return (
    <div
      id={containerId}
      ref={containerRef}
      style={{ height: `${height}px` }}
      className="w-full rounded-lg overflow-hidden border border-border"
    />
  );
}