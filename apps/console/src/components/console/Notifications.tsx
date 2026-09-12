"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 72%, transparent)";

/**
 * One dot colour per notification type. The API's `NotificationType` union is
 * the authority; anything it grows later falls back to the neutral dot rather
 * than disappearing.
 */
const TYPE_TONE: Record<string, { label: string; colour: string }> = {
  approval: { label: "Approval", colour: "oklch(0.45 0.13 60)" },
  completed: { label: "Completed", colour: "oklch(0.45 0.13 150)" },
  warning: { label: "Warning", colour: "oklch(0.5 0.16 30)" },
  opportunity: { label: "Opportunity", colour: "oklch(0.48 0.13 265)" },
  proposal: { label: "Proposal", colour: "oklch(0.48 0.12 300)" },
  message: { label: "Message", colour: "oklch(0.45 0.02 60)" },
};

function tone(type: string) {
  return TYPE_TONE[type] ?? { label: type, colour: "oklch(0.45 0.02 60)" };
}

/** "3 minutes ago" down to the day, then the date. */
function when(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString([], { day: "2-digit", month: "short" });
}

/**
 * Notifications.
 *
 * The mockup has no notification screen — none of its templates mention one —
 * so this is built from the design system's own idiom rather than ported, and
 * kept deliberately plain so it sits beside the ported screens without
 * competing with them.
 *
 * The items are real: the API creates them from task events (assignment,
 * approval needed, completion), one row per recipient. Read state is a PUT,
 * not local, so the bell agrees with itself across devices.
 */
export function Notifications({ onOpenSection }: { onOpenSection?: (section: string) => void }) {
  const { spaceId } = useOrgScope();
  const [items, setItems] = useState<ApiNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications(spaceId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
      setItems([]);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(() => (items ?? []).filter((n) => !n.read).length, [items]);
  const shown = (items ?? []).filter((n) => !unreadOnly || !n.read);

  async function open(item: ApiNotification) {
    if (!item.read) {
      /* Mark locally first: the row should stop looking unread the moment it
         is clicked, even if the PUT is slow or the reader navigates away. */
      setItems((current) =>
        (current ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        await load();
      }
    }
    if (item.targetSection && onOpenSection) onOpenSection(item.targetSection);
  }

  async function readAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead(spaceId);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark them read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-copilot-region="notifications">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Notifications</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            What your agents and your people need you to know — approvals waiting on you, work that
            landed on you, work that finished.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            style={{ justifyContent: "flex-start" }}
            onClick={() => setUnreadOnly((v) => !v)}
          >
            {unreadOnly ? "Show all" : `Unread only${unread > 0 ? ` (${unread})` : ""}`}
          </button>
          <button
            className="btn btn-primary"
            style={{ justifyContent: "flex-start" }}
            disabled={busy || unread === 0}
            onClick={() => void readAll()}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? (
        <p style={{ margin: "0 0 var(--space-4)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p>
      ) : null}

      {items === null ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading notifications…</p>
      ) : shown.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
          {items.length === 0
            ? "Nothing yet. Notifications arrive when a task is assigned to you, needs your approval, or is completed."
            : "Nothing unread."}
        </p>
      ) : (
        <section
          style={{
            border: "1px solid var(--color-divider)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          {shown.map((n, index) => {
            const t = tone(n.type);
            const clickable = Boolean(n.targetSection && onOpenSection) || !n.read;
            return (
              <div
                key={n.id}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => void open(n) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void open(n);
                        }
                      }
                    : undefined
                }
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderTop: index === 0 ? "none" : "1px solid var(--color-divider)",
                  background: n.read ? "transparent" : "var(--color-surface)",
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                <span
                  title={t.label}
                  style={{
                    flex: "none",
                    marginTop: 5,
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: t.colour,
                    opacity: n.read ? 0.45 : 1,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: n.read ? 500 : 800,
                      fontSize: 14,
                      lineHeight: 1.35,
                    }}
                  >
                    {n.title}
                  </span>
                  {n.summary ? (
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: MUTED }}>{n.summary}</span>
                  ) : null}
                </span>
                <span
                  style={{
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    fontSize: 11,
                    color: DIM,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.label}</span>
                  <span>{when(n.createdAt)}</span>
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
