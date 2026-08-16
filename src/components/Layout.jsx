import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Scan, BookOpen, Eye, BarChart2, Bot,
  ChevronLeft, ChevronRight, LogOut, TrendingUp, Briefcase, ShieldAlert, FlaskConical
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Scan, label: "Scanner", path: "/scanner" },
  { icon: Eye, label: "Watchlist", path: "/watchlist" },
  { icon: BookOpen, label: "Trade Journal", path: "/journal" },
  { icon: BarChart2, label: "Analytics", path: "/analytics" },
  { icon: Bot, label: "AI Assistant", path: "/assistant" },
  { icon: Briefcase, label: "Broker", path: "/broker" },
  { icon: ShieldAlert, label: "Risk Desk", path: "/risk-desk" },
  { icon: FlaskConical, label: "Backtest", path: "/backtest" },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-[hsl(222,47%,7%)] transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center h-14 border-b border-border px-3 gap-2",
          collapsed && "justify-center"
        )}>
          <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-xs font-bold text-foreground tracking-widest uppercase">AlphaDesk</div>
              <div className="text-[9px] text-muted-foreground tracking-widest uppercase">Institutional</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded text-sm transition-all duration-150 group",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  collapsed && "justify-center"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "")} />
                {!collapsed && <span className="font-medium">{item.label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border p-2 space-y-0.5">
          <button
            onClick={() => base44.auth.logout()}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full transition-all",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary w-full transition-all",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}