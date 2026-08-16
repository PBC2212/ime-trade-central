import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Loader2, Link2, Unlink, Key, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function BrokerConnection({ onConnected, compact }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    alpaca_api_key: "",
    alpaca_secret_key: "",
    alpaca_base_url: "https://paper-api.alpaca.markets",
  });
  const [saving, setSaving] = useState(false);

  const loadUser = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const connected = !!(user?.data?.alpaca_api_key && user?.data?.alpaca_secret_key);

  const handleConnect = async () => {
    if (!form.alpaca_api_key || !form.alpaca_secret_key) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({
        alpaca_api_key: form.alpaca_api_key.trim(),
        alpaca_secret_key: form.alpaca_secret_key.trim(),
        alpaca_base_url: form.alpaca_base_url,
      });
      await loadUser();
      setShowForm(false);
      setForm({ alpaca_api_key: "", alpaca_secret_key: "", alpaca_base_url: "https://paper-api.alpaca.markets" });
      toast({ title: "Alpaca account connected", description: "Your broker credentials are saved." });
      onConnected?.();
    } catch (err) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect your Alpaca account? You'll need to reconnect to trade.")) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({
        alpaca_api_key: "",
        alpaca_secret_key: "",
        alpaca_base_url: "https://paper-api.alpaca.markets",
      });
      await loadUser();
      toast({ title: "Alpaca account disconnected" });
      onConnected?.();
    } catch (err) {
      toast({ title: "Disconnect failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading connection…</div>;
  }

  // Not connected — show prominent connect prompt
  if (!connected) {
    return (
      <>
        <div className={cn(
          "flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5",
          compact && "py-2"
        )}>
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground">No broker connected</div>
            <div className="text-[10px] text-muted-foreground">Connect your Alpaca account to view positions and trade.</div>
          </div>
          <Button size="sm" className="text-xs h-7 gap-1.5" onClick={() => setShowForm(true)}>
            <Link2 className="w-3 h-3" /> Connect
          </Button>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> Connect Alpaca Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 rounded bg-primary/5 border border-primary/20 text-xs text-foreground/80">
                Enter your Alpaca API credentials. Get them from <span className="font-mono text-primary">app.alpaca.markets → API Keys</span>.
                Your keys are encrypted and stored on your user profile — only you can access your account.
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API Key ID</Label>
                <Input value={form.alpaca_api_key} onChange={e => setForm(p => ({ ...p, alpaca_api_key: e.target.value }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="PKXXXXXXXXXX" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API Secret Key</Label>
                <Input type="password" value={form.alpaca_secret_key} onChange={e => setForm(p => ({ ...p, alpaca_secret_key: e.target.value }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="••••••••••••••••" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Base URL</Label>
                <Input value={form.alpaca_base_url} onChange={e => setForm(p => ({ ...p, alpaca_base_url: e.target.value }))}
                  className="h-8 text-xs mt-1 bg-secondary border-border font-mono" placeholder="https://paper-api.alpaca.markets" />
              </div>
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                ⚠️ Paper trading URL is <span className="font-mono">https://paper-api.alpaca.markets</span>. Use live URL only when ready to trade real capital.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleConnect} disabled={saving || !form.alpaca_api_key || !form.alpaca_secret_key}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Connected — show status
  const isPaper = (user?.data?.alpaca_base_url || "").includes("paper");
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5",
      compact && "py-2"
    )}>
      <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground">Alpaca Connected</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {user?.data?.alpaca_api_key?.slice(0, 6)}…{user?.data?.alpaca_api_key?.slice(-4)} · {isPaper ? "Paper" : "Live"}
        </div>
      </div>
      <Badge className={cn("text-[9px] border", isPaper ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
        {isPaper ? "PAPER" : "LIVE"}
      </Badge>
      <Button variant="outline" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={handleDisconnect} disabled={saving}>
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
      </Button>
    </div>
  );
}