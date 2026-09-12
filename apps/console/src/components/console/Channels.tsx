"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWaMessages,
  listWaAccounts,
  listWaChats,
  sendWaMessage,
  type ApiWaAccount,
  type WaChat,
  type WaMessage,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 72%, transparent)";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function clock(ts: number): string {
  // Baileys timestamps are unix seconds.
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayOrClock(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? clock(ts) : d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/**
 * Channels — a port of OrgConsole.dc.html's `channels` region (lines 695-822),
 * styles verbatim, backed by the WhatsApp adapter (Baileys).
 *
 * The chips are the configured WhatsApp accounts, the thread list is
 * adapter.listChats() and the conversation is adapter.getMessages(jid).
 * Sending goes through POST /wa/accounts/:id/send.
 *
 * Everything here depends on a live Baileys session: with no paired account
 * the adapter has no chats, and the API answers 503 when the manager is not
 * configured. Both are surfaced rather than rendered as an empty inbox that
 * looks like "no messages".
 */
export function Channels() {
  const { spaceId } = useOrgScope();

  const [accounts, setAccounts] = useState<ApiWaAccount[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [chats, setChats] = useState<WaChat[]>([]);
  const [jid, setJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWaAccounts(spaceId);
        if (cancelled) return;
        setAccounts(list);
        if (list[0]) setAccountId(list[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load channels.");
      }
    })();
    return () => { cancelled = true; };
  }, [spaceId]);

  const loadChats = useCallback(async (id: string) => {
    try {
      setChats(await listWaChats(id));
      setError(null);
    } catch (e) {
      setChats([]);
      setError(e instanceof Error ? e.message : "Could not load conversations.");
    }
  }, []);

  useEffect(() => {
    if (!accountId) return;
    void loadChats(accountId);
    // Poll: the adapter's chat list changes as messages arrive, and there is
    // no push channel to the browser.
    const t = setInterval(() => void loadChats(accountId), 10000);
    return () => clearInterval(t);
  }, [accountId, loadChats]);

  useEffect(() => {
    if (!accountId || !jid) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const items = await getWaMessages(accountId, jid, { limit: 50 });
        if (!cancelled) setMessages(items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load messages.");
      }
    };
    void pull();
    const t = setInterval(pull, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [accountId, jid]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || !accountId || !jid || sending) return;
    setSending(true);
    try {
      await sendWaMessage(accountId, jid, text);
      setDraft("");
      setMessages(await getWaMessages(accountId, jid, { limit: 50 }));
      void loadChats(accountId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  const active = chats.find((c) => c.jid === jid) ?? null;
  const visible = query.trim()
    ? chats.filter((c) => (c.name + c.lastMessage).toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  return (
    <div data-copilot-region="channels">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Channels</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            Pick which of your configured channels to work in. Conversations arrive here, and
            anything you send goes out over the same channel.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "var(--space-4)" }}>
        {(accounts ?? []).map((a) => {
          const on = a.id === accountId;
          return (
            <button
              key={a.id}
              onClick={() => { setAccountId(a.id); setJid(null); setMessages([]); }}
              title={a.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 14px 0 8px",
                background: on ? "color-mix(in srgb,var(--color-text) 10%,transparent)" : "transparent",
                border: "1px solid var(--color-divider)",
                borderRadius: 999,
                color: "var(--color-text)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "none", width: 24, height: 24, borderRadius: 999, background: "var(--color-accent)", color: "#fff", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10 }}>
                wa
              </span>
              {a.label}
            </button>
          );
        })}
        {accounts && accounts.length === 0 ? (
          <span style={{ fontSize: 13, color: MUTED }}>
            No channel configured. Add a WhatsApp account in System configuration → Channels.
          </span>
        ) : null}
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 13, marginTop: 0 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch", height: 560, minHeight: 0 }}>
        <aside style={{ flex: "none", width: 280, display: "flex", flexDirection: "column", background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <div style={{ flex: "none", padding: "var(--space-3)", borderBottom: "1px solid var(--color-divider)" }}>
            <input className="input" placeholder="Search conversations" style={{ height: 34 }} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {visible.length === 0 ? (
              <p style={{ padding: "var(--space-3)", margin: 0, fontSize: 13, color: MUTED }}>
                {chats.length === 0 ? "No conversations yet." : "Nothing matches that."}
              </p>
            ) : (
              visible.map((c) => (
                <button
                  key={c.jid}
                  onClick={() => setJid(c.jid)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px var(--space-3)",
                    background: c.jid === jid ? "var(--color-surface)" : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${c.jid === jid ? "var(--color-accent)" : "transparent"}`,
                    cursor: "pointer",
                    color: "var(--color-text)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "none", width: 34, height: 34, borderRadius: 999, background: "var(--color-accent)", color: "#fff", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11 }}>
                    {initials(c.name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <span style={{ flex: "none", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>{dayOrClock(c.timestamp)}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage}</span>
                      {c.unread ? (
                        <span style={{ flex: "none", minWidth: 17, height: 17, padding: "0 5px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-accent)", color: "var(--color-bg)", borderRadius: 999, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 10 }}>
                          {c.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <header style={{ flex: "none", display: "flex", alignItems: "center", gap: "var(--space-3)", height: 56, padding: "0 var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}>
            {active ? (
              <>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "none", width: 34, height: 34, borderRadius: 999, background: "var(--color-accent)", color: "#fff", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11 }}>
                  {initials(active.name)}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.name}</span>
                  <span style={{ fontSize: 11, color: DIM }}>{active.isGroup ? "Group" : active.jid.split("@")[0]}</span>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: MUTED }}>Pick a conversation</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-ink)" }}>WhatsApp</span>
          </header>

          <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: 10, background: "var(--color-surface)" }}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.fromMe ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "72%",
                    padding: "8px 11px",
                    borderRadius: m.fromMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.fromMe ? "var(--color-accent)" : "var(--color-bg)",
                    color: m.fromMe ? "#fff" : "var(--color-text)",
                    border: m.fromMe ? "none" : "1px solid var(--color-divider)",
                  }}
                >
                  <span style={{ display: "block", fontSize: 13, lineHeight: 1.5 }}>
                    {m.text || (m.mediaType ? `[${m.mediaType}]` : "")}
                  </span>
                  <span style={{ display: "block", textAlign: "right", fontSize: 10, marginTop: 3, opacity: 0.6 }}>{clock(m.timestamp)}</span>
                </div>
              </div>
            ))}
            {jid && messages.length === 0 ? (
              <p style={{ margin: "auto", fontSize: 13, color: MUTED }}>No messages in this conversation.</p>
            ) : null}
          </div>

          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "var(--space-3)", borderTop: "1px solid var(--color-divider)" }}>
            <input
              className="input"
              placeholder={active ? `Message ${active.name}` : "Pick a conversation"}
              disabled={!active || sending}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }}
              style={{ flex: 1, minWidth: 0, height: 38 }}
            />
            <button className="btn btn-primary btn-icon" title="Send" onClick={() => void send()} disabled={!active || sending} style={{ width: 38, height: 38 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
