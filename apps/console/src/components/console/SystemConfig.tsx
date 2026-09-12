"use client";

import { useEffect, useState } from "react";
import {
  createChannelAccount,
  getOrganizationApps,
  listActors,
  listChannelAccounts,
  listConnectors,
  listEnabledModels,
  listModelProviders,
  listSkills,
  listWaAccounts,
  setOrganizationApps,
  type ApiChannelAccount,
  type ApiWaAccount,
} from "@jamot/client";

import { useConsole, useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";

/** The mockup's nine sections, verbatim from its SECTIONS constant. */
const SECTIONS = [
  { id: "profile", label: "Profile", blurb: "Who you are to the platform, and how agents should treat you." },
  { id: "workspace", label: "Dreamspace", blurb: "The public page for the dream, and everything the dream agent needs in order to answer for it." },
  { id: "models", label: "Models", blurb: "Which models are available, what each one is used for, and what happens when one is not." },
  { id: "connectors", label: "Connectors", blurb: "Connections to external tools and MCP servers." },
  { id: "channels", label: "Channels", blurb: "External conversation surfaces the platform answers on." },
  { id: "apps", label: "Apps", blurb: "Tools available inside the platform. Activated apps appear in the rail; order here is rail order." },
  { id: "skills", label: "Skills", blurb: "What agents know how to do." },
  { id: "memory", label: "Memory", blurb: "What the organization remembers." },
  { id: "actors", label: "Actors", blurb: "Every human and agent the platform knows." },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * System configuration — a port of OrgConsole.dc.html's `system-config` region
 * (lines 871+): a full-screen overlay with a 232px section list and a content
 * pane, styles verbatim.
 *
 * Sections are wired to the API where an endpoint exists. Anything not yet
 * wired says so rather than showing invented settings.
 */
export function SystemConfig({ onClose }: { onClose: () => void }) {
  const { branding } = useConsole();
  const [active, setActive] = useState<SectionId>("channels");
  const section = SECTIONS.find((s) => s.id === active)!;

  return (
    <div
      data-copilot-region="system-config"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        padding: 32,
        background: "color-mix(in srgb,#201e1d 26%,transparent)",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            height: 64,
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          {/* eslint-disable @next/next/no-img-element */}
          <img className="mark-light" src="/brand/jamot-logo.webp" alt="Jamot" width={24} height={24} />
          <img className="mark-dark" src="/brand/jamot-logo-white.webp" alt="Jamot" width={24} height={24} />
          {/* eslint-enable @next/next/no-img-element */}
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            System configuration
          </span>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
            {branding.displayName}
          </span>
          <button className="btn btn-ghost btn-icon" title="Close" onClick={onClose} style={{ marginLeft: "auto" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div style={{ flex: "none", width: 232, borderRight: "1px solid var(--color-divider)", overflowY: "auto", padding: "var(--space-3) 0" }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  width: "calc(100% - 16px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  margin: "0 8px",
                  padding: "9px var(--space-3)",
                  background: s.id === active ? "color-mix(in srgb,var(--color-text) 10%,transparent)" : "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                <span style={{ flex: 1 }}>{s.label}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "var(--space-6) var(--space-6) var(--space-8)" }}>
            <div style={{ maxWidth: 820 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>{section.label}</h2>
              <p style={{ margin: "var(--space-2) 0 var(--space-6)", fontSize: 14, lineHeight: 1.6, color: MUTED }}>
                {section.blurb}
              </p>
              <SectionBody id={active} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotWired({ what }: { what: string }) {
  return (
    <div className="card">
      <div className="card-kicker">Not wired yet</div>
      <div className="card-title">{what}</div>
      <p className="card-body">
        The mockup&rsquo;s screen for this section has not been ported. It will replace this panel.
      </p>
    </div>
  );
}

function SectionBody({ id }: { id: SectionId }) {
  if (id === "channels") return <ChannelsSection />;
  if (id === "models") return <ModelsSection />;
  if (id === "apps") return <AppsSection />;
  if (id === "connectors") return <SimpleList label="Connectors" load={() => listConnectors().then((x) => x.map((c) => `${c.provider} · ${c.type} · ${c.status}`))} />;
  if (id === "skills") return <SimpleList label="Skills" load={() => listSkills().then((x) => x.map((s) => s.name))} />;
  if (id === "actors") return <SimpleList label="Actors" load={() => listActors().then((x) => x.map((a) => `${a.displayName} · ${a.type}`))} />;
  return <NotWired what={id === "profile" ? "Profile" : id === "workspace" ? "Dreamspace" : "Memory"} />;
}

function SimpleList({ label, load }: { label: string; load: () => Promise<string[]> }) {
  const [items, setItems] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((v) => !cancelled && setItems(v))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load."));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p>;
  if (!items) return <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>;
  if (items.length === 0) return <p style={{ color: MUTED, fontSize: 14 }}>No {label.toLowerCase()} yet.</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 14, lineHeight: 1.9 }}>
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

/** Channels — the section that matters for WhatsApp and Telegram. */
function ChannelsSection() {
  const { spaceId } = useOrgScope();
  const [channels, setChannels] = useState<ApiChannelAccount[] | null>(null);
  const [wa, setWa] = useState<ApiWaAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");

  async function refresh() {
    const [c, w] = await Promise.all([
      listChannelAccounts(spaceId),
      listWaAccounts(spaceId).catch(() => [] as ApiWaAccount[]),
    ]);
    setChannels(c);
    setWa(w);
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load channels."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  async function addTelegram(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createChannelAccount({ spaceId, protocol: "telegram", label: label.trim(), token: token.trim() });
      setLabel("");
      setToken("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the channel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p> : null}

      <h3 style={{ fontSize: 15, margin: "0 0 var(--space-3)" }}>
        WhatsApp <span style={{ opacity: 0.5 }}>({wa.length})</span>
      </h3>
      {wa.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>
          No WhatsApp account. Pairing must be done from a residential network — WhatsApp refuses the
          handshake from datacenter IPs.
        </p>
      ) : (
        <table className="table">
          <thead><tr><th>Label</th><th>Status</th></tr></thead>
          <tbody>
            {wa.map((a) => (
              <tr key={a.id}>
                <td>{a.label}</td>
                <td><span className="tag tag-neutral">{a.state?.status ?? a.status ?? "unknown"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>
        Telegram and Matrix {channels ? <span style={{ opacity: 0.5 }}>({channels.length})</span> : null}
      </h3>
      {channels === null ? (
        <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
      ) : channels.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>No channel accounts yet.</p>
      ) : (
        <table className="table">
          <thead><tr><th>Label</th><th>Protocol</th><th>Token</th></tr></thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td><span className="tag tag-neutral">{c.protocol}</span></td>
                <td>{c.token ? "stored" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="card" onSubmit={addTelegram} style={{ marginTop: "var(--space-4)" }}>
        <div className="card-title">Connect a Telegram bot</div>
        <p className="card-body">
          Create a bot with @BotFather and paste its token. Telegram needs no pairing and no proxy.
        </p>
        <div className="field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="tg-label">Label</label>
          <input className="input" id="tg-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="tg-token">Bot token</label>
          <input className="input" id="tg-token" type="password" required value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "var(--space-4)" }}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    </>
  );
}

/** Models — what the chat depends on. */
function ModelsSection() {
  const [providers, setProviders] = useState<{ id: string; name: string; status: string }[] | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, e] = await Promise.all([listModelProviders(), listEnabledModels().catch(() => [])]);
        if (cancelled) return;
        setProviders(p.map((x) => ({ id: x.id, name: x.name, status: x.status })));
        setEnabled(e.map((m) => `${m.providerName} · ${m.modelId}`));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load models.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p>;
  if (!providers) return <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>;

  return (
    <>
      {providers.length === 0 ? (
        <div className="card">
          <div className="card-kicker">Chat depends on this</div>
          <div className="card-title">No model provider configured</div>
          <p className="card-body">
            Without a provider the assistant cannot answer: the runtime returns 503 and the chat panel
            reports it. Add a provider to enable chat.
          </p>
        </div>
      ) : (
        <table className="table">
          <thead><tr><th>Provider</th><th>Status</th></tr></thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <span className={p.status === "ok" ? "tag tag-accent" : "tag tag-neutral"}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>
        Enabled models <span style={{ opacity: 0.5 }}>({enabled.length})</span>
      </h3>
      {enabled.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>None enabled.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 14, lineHeight: 1.9 }}>
          {enabled.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </>
  );
}

/** Apps — the mockup says "Activated apps appear in the rail". */
function AppsSection() {
  const { organizationId } = useOrgScope();
  const [apps, setApps] = useState<{ id: string; name: string; enabled: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const data = await getOrganizationApps(organizationId);
    setApps(data.apps.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled })));
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load apps."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function toggle(id: string) {
    if (!apps) return;
    setBusy(true);
    setError(null);
    try {
      const next = apps.filter((a) => (a.id === id ? !a.enabled : a.enabled)).map((a) => a.id);
      await setOrganizationApps(organizationId, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update apps.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p>;
  if (!apps) return <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>;

  return (
    <table className="table">
      <thead><tr><th>App</th><th>State</th><th /></tr></thead>
      <tbody>
        {apps.map((a) => (
          <tr key={a.id}>
            <td>{a.name}</td>
            <td><span className={a.enabled ? "tag tag-accent" : "tag tag-neutral"}>{a.enabled ? "enabled" : "off"}</span></td>
            <td>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void toggle(a.id)}>
                {a.enabled ? "Disable" : "Enable"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
