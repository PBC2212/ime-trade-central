import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PortfolioRiskPanel from "@/components/risk/PortfolioRiskPanel";
import PositionSizer from "@/components/risk/PositionSizer";
import PerformanceMetrics from "@/components/risk/PerformanceMetrics";
import { ShieldAlert, Crosshair, BarChart2 } from "lucide-react";

export default function RiskDesk() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Risk Desk" subtitle="Portfolio risk management · position sizing · performance analytics" />
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="portfolio" className="text-xs gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Portfolio Risk
            </TabsTrigger>
            <TabsTrigger value="sizer" className="text-xs gap-1.5">
              <Crosshair className="w-3.5 h-3.5" /> Position Sizer
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" /> Performance
            </TabsTrigger>
          </TabsList>
          <TabsContent value="portfolio" className="mt-4"><PortfolioRiskPanel /></TabsContent>
          <TabsContent value="sizer" className="mt-4"><PositionSizer /></TabsContent>
          <TabsContent value="performance" className="mt-4"><PerformanceMetrics /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}