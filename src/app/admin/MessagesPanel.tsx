"use client";

import { useState } from "react";

type Message = { id: string; author: "admin" | "buyer"; message: string; read: boolean; created_at: string };

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MessagesPanel({ userId, displayName }: { userId: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  const unread = messages.filter((item) => item.author === "buyer" && !item.read).length;

  async function load(markRead: boolean) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/messages?userId=${userId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load messages (${response.status})`);
      const data = await response.json();
      setMessages(data.messages ?? []);
      if (markRead && (data.messages ?? []).some((item: Message) => item.author === "buyer" && !item.read)) {
        await fetch("/api/messages", {
          method: "PATCH",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        setMessages((current) => current.map((item) => (item.author === "buyer" ? { ...item, read: true } : item)));
      }
    } catch {
      setError("Messages could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load(true);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text }),
      });
      if (!response.ok) throw new Error(`Could not send (${response.status})`);
      setDraft("");
      await load(false);
    } catch {
      setError("That message could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="messages-panel">
      <button type="button" className="small-action" onClick={toggle}>
        Messages{unread > 0 ? <span className="messages-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="label" style={{ marginBottom: 8 }}>{displayName}</div>
          {loading ? <div className="muted small">Loading…</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
          {!loading && !error ? (
            <div className="message-thread">
              {messages.length ? (
                messages.map((item) => (
                  <div className={`message-bubble ${item.author === "admin" ? "mine" : "theirs"}`} key={item.id}>
                    {item.message}
                    <span className="message-meta">{item.author === "admin" ? "You" : displayName} · {formatWhen(item.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="message-empty">No messages yet.</div>
              )}
            </div>
          ) : null}
          <div className="message-compose">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder={`Message ${displayName}...`}
              aria-label={`Message ${displayName}`}
            />
            <button type="button" className="button small" disabled={sending} onClick={send}>
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
