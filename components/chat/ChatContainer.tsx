"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Database,
  Info,
  Clock,
  RefreshCw,
} from "lucide-react";
import { BabataAvatar, AvatarState } from "../babata/Avatar";
import { ToolResult } from "@/lib/providers/interfaces";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolResults?: ToolResult[];
  sources?: Array<{ provider: string; fetchedAt: string; network?: string }>;
  model?: string;
}

export const ChatContainer: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      role: "assistant",
      content:
        "Hai sayang! 🥰 Aku Babata, asisten analisamu di Babata Lens. Aku siap membantumu melacak data pasar cryptocurrency, membedah smart contract, menganalisis saldo on-chain wallet, atau menjalankan cross-reference antar provider. Apa yang ingin sayang teliti hari ini?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Berapa harga Bitcoin saat ini?",
    "Cek harga Solana (SOL)",
    "Bandingkan harga BTC di CoinGecko & CoinMarketCap",
    "Periksa status provider di Health",
    "Analisis wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setAvatarState("thinking");

    try {
      // Transition avatar state
      setTimeout(() => setAvatarState("searching"), 300);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }

      const json = await res.json();
      setAvatarState("success");
      setTimeout(() => setAvatarState("idle"), 2000);

      const assistantMessage: ChatMessage = {
        id: `assist_${Date.now()}`,
        role: "assistant",
        content: json.message?.content || "Mohon maaf sayang, terjadi kendala saat memproses respons.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolResults: json.toolResults,
        sources: json.sources,
        model: json.model,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setAvatarState("error");
      setTimeout(() => setAvatarState("idle"), 3000);

      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content:
          "Mohon maaf sayang, aku mengalami kendala saat menghubungi provider data. Sayang bisa mencoba sesaat lagi atau memeriksa koneksi di halaman Health.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] max-w-4xl mx-auto w-full relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 pb-36 md:pb-28">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} items-start`}
            >
              {!isUser && (
                <div className="shrink-0 mt-1">
                  <BabataAvatar size="sm" state={avatarState} />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed transition-all shadow-md ${
                  isUser
                    ? "bg-cyan-600/20 text-slate-100 border border-cyan-500/30 rounded-br-sm"
                    : "bg-[#0E1524] text-slate-200 border border-[#1E2C4A] rounded-bl-sm"
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/5 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isUser ? "Atha" : "Babata"}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {msg.timestamp}
                  </span>
                </div>

                {/* Message Content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Tool Results Presentation */}
                {msg.toolResults && msg.toolResults.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-[#1E2C4A]/80">
                    {msg.toolResults.map((tool, idx) => (
                      <div
                        key={idx}
                        className="bg-[#131C30]/80 rounded-lg p-2.5 border border-[#1E2C4A] text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] mb-1">
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Database className="w-3 h-3" />
                            {tool.name}
                          </span>
                          {tool.source && (
                            <span className="text-slate-400">
                              via {tool.source.provider}
                            </span>
                          )}
                        </div>
                        {tool.error ? (
                          <div className="flex items-center gap-1 text-rose-400 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{tool.error}</span>
                          </div>
                        ) : (
                          <div className="text-slate-300 font-mono text-[11px] overflow-x-auto p-1.5 bg-[#0A0E1A] rounded">
                            {typeof tool.result === "object"
                              ? JSON.stringify(tool.result, null, 2)
                              : String(tool.result)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Collapsible Source Metadata */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSourceId(expandedSourceId === msg.id ? null : msg.id)
                      }
                      className="text-[11px] text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 transition-colors min-h-[32px]"
                    >
                      <Info className="w-3 h-3" />
                      <span>
                        {expandedSourceId === msg.id ? "Hide sources" : "View source attribution"}
                      </span>
                      {expandedSourceId === msg.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {expandedSourceId === msg.id && (
                      <div className="mt-1.5 p-2 rounded bg-[#131C30]/50 border border-[#1E2C4A] text-[10px] text-slate-400 space-y-1 font-mono">
                        {msg.sources.map((s, sIdx) => (
                          <div key={sIdx} className="flex justify-between">
                            <span>Provider: {s.provider}</span>
                            <span>{new Date(s.fetchedAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                        {msg.model && (
                          <div className="text-indigo-300 pt-0.5 border-t border-white/5">
                            Routing Model: {msg.model}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-3">
            <BabataAvatar size="sm" state="thinking" />
            <div className="bg-[#0E1524] border border-[#1E2C4A] px-4 py-2.5 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Babata sedang meneliti data untukmu...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Floating Composer Area */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:relative bg-[#080C15]/90 backdrop-blur border-t border-[#1E2C4A] p-3 sm:p-4 z-20">
        <div className="max-w-4xl mx-auto w-full space-y-2">
          {/* Horizontally scrollable quick prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-400 shrink-0 text-[11px] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Tanya:
            </span>
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#131C30] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-slate-300 text-[11px] transition-colors shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya Babata mengenai pasar, wallet, atau token..."
              disabled={loading}
              className="flex-1 bg-[#0E1524] border border-[#1E2C4A] focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim pesan"
              className="min-w-[48px] min-h-[48px] rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
