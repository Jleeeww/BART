/**
 * ChatPage.tsx — "Chat BART" (/dashboard/chat)
 *
 * Free-form stock Q&A over the BART engines. Streams SSE from
 * POST /api/chat (text deltas + tool activity + recharts widgets),
 * persists conversations per user.
 *
 * NOTE: every request here must carry the Bearer token — the react-query
 * default queryFn does NOT, so all queries use explicit authFetch queryFns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, MessageSquare, Plus, Send, Square, Trash2 } from "lucide-react";
import { authFetch } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { streamChat, type ChatWidgetData } from "@/lib/chatStream";
import { ChatWidgetList } from "@/components/chat/ChatWidgets";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const MAX_CHARS = 2000;

interface ConversationRow {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ToolChip {
  name: string;
  label: string;
  status: "start" | "done";
  isError?: boolean;
}

interface UIMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: { name: string; label: string }[] | null;
  widgets?: ChatWidgetData[] | null;
  streaming?: boolean;
  activeTools?: ToolChip[];
}

const STARTERS = [
  "Bagaimana bandarmology BBCA hari ini?",
  "Apa tema pasar yang lagi aktif?",
  "Ringkas kondisi pasar & makro hari ini",
  "Bandingkan valuasi BBRI vs BMRI",
];

// ── Markdown (light) ──────────────────────────────────────────
const mdComponents = {
  p:      (p: any) => <p style={{ margin: "0 0 8px", lineHeight: 1.7 }} {...p} />,
  strong: (p: any) => <strong style={{ color: "var(--text-1)", fontWeight: 700 }} {...p} />,
  em:     (p: any) => <em style={{ color: "var(--text-3)" }} {...p} />,
  ul:     (p: any) => <ul style={{ margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.7, listStyle: "disc" }} {...p} />,
  ol:     (p: any) => <ol style={{ margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.7, listStyle: "decimal" }} {...p} />,
  li:     (p: any) => <li style={{ marginBottom: 2 }} {...p} />,
  a:      (p: any) => <a style={{ color: "var(--signal)", textDecoration: "underline" }} target="_blank" rel="noreferrer" {...p} />,
  code:   (p: any) => <code style={{ background: "var(--surface-2)", borderRadius: 3, padding: "0 4px", fontSize: 12 }} {...p} />,
  h1:     (p: any) => <div style={{ fontWeight: 700, color: "var(--text-1)", margin: "8px 0 4px", fontSize: 14 }} {...p} />,
  h2:     (p: any) => <div style={{ fontWeight: 700, color: "var(--text-1)", margin: "8px 0 4px", fontSize: 13 }} {...p} />,
  h3:     (p: any) => <div style={{ fontWeight: 600, color: "var(--text-1)", margin: "8px 0 4px", fontSize: 13 }} {...p} />,
};

function ToolActivity({ tools }: { tools: ToolChip[] }) {
  if (tools.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
      {tools.map((t, i) => (
        <span key={`${t.name}-${i}`} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontFamily: mono, fontSize: 10,
          color: t.isError ? "var(--danger)" : t.status === "start" ? "var(--signal)" : "var(--text-4)",
          background: "var(--surface-2)", border: "1px solid var(--border-1)",
          borderRadius: 4, padding: "2px 7px",
        }}>
          {t.status === "start" && <Loader2 size={9} className="animate-spin" />}
          {t.label}{t.status === "done" && !t.isError ? " ✓" : ""}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
      <div style={{ maxWidth: isUser ? "78%" : "94%", minWidth: 0, width: isUser ? undefined : "94%" }}>
        {!isUser && msg.activeTools && <ToolActivity tools={msg.activeTools} />}
        <div style={{
          fontFamily: mono, fontSize: 13, color: "var(--text-2)",
          background: isUser ? "var(--signal-dim)" : "var(--surface-1)",
          border: `1px solid ${isUser ? "var(--signal)" : "var(--border-1)"}`,
          borderRadius: 8, padding: "10px 14px",
          whiteSpace: isUser ? "pre-wrap" : undefined,
          overflowWrap: "break-word",
        }}>
          {isUser ? (
            msg.content
          ) : (
            <>
              {msg.content
                ? <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                : msg.streaming && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text-4)" }}>
                    <Loader2 size={12} className="animate-spin" /> BART sedang berpikir...
                  </span>
                )}
              <ChatWidgetList widgets={msg.widgets} />
              {!msg.streaming && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                  {msg.toolsUsed.map((t) => (
                    <span key={t.name} style={{
                      fontFamily: mono, fontSize: 9, color: "var(--text-4)",
                      border: "1px solid var(--border-1)", borderRadius: 3, padding: "1px 5px",
                    }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  const { data: convData } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/chat/conversations");
      if (!res.ok) throw new Error("Gagal memuat percakapan");
      return res.json() as Promise<{ conversations: ConversationRow[] }>;
    },
  });
  const conversationList = convData?.conversations ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const openConversation = useCallback(async (id: number) => {
    if (sending) return;
    setActiveId(id);
    setLoadingConv(true);
    try {
      const res = await authFetch("GET", `/api/chat/conversations/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((data.messages ?? []).map((m: any): UIMessage => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolsUsed: m.toolsUsed ?? null,
        widgets: m.widgets ?? null,
      })));
    } catch {
      toast({ title: "Gagal memuat percakapan", variant: "destructive" });
    } finally {
      setLoadingConv(false);
    }
  }, [sending, toast]);

  const newConversation = useCallback(() => {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
  }, [sending]);

  const deleteConversation = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await authFetch("DELETE", `/api/chat/conversations/${id}`);
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      if (activeIdRef.current === id) newConversation();
    } catch {
      toast({ title: "Gagal menghapus percakapan", variant: "destructive" });
    }
  }, [newConversation, queryClient, toast]);

  const updateLast = useCallback((fn: (m: UIMessage) => UIMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }, []);

  const send = useCallback(async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    if (message.length > MAX_CHARS) {
      toast({ title: `Pesan maksimal ${MAX_CHARS} karakter`, variant: "destructive" });
      return;
    }
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "", streaming: true, activeTools: [], widgets: [] },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(
      { conversationId: activeIdRef.current ?? undefined, message },
      {
        onMeta: (m) => {
          if (activeIdRef.current == null) {
            setActiveId(m.conversationId);
            queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
          }
        },
        onText: (delta) => updateLast((m) => ({ ...m, content: m.content + delta })),
        onTool: (t) => updateLast((m) => {
          const tools = (m.activeTools ?? []).slice();
          if (t.status === "start") {
            tools.push({ name: t.name, label: t.label, status: "start" });
          } else {
            const idx = tools.findIndex((x) => x.name === t.name && x.status === "start");
            if (idx >= 0) tools[idx] = { ...tools[idx], status: "done", isError: t.isError };
          }
          return { ...m, activeTools: tools };
        }),
        onWidget: (w) => updateLast((m) => ({ ...m, widgets: [...(m.widgets ?? []), w] })),
        onDone: (d) => {
          updateLast((m) => ({ ...m, streaming: false, activeTools: undefined, toolsUsed: d.toolsUsed, id: d.messageId }));
          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        },
        onError: (message_) => {
          updateLast((m) => ({
            ...m,
            streaming: false,
            activeTools: undefined,
            content: m.content || `_${message_}_`,
          }));
          toast({ title: message_, variant: "destructive" });
        },
      },
      controller.signal,
    );

    abortRef.current = null;
    setSending(false);
  }, [input, sending, queryClient, toast, updateLast]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    updateLast((m) => (m.streaming ? { ...m, streaming: false, activeTools: undefined, content: m.content + "\n\n_(dihentikan)_" } : m));
    setSending(false);
  }, [updateLast]);

  const isEmpty = messages.length === 0 && !loadingConv;

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--surface-0)" }}>
      {/* ── Conversation rail (desktop) ─────────────────────────── */}
      <aside className="hidden md:flex flex-col" style={{
        width: 232, flexShrink: 0, borderRight: "1px solid var(--border-1)",
      }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border-1)" }}>
          <button
            onClick={newConversation}
            disabled={sending}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              width: "100%", padding: "8px 0", borderRadius: 6,
              fontFamily: mono, fontSize: 12, fontWeight: 600,
              color: "var(--signal)", background: "var(--signal-dim)",
              border: "1px solid var(--signal)", cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.5 : 1,
            }}
            data-testid="button-new-chat"
          >
            <Plus size={13} /> Chat Baru
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {conversationList.length === 0 && (
            <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", textAlign: "center", padding: "18px 12px" }}>
              Belum ada percakapan
            </p>
          )}
          {conversationList.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", cursor: "pointer",
                background: activeId === c.id ? "var(--signal-dim)" : "transparent",
                borderLeft: activeId === c.id ? "2px solid var(--signal)" : "2px solid transparent",
              }}
              onMouseEnter={(e) => { if (activeId !== c.id) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { if (activeId !== c.id) e.currentTarget.style.background = "transparent"; }}
              data-testid={`conversation-${c.id}`}
            >
              <MessageSquare size={12} style={{ color: activeId === c.id ? "var(--signal)" : "var(--text-4)", flexShrink: 0 }} />
              <span style={{
                fontFamily: mono, fontSize: 11, flex: 1,
                color: activeId === c.id ? "var(--text-1)" : "var(--text-3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.title}
              </span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                title="Hapus"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 2, flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-4)"; }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Thread ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile conversation bar */}
        <div className="md:hidden flex" style={{
          gap: 8, alignItems: "center",
          padding: "8px 12px", borderBottom: "1px solid var(--border-1)",
        }}>
          <select
            value={activeId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") newConversation();
              else openConversation(Number(v));
            }}
            style={{
              flex: 1, fontFamily: mono, fontSize: 12, padding: "6px 8px",
              background: "var(--surface-1)", color: "var(--text-1)",
              border: "1px solid var(--border-2)", borderRadius: 6,
            }}
          >
            <option value="">+ Chat baru</option>
            {conversationList.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {loadingConv && (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 size={18} className="animate-spin" style={{ color: "var(--signal)" }} />
              </div>
            )}
            {isEmpty && (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12, margin: "0 auto 14px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--signal-dim)", border: "1px solid var(--signal)",
                }}>
                  <Bot size={26} style={{ color: "var(--signal)" }} />
                </div>
                <h1 style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>
                  Chat BART
                </h1>
                <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Tanya apa saja soal saham IDX — bandarmologi, fundamental, berita, tema pasar.
                  Jawaban di-grounding ke data real-time engine BART, lengkap dengan chart.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420, margin: "0 auto" }}>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        fontFamily: mono, fontSize: 12, textAlign: "left",
                        padding: "10px 14px", borderRadius: 7, cursor: "pointer",
                        color: "var(--text-2)", background: "var(--surface-1)",
                        border: "1px solid var(--border-2)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--signal)";
                        e.currentTarget.style.color = "var(--text-1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-2)";
                        e.currentTarget.style.color = "var(--text-2)";
                      }}
                      data-testid={`starter-${s.slice(0, 12)}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => <MessageBubble key={m.id ?? `local-${i}`} msg={m} />)}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div style={{ borderTop: "1px solid var(--border-1)", padding: "12px 16px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: "var(--surface-1)", border: "1px solid var(--border-2)",
              borderRadius: 8, padding: "8px 10px",
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Tanya soal saham... (Enter untuk kirim)"
                rows={Math.min(4, Math.max(1, input.split("\n").length))}
                disabled={sending}
                style={{
                  flex: 1, resize: "none", outline: "none",
                  fontFamily: mono, fontSize: 13, lineHeight: 1.5,
                  background: "transparent", border: "none", color: "var(--text-1)",
                }}
                data-testid="input-chat-message"
              />
              {sending ? (
                <button
                  onClick={stop}
                  title="Hentikan"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    background: "var(--danger)", border: "none", color: "#fff",
                  }}
                  data-testid="button-stop-chat"
                >
                  <Square size={13} />
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim()}
                  title="Kirim"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: input.trim() ? "var(--signal)" : "var(--surface-2)",
                    border: "none", color: input.trim() ? "var(--surface-0)" : "var(--text-4)",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                  }}
                  data-testid="button-send-chat"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: mono, fontSize: 10, color: "var(--text-4)", marginTop: 5,
            }}>
              <span>Bukan rekomendasi beli/jual — analisis konteks berbasis data BART.</span>
              <span>{input.length}/{MAX_CHARS}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
