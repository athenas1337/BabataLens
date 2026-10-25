"use client";

import React, { useState, useRef, useEffect } from "react";
import { History, Plus, Trash2, X } from "lucide-react";
import { BabataAvatar } from "../avatar/BabataAvatar";
import { BabataAvatarState } from "@/lib/agent/orchestrator";
import { apiFetch } from "@/lib/api/client";
import { renderMarkdown } from "@/lib/utils/format";

interface ToolCallTrace {
  tool: string;
  input: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallTrace[];
  sources?: { provider: string; timestamp: string }[];
}

interface ConversationRow {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Greetings, Operator. I am **Babata**, your autonomous cryptocurrency and blockchain intelligence analyst. I query live market feeds and on-chain data on demand — prices, wallet balances, transaction history, contract verification and holder concentration. Every figure I report comes from a named data provider, and I will say so when a source is unavailable rather than guess. Select a prompt or query any token, contract, or wallet.",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarState, setAvatarState] = useState<BabataAvatarState>("idle");
  const [activeSubLabel, setActiveSubLabel] = useState<string>("");
  const [currentStreamingText, setCurrentStreamingText] = useState("");
  const [currentToolTraces, setCurrentToolTraces] = useState<ToolCallTrace[]>([]);
  const [currentSources, setCurrentSources] = useState<{ provider: string; timestamp: string }[]>([]);
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  // Conversation id is persisted server-side; keeping it lets follow-up turns
  // reuse the same thread (and its history) instead of starting a new one.
  const [conversationId, setConversationId] = useState<string | null>(null);

  // ── Thread history (server-persisted via /api/conversations) ──────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await apiFetch("/api/conversations");
      const json = (await res.json()) as { conversations?: ConversationRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setConversations(json.conversations || []);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) void loadHistory();
  };

  const openThread = async (id: string) => {
    if (threadLoading || isLoading) return;
    setThreadLoading(true);
    setHistoryError(null);
    try {
      const res = await apiFetch(`/api/conversations/${id}`);
      const json = (await res.json()) as {
        conversation?: ConversationRow;
        messages?: { id: string; role: string; content: string; sources?: { provider: string; fetchedAt: string }[] }[];
        error?: string;
      };
      if (!res.ok || !json.messages) throw new Error(json.error || `HTTP ${res.status}`);
      // The stored thread replaces the in-memory one; tool traces were not
      // persisted, only text + sources.
      const restored: ChatMessage[] = json.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources?.map((s) => ({ provider: s.provider, timestamp: s.fetchedAt })),
        }));
      if (restored.length === 0) throw new Error("Thread has no restoreable messages");
      setConversationId(id);
      setMessages(restored);
      setHistoryOpen(false);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : "Failed to open thread");
    } finally {
      setThreadLoading(false);
    }
  };

  const deleteThread = async (id: string) => {
    try {
      const res = await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewChat();
    } catch {
      // Leave the list untouched on failure; the row simply stays.
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "Greetings, Operator. I am **Babata**, your autonomous cryptocurrency and blockchain intelligence analyst. I query live market feeds and on-chain data on demand — prices, wallet balances, transaction history, contract verification and holder concentration. Every figure I report comes from a named data provider, and I will say so when a source is unavailable rather than guess. Select a prompt or query any token, contract, or wallet.",
      },
    ]);
    setCurrentStreamingText("");
    setCurrentToolTraces([]);
    setCurrentSources([]);
    setHistoryOpen(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingText, currentToolTraces]);

  const quickPrompts = [
    "Analyze Bitcoin market structure & 24h volume",
    "Inspect Ethereum whale wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "Check Solana token liquidity & SOL market metrics",
    "Compare Ethereum gas and transaction confirmation trends",
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMessageId, role: "user", content: textToSend },
    ];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setAvatarState("thinking");
    setActiveSubLabel("Initializing neural pipeline...");
    setCurrentStreamingText("");
    setCurrentToolTraces([]);
    setCurrentSources([]);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          stream: true,
          conversationId: conversationId ?? undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error ${response.status}: Failed to establish stream`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";
      const traces: ToolCallTrace[] = [];
      const sources: { provider: string; timestamp: string }[] = [];
      // Warnings that explain why a run failed (e.g. no LLM key, provider
      // fallback) otherwise vanish in the status line above the composer.
      const notices: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = "message";
          let eventData = "";

          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6).trim();
            }
          }

          if (!eventData) continue;

          try {
            const data = JSON.parse(eventData);

            if (eventType === "avatar_state") {
              setAvatarState(data.state);
              if (data.state === "thinking") setActiveSubLabel("Synthesizing user intent...");
              else if (data.state === "analyzing") setActiveSubLabel("Querying on-chain endpoints...");
              else if (data.state === "streaming") setActiveSubLabel("Transmitting analytical findings...");
              else if (data.state === "success") setActiveSubLabel("Intelligence synchronized");
              else if (data.state === "offline") setActiveSubLabel("Offline Rule Engine active");
            } else if (eventType === "tool_call_start") {
              const newTrace: ToolCallTrace = {
                tool: data.tool,
                input: data.input,
              };
              traces.push(newTrace);
              setCurrentToolTraces([...traces]);
              setActiveSubLabel(`Executing ${data.tool}...`);
            } else if (eventType === "tool_call_end") {
              const target = traces.find((t) => t.tool === data.tool && t.durationMs === undefined);
              if (target) {
                target.durationMs = data.durationMs;
                target.success = data.success;
                target.error = data.error;
                setCurrentToolTraces([...traces]);
              }
            } else if (eventType === "token") {
              accumulatedText += data.token;
              setCurrentStreamingText(accumulatedText);
            } else if (eventType === "data_source") {
              sources.push({ provider: data.provider, timestamp: data.timestamp });
              setCurrentSources([...sources]);
            } else if (eventType === "error") {
              setActiveSubLabel(`Notice: ${data.message}`);
              if (typeof data.message === "string") notices.push(data.message);
            } else if (eventType === "done") {
              if (typeof data.conversationId === "string" && data.conversationId) {
                setConversationId(data.conversationId);
              }
              setMessages((prev) => [
                ...prev,
                {
                  id: `asst-${Date.now()}`,
                  role: "assistant",
                  content:
                    notices.length > 0
                      ? `${accumulatedText}\n\n> NOTICE: ${Array.from(new Set(notices)).join(" · ")}`
                      : accumulatedText,
                  toolCalls: [...traces],
                  sources: [...sources],
                },
              ]);
              setCurrentStreamingText("");
              setCurrentToolTraces([]);
              setCurrentSources([]);
            }
          } catch {
            // Non-JSON SSE payload
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analytical pipeline interrupted";
      setAvatarState("error");
      setActiveSubLabel(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Diagnostic Alert**: ${msg}. Please check provider keys or try another query.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setAvatarState("idle");
        setActiveSubLabel("");
      }, 3000);
    }
  };

  const toggleToolOpen = (idxKey: string) => {
    setOpenTools((prev) => ({ ...prev, [idxKey]: !prev[idxKey] }));
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto px-2 sm:px-4 py-4">
      {/* Top Cybernetic HUD Header with Babata Avatar */}
      <div className="flex items-center justify-between p-4 mb-4 rounded-xl glass-hud border border-surface-border">
        <div className="flex items-center space-x-4">
          <BabataAvatar state={avatarState} size="md" showLabel={false} />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold font-mono tracking-wider text-cyan-neon">
                BABATA // COGNITIVE CORE
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-neon/10 text-cyan-glow border border-cyan-neon/30 rounded-full uppercase">
                v0.1.0 MVP
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {activeSubLabel || "Standby: Ready for market & blockchain intelligence"}
            </p>
          </div>
        </div>

        {/* Status Indicator + Thread Controls */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-surface-border">
            <span className="w-2 h-2 rounded-full bg-emerald-cyber animate-pulse" />
            <span className="text-[11px] font-mono text-gray-300">TELEMETRY: VERIFIED</span>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            title="Start a new analysis thread"
            className="p-2 rounded-lg bg-surface-1 border border-surface-border text-gray-300 hover:text-cyan-neon hover:border-cyan-neon/40 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleHistory}
            title="Past analysis threads"
            className={`p-2 rounded-lg border transition-all ${
              historyOpen
                ? "bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon"
                : "bg-surface-1 border-surface-border text-gray-300 hover:text-cyan-neon hover:border-cyan-neon/40"
            }`}
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Drawer */}
      {historyOpen && (
        <div className="mb-4 p-4 rounded-xl glass-hud border border-surface-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
              Analysis Threads
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close history"
              className="p-1 rounded text-gray-500 hover:text-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {historyLoading && (
            <p className="text-xs font-mono text-gray-400 py-3">Loading threads…</p>
          )}
          {historyError && (
            <p className="text-xs font-mono text-amber-glow py-2">{historyError}</p>
          )}
          {!historyLoading && conversations.length === 0 && !historyError && (
            <p className="text-xs font-mono text-gray-500 py-3 leading-relaxed">
              No saved threads yet. Conversations are saved server-side once
              DATABASE_URL is configured; without it they live only in this
              server instance's memory.
            </p>
          )}
          {conversations.length > 0 && (
            <div className="max-h-56 overflow-y-auto space-y-1">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                    c.id === conversationId
                      ? "bg-cyan-neon/10 border-cyan-neon/40"
                      : "bg-surface-1/70 border-surface-border hover:border-cyan-neon/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openThread(c.id)}
                    disabled={threadLoading || isLoading}
                    className="flex-1 min-w-0 text-left disabled:opacity-50"
                  >
                    <span className="block truncate text-gray-100">
                      {c.title || "Untitled thread"}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {c.updatedAt || c.createdAt
                        ? new Date(c.updatedAt || c.createdAt || "").toLocaleString()
                        : "time unknown"}
                      {c.id === conversationId ? " · current" : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteThread(c.id)}
                    aria-label={`Delete thread ${c.title || c.id}`}
                    className="p-1 rounded text-gray-500 hover:text-rose-flare transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 min-h-[400px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center space-x-2 mb-1 px-1">
              <span className="text-[11px] font-mono text-gray-400">
                {m.role === "user" ? "OPERATOR" : "BABATA INTELLIGENCE"}
              </span>
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-4 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-surface-2 border border-cyan-neon/20 text-gray-100"
                  : "glass-hud text-gray-200 border-surface-border"
              }`}
            >
              {/* Tool Execution Traces */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-[11px] font-mono text-cyan-glow flex items-center space-x-1">
                    <span>⚡ Tool Invocations ({m.toolCalls.length})</span>
                  </div>
                  {m.toolCalls.map((t, idx) => {
                    const key = `${m.id}-tool-${idx}`;
                    const isOpen = !!openTools[key];
                    return (
                      <div
                        key={key}
                        className="rounded-lg bg-surface-1/90 border border-surface-border text-xs overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleToolOpen(key)}
                          className="w-full flex items-center justify-between px-3 py-1.5 font-mono text-[11px] text-gray-300 hover:bg-surface-2/60 transition-colors"
                        >
                          <span className="text-cyan-glow flex items-center space-x-1.5">
                            <span>▶ {t.tool}</span>
                          </span>
                          <span className="text-gray-400">
                            {t.durationMs ? `${t.durationMs}ms` : "executing..."}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="p-2 border-t border-surface-border bg-black/40 font-mono text-[10px] text-gray-300 overflow-x-auto">
                            <div className="text-gray-400 mb-1">Parameters:</div>
                            <pre>{JSON.stringify(t.input, null, 2)}</pre>
                            {t.error && (
                              <div className="text-rose-flare mt-1">Error: {t.error}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Message Content */}
              <div className="max-w-none break-words font-sans">
                {renderMarkdown(m.content)}
              </div>

              {/* Verified Sources */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-surface-border/50 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono text-gray-400 mr-1 self-center">
                    Data Sources:
                  </span>
                  {m.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-surface-border text-cyan-glow"
                    >
                      {s.provider} • {new Date(s.timestamp).toLocaleTimeString()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Streaming Assistant Message */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center space-x-2 mb-1 px-1">
              <span className="text-[11px] font-mono text-cyan-glow animate-pulse">
                BABATA COMPUTING...
              </span>
            </div>

            <div className="max-w-[85%] sm:max-w-[75%] rounded-xl p-4 text-sm leading-relaxed glass-hud text-gray-200 border-cyan-neon/30">
              {/* Active Tool Traces in Stream */}
              {currentToolTraces.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {currentToolTraces.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2.5 py-1 rounded bg-surface-1 border border-cyan-neon/20 text-xs font-mono"
                    >
                      <span className="text-cyan-neon flex items-center space-x-1.5">
                        <span className="animate-spin">⚙</span>
                        <span>{t.tool}</span>
                      </span>
                      <span className="text-gray-400">
                        {t.durationMs ? `${t.durationMs}ms` : "evaluating..."}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Text being streamed */}
              {currentStreamingText ? (
                <div className="max-w-none break-words font-sans">
                  {renderMarkdown(currentStreamingText)}
                  <span className="inline-block w-2 h-4 ml-1 bg-cyan-neon animate-pulse align-middle" />
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-ping" />
                  <span>Synthesizing multi-provider telemetry...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length < 4 && !isLoading && (
        <div className="py-2 flex flex-wrap gap-2">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 border border-surface-border hover:border-cyan-neon/40 text-gray-300 hover:text-cyan-neon transition-all font-mono"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="mt-2 relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Babata about market metrics, wallet activity, or protocol analytics..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl bg-surface-1 border border-surface-border focus:border-cyan-neon focus:ring-1 focus:ring-cyan-neon outline-none text-sm text-gray-100 placeholder-gray-500 font-sans transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 rounded-xl bg-cyan-neon/10 hover:bg-cyan-neon/20 border border-cyan-neon text-cyan-neon font-mono text-sm font-semibold tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-hud-glow"
          >
            {isLoading ? "PROBING..." : "DISPATCH"}
          </button>
        </form>
      </div>
    </div>
  );
};