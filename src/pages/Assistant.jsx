import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  Bot, Send, Plus, Loader2, MessageSquare, Trash2, Clock
} from "lucide-react";

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary/20 text-foreground border border-primary/30"
            : "bg-card border border-border text-foreground"
        )}>
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-foreground/90 [&_li]:text-foreground/90 [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded [&_strong]:text-foreground"
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    base44.agents.listConversations({ agent_name: "trading_assistant" })
      .then(convs => {
        setConversations(convs || []);
      })
      .finally(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    const unsub = base44.agents.subscribeToConversation(activeConv.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsub();
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (conv) => {
    const full = await base44.agents.getConversation(conv.id);
    setActiveConv(full);
    setMessages(full.messages || []);
  };

  const createNew = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "trading_assistant",
      metadata: { name: `Session ${new Date().toLocaleTimeString()}` }
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    let conv = activeConv;
    if (!conv) {
      conv = await base44.agents.createConversation({
        agent_name: "trading_assistant",
        metadata: { name: `Session ${new Date().toLocaleTimeString()}` }
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
    }
    const text = input.trim();
    setInput("");
    setSending(true);
    setMessages(prev => [...prev, { role: "user", content: text }]);
    await base44.agents.addMessage(conv, { role: "user", content: text });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SUGGESTED = [
    "What are the current high-confidence opportunities?",
    "Analyze my recent trading performance and win rate.",
    "What is my biggest risk exposure right now?",
    "Explain the momentum strategy setup.",
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Trading Assistant" subtitle="Institutional-grade market intelligence">
        <Button size="sm" className="text-xs gap-1.5" onClick={createNew}>
          <Plus className="w-3 h-3" /> New Session
        </Button>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Sessions sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sessions</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 px-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">No sessions yet. Start a conversation.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors",
                    activeConv?.id === conv.id && "bg-secondary border-l-2 border-l-primary"
                  )}
                >
                  <div className="text-xs font-medium text-foreground truncate">
                    {conv.metadata?.name || "Session"}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(conv.created_date).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!activeConv && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">AlphaDesk AI</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Institutional-grade trading intelligence. Ask me about market setups, risk management, portfolio analysis, or any trade idea.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTED.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(s); }}
                      className="text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <p className="text-xs text-foreground/90 leading-relaxed">{s}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card/50">
            <div className="flex gap-2 items-end">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about market conditions, trade setups, risk management..."
                className="flex-1 bg-secondary border-border text-sm h-10"
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                size="sm"
                className="h-10 px-4 gap-1.5"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              AI assistant — for informational purposes only. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}