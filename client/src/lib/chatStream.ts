/**
 * chatStream.ts — fetch-based SSE consumer for POST /api/chat.
 *
 * EventSource can't send the Authorization header, so we stream the
 * response body of an authenticated fetch and parse SSE frames manually.
 */
import { authFetch } from "@/contexts/AuthContext";

export interface ChatWidgetData {
  id: string;
  type: "price_chart" | "bandar_flow" | "layer_scores" | "market_overview" | "fundamentals" | "themes";
  title: string;
  data: Record<string, any>;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
  costUsd: number;
}

export interface ChatStreamHandlers {
  onMeta(m: { conversationId: number; title: string }): void;
  onText(delta: string): void;
  onTool(t: { name: string; status: "start" | "done"; label: string; isError?: boolean }): void;
  onWidget(w: ChatWidgetData): void;
  onDone(d: { conversationId: number; messageId: number; toolsUsed: { name: string; label: string }[]; usage: ChatUsage }): void;
  onError(message: string): void;
}

export async function streamChat(
  body: { conversationId?: number; message: string },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await authFetch("POST", "/api/chat", body);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    handlers.onError("Tidak bisa terhubung ke server");
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    handlers.onError(data.error || `Gagal mengirim pesan (${res.status})`);
    return;
  }
  if (!res.body) {
    handlers.onError("Streaming tidak didukung browser ini");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;

  const dispatch = (frame: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith(":")) continue; // heartbeat
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let data: any;
    try { data = JSON.parse(dataLines.join("\n")); } catch { return; }

    switch (event) {
      case "meta":   handlers.onMeta(data); break;
      case "text":   handlers.onText(data.delta ?? ""); break;
      case "tool":   handlers.onTool(data); break;
      case "widget": handlers.onWidget(data); break;
      case "done":   sawTerminal = true; handlers.onDone(data); break;
      case "error":  sawTerminal = true; handlers.onError(data.message || "Terjadi kesalahan"); break;
    }
  };

  try {
    for (;;) {
      if (signal?.aborted) { await reader.cancel().catch(() => {}); return; }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (frame.trim()) dispatch(frame);
      }
    }
    if (!sawTerminal) handlers.onError("Koneksi terputus sebelum jawaban selesai");
  } catch (err) {
    if ((err as Error)?.name === "AbortError" || signal?.aborted) return;
    if (!sawTerminal) handlers.onError("Koneksi terputus saat streaming");
  }
}
