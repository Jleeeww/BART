/**
 * ============================================================
 * CHAT WITH BART v1.0
 * ============================================================
 * server/routes/chat.ts
 *
 * Auth-gated stock Q&A chatbot. POST /api/chat streams SSE:
 *   meta   { conversationId, title }
 *   text   { delta }
 *   tool   { name, status: 'start'|'done', label, isError? }
 *   widget { id, type, title, data }          — rendered client-side (recharts)
 *   done   { conversationId, messageId, toolsUsed, usage }
 *   error  { message }
 *
 * Model: claude-opus-4-8 (adaptive thinking, effort=low, streaming
 * manual tool loop). Costs recorded per iteration to the 'chat'
 * pipeline bucket; per-user rate limits on top of the daily cap.
 *
 * IMPORTANT: every failure after SSE headers are sent MUST be
 * handled here — the global error handler (server/index.ts)
 * rethrows and cannot respond once headers are flushed.
 * ============================================================
 */

import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { conversations, chatMessages, type User } from "@shared/schema";
import { getSessionUser } from "./auth";
import { CHAT_TOOL_DEFINITIONS, TOOL_ACTIVITY_LABELS, executeChatTool, type ChatWidget } from "../engine/chatTools";
import { buildChatSystemPrompt } from "../engine/chatPrompt";
import { recordCost, isCapReached, estimateCost } from "../engine/costTracker";

const CHAT_MODEL = "claude-opus-4-8";
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_LOOP_ITERATIONS = 8;
const LOOP_BUDGET_MS = 120_000;

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Per-user rate limits (same two-Map pattern as routes/ai.ts) ─────────────
const CHAT_RATE_LIMIT_HOURLY = 20;
const CHAT_RATE_LIMIT_DAILY = 60;
const _userHourly = new Map<string, { count: number; windowStart: number }>();
const _userDaily = new Map<string, { count: number; date: string }>();

function todayUTCDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkAndIncrementUserLimit(userId: number): { allowed: boolean; reason?: string } {
  const key = String(userId);
  const now = Date.now();
  const today = todayUTCDate();

  const hourly = _userHourly.get(key);
  if (hourly && now - hourly.windowStart < 3_600_000) {
    if (hourly.count >= CHAT_RATE_LIMIT_HOURLY) {
      return { allowed: false, reason: `Batas tercapai: maks ${CHAT_RATE_LIMIT_HOURLY} pesan per jam` };
    }
    hourly.count++;
  } else {
    _userHourly.set(key, { count: 1, windowStart: now });
  }

  const daily = _userDaily.get(key);
  if (daily && daily.date === today) {
    if (daily.count >= CHAT_RATE_LIMIT_DAILY) {
      return { allowed: false, reason: `Batas tercapai: maks ${CHAT_RATE_LIMIT_DAILY} pesan per hari` };
    }
    daily.count++;
  } else {
    _userDaily.set(key, { count: 1, date: today });
  }

  return { allowed: true };
}

// One active stream per user — protects the loop from double-submits.
const _activeUsers = new Set<number>();

async function requireApprovedUser(req: Request, res: Response): Promise<User | null> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Sesi tidak valid" });
    return null;
  }
  if (user.status !== "APPROVED" && user.role !== "admin") {
    res.status(403).json({ error: "Akun belum disetujui admin" });
    return null;
  }
  return user;
}

const CLIENT_TOOL_NAMES = new Set(CHAT_TOOL_DEFINITIONS.map((t) => t.name));

export function registerChatRoutes(app: Express): void {
  // ── POST /api/chat — send a message, stream the answer ────────────────────
  app.post("/api/chat", async (req: Request, res: Response) => {
    const user = await requireApprovedUser(req, res);
    if (!user) return;

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const conversationIdRaw = req.body?.conversationId;

    if (!message) return res.status(400).json({ error: "Pesan kosong" });
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: `Pesan maksimal ${MAX_MESSAGE_CHARS} karakter` });
    }
    if (!anthropicClient) {
      return res.status(503).json({ error: "AI chat tidak aktif (ANTHROPIC_API_KEY tidak diset)" });
    }
    if (isCapReached("chat")) {
      return res.status(429).json({ error: "Batas biaya AI harian tercapai. Coba lagi besok ya 🙏" });
    }
    const rate = checkAndIncrementUserLimit(user.id);
    if (!rate.allowed) return res.status(429).json({ error: rate.reason });
    if (_activeUsers.has(user.id)) {
      return res.status(409).json({ error: "Masih ada jawaban yang sedang diproses" });
    }

    // Resolve / verify conversation BEFORE opening SSE.
    let conversation;
    if (conversationIdRaw != null) {
      const cid = parseInt(String(conversationIdRaw), 10);
      if (!Number.isFinite(cid)) return res.status(400).json({ error: "conversationId tidak valid" });
      const [row] = await db.select().from(conversations)
        .where(and(eq(conversations.id, cid), eq(conversations.userId, user.id))).limit(1);
      if (!row) return res.status(404).json({ error: "Percakapan tidak ditemukan" });
      conversation = row;
    } else {
      const [created] = await db.insert(conversations).values({
        userId: user.id,
        title: message.slice(0, 60),
      }).returning();
      conversation = created;
    }

    // ── Open SSE ──────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sse = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);

    let aborted = false;
    let currentStream: ReturnType<Anthropic["messages"]["stream"]> | null = null;
    req.on("close", () => {
      aborted = true;
      try { currentStream?.abort(); } catch { /* already done */ }
    });

    _activeUsers.add(user.id);
    try {
      sse("meta", { conversationId: conversation.id, title: conversation.title });

      // Persist the user message.
      await db.insert(chatMessages).values({
        conversationId: conversation.id,
        role: "user",
        content: message,
      });

      // Text-only history replay (tool blocks are per-turn, not replayed).
      const historyDesc = await db.select().from(chatMessages)
        .where(eq(chatMessages.conversationId, conversation.id))
        .orderBy(desc(chatMessages.id))
        .limit(MAX_HISTORY_MESSAGES);
      const messages: Anthropic.MessageParam[] = historyDesc
        .reverse()
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const systemPrompt = buildChatSystemPrompt();
      const tools: Anthropic.Messages.ToolUnion[] = [
        ...CHAT_TOOL_DEFINITIONS,
        { type: "web_search_20260209", name: "web_search", max_uses: 2 },
      ];

      const startedAt = Date.now();
      let assistantText = "";
      const toolsUsed: { name: string; label: string }[] = [];
      const widgets: ChatWidget[] = [];
      let totalIn = 0, totalOut = 0, totalSearches = 0;

      for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration++) {
        if (aborted) break;
        if (iteration > 0 && isCapReached("chat")) {
          const capNote = "\n\n_Batas biaya AI harian tercapai — jawaban dihentikan di sini._";
          assistantText += capNote;
          sse("text", { delta: capNote });
          break;
        }
        if (Date.now() - startedAt > LOOP_BUDGET_MS) {
          const timeNote = "\n\n_Waktu pemrosesan habis — jawaban dihentikan di sini._";
          assistantText += timeNote;
          sse("text", { delta: timeNote });
          break;
        }

        const stream = anthropicClient.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          tools,
          messages,
        });
        currentStream = stream;
        stream.on("text", (delta) => {
          assistantText += delta;
          sse("text", { delta });
        });

        const final = await stream.finalMessage();
        currentStream = null;

        // Cost per iteration. Cache tokens billed at their real multipliers.
        const u: any = final.usage ?? {};
        const effectiveIn = Math.round(
          (u.input_tokens ?? 0) +
          1.25 * (u.cache_creation_input_tokens ?? 0) +
          0.1 * (u.cache_read_input_tokens ?? 0)
        );
        const searches = final.content.filter(
          (b: any) => b.type === "server_tool_use" || (b.type === "tool_use" && b.name === "web_search")
        ).length;
        totalIn += effectiveIn;
        totalOut += u.output_tokens ?? 0;
        totalSearches += searches;
        recordCost("chat", effectiveIn, u.output_tokens ?? 0, searches, CHAT_MODEL);

        if (final.stop_reason === "pause_turn") {
          // Server-side tool loop paused — resend to resume.
          messages.push({ role: "assistant", content: final.content });
          continue;
        }
        if ((final.stop_reason as string) === "refusal") {
          const note = "\n\nMaaf, aku tidak bisa membantu untuk permintaan itu.";
          assistantText += note;
          sse("text", { delta: note });
          break;
        }
        if (final.stop_reason === "max_tokens") {
          const note = "\n\n_(jawaban terpotong — batas panjang tercapai)_";
          assistantText += note;
          sse("text", { delta: note });
          break;
        }

        const toolUses = final.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && CLIENT_TOOL_NAMES.has(b.name)
        );
        if (final.stop_reason !== "tool_use" || toolUses.length === 0) break;

        messages.push({ role: "assistant", content: final.content });

        for (const tu of toolUses) {
          sse("tool", { name: tu.name, status: "start", label: TOOL_ACTIVITY_LABELS[tu.name] ?? tu.name });
        }
        const outputs = await Promise.all(
          toolUses.map((tu) => executeChatTool(tu.name, (tu.input ?? {}) as Record<string, unknown>))
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        toolUses.forEach((tu, i) => {
          const out = outputs[i];
          const label = TOOL_ACTIVITY_LABELS[tu.name] ?? tu.name;
          sse("tool", { name: tu.name, status: "done", label, isError: out.isError });
          if (!out.isError && !toolsUsed.some((t) => t.name === tu.name)) {
            toolsUsed.push({ name: tu.name, label });
          }
          if (out.widget) {
            widgets.push(out.widget);
            sse("widget", out.widget);
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: out.result,
            is_error: out.isError,
          });
        });

        // ALL tool results go back in ONE user message.
        messages.push({ role: "user", content: toolResults });
      }

      // Persist the assistant message (even if aborted mid-way, keep partial text).
      if (aborted && assistantText) assistantText += "\n\n_(terputus)_";
      const [assistantRow] = await db.insert(chatMessages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: assistantText || "_(tidak ada jawaban)_",
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : null,
        widgets: widgets.length > 0 ? widgets : null,
      }).returning();
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));

      sse("done", {
        conversationId: conversation.id,
        messageId: assistantRow.id,
        toolsUsed,
        usage: {
          inputTokens: totalIn,
          outputTokens: totalOut,
          webSearches: totalSearches,
          costUsd: Number(estimateCost(totalIn, totalOut, totalSearches, CHAT_MODEL).toFixed(4)),
        },
      });
    } catch (err) {
      console.error("[/api/chat] stream error:", err);
      sse("error", { message: "Terjadi kesalahan saat memproses jawaban. Coba lagi ya." });
    } finally {
      _activeUsers.delete(user.id);
      clearInterval(heartbeat);
      res.end();
    }
  });

  // ── GET /api/chat/conversations — list (newest first) ─────────────────────
  app.get("/api/chat/conversations", async (req: Request, res: Response) => {
    try {
      const user = await requireApprovedUser(req, res);
      if (!user) return;
      const rows = await db.select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      }).from(conversations)
        .where(eq(conversations.userId, user.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(50);
      res.status(200).json({ conversations: rows });
    } catch (err) {
      console.error("[chat] list conversations error:", err);
      res.status(500).json({ error: "Gagal memuat percakapan" });
    }
  });

  // ── GET /api/chat/conversations/:id — full message history ────────────────
  app.get("/api/chat/conversations/:id", async (req: Request, res: Response) => {
    try {
      const user = await requireApprovedUser(req, res);
      if (!user) return;
      const cid = parseInt(req.params.id, 10);
      const [conv] = await db.select().from(conversations)
        .where(and(eq(conversations.id, cid), eq(conversations.userId, user.id))).limit(1);
      if (!conv) return res.status(404).json({ error: "Percakapan tidak ditemukan" });
      const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.conversationId, cid))
        .orderBy(chatMessages.id);
      res.status(200).json({ conversation: conv, messages });
    } catch (err) {
      console.error("[chat] load conversation error:", err);
      res.status(500).json({ error: "Gagal memuat percakapan" });
    }
  });

  // ── DELETE /api/chat/conversations/:id ────────────────────────────────────
  app.delete("/api/chat/conversations/:id", async (req: Request, res: Response) => {
    try {
      const user = await requireApprovedUser(req, res);
      if (!user) return;
      const cid = parseInt(req.params.id, 10);
      const [conv] = await db.select().from(conversations)
        .where(and(eq(conversations.id, cid), eq(conversations.userId, user.id))).limit(1);
      if (!conv) return res.status(404).json({ error: "Percakapan tidak ditemukan" });
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, cid));
      await db.delete(conversations).where(eq(conversations.id, cid));
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[chat] delete conversation error:", err);
      res.status(500).json({ error: "Gagal menghapus percakapan" });
    }
  });
}
