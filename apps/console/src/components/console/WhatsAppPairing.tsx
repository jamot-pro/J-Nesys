"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  createWaAccount,
  getWaAccountState,
  getWaDiagnostics,
  importWaSession,
  listWaAccounts,
  requestWaPairingCode,
  resetWaAccount,
  type ApiWaAccount,
  type WaAccountState,
  type WaDiagnostics,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";

/** WhatsApp pairing.
 *
 * The QR only exists while the adapter is mid-handshake, so state is polled
 * rather than fetched once. Polling stops as soon as the connection opens, or
 * when this unmounts — a stray interval would keep hitting the API from a
 * closed dialog.
 *
 * WhatsApp refuses the new-pairing handshake from datacenter IPs, so on Render
 * the QR may never arrive even though everything is configured. That is stated
 * on screen rather than left as a spinner, with the offline pairing route the
 * README documents.
 */
export function WhatsAppPairing() {
  const { spaceId } = useOrgScope();
  const [accounts, setAccounts] = useState<ApiWaAccount[] | null>(null);
  const [state, setState] = useState<WaAccountState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [diagnostics, setDiagnostics] = useState<WaDiagnostics | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);

  const refresh = useCallback(async () => {
    setAccounts(await listWaAccounts(spaceId));
  }, [spaceId]);

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load accounts."));
  }, [refresh]);

  // Poll the selected account's state while it is not yet connected.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const s = await getWaAccountState(selected);
        if (cancelled) return;
        setState(s);
        setWaited((n) => n + 1);
        if (s.connection === "open") {
          if (timer.current) clearInterval(timer.current);
          void refresh();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not read the pairing state.");
      }
    };

    void tick();
    timer.current = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [selected, refresh]);

  // Render the raw pairing payload into a scannable image.
  useEffect(() => {
    if (!state?.qr) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(state.qr, { margin: 1, width: 220 })
      .then((url) => !cancelled && setQrImage(url))
      .catch(() => !cancelled && setQrImage(null));
    return () => {
      cancelled = true;
    };
  }, [state?.qr]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await createWaAccount({ spaceId, label: label.trim() });
      setLabel("");
      await refresh();
      setWaited(0);
      setSelected(account.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  async function restart(id: string) {
    setBusy(true);
    setError(null);
    try {
      await resetWaAccount(id);
      setState(null);
      setQrImage(null);
      setWaited(0);
      setPairingCode(null);
      setSelected(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset pairing.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(id: string) {
    setRequestingCode(true);
    setError(null);
    try {
      setPairingCode(await requestWaPairingCode(id, phoneNumber));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get a pairing code.");
    } finally {
      setRequestingCode(false);
    }
  }

  /**
   * Imports a session paired elsewhere. The files are read in the browser and
   * sent base64-encoded, which is what POST /wa/accounts/:id/session expects.
   * Resuming an imported session is a different handshake from pairing a new
   * one, and WhatsApp accepts it from this server's IP — which is why this
   * route exists at all.
   */
  async function importSession(id: string, fileList: FileList) {
    setImporting(true);
    setError(null);
    setImported(null);
    try {
      const files: Record<string, string> = {};
      for (const file of Array.from(fileList)) {
        const relative =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        /* Keep the path below the chosen directory: the adapter recreates the
           tree, and the directory's own name is not part of it. */
        const name = relative.includes("/") ? relative.slice(relative.indexOf("/") + 1) : relative;
        const buffer = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of buffer) binary += String.fromCharCode(byte);
        files[name] = btoa(binary);
      }
      if (Object.keys(files).length === 0) throw new Error("no files chosen");
      if (!Object.keys(files).some((n) => n.endsWith("creds.json"))) {
        throw new Error("that folder has no creds.json — pick the session directory itself");
      }

      await importWaSession(id, files);
      setImported(`Imported ${Object.keys(files).length} files. Waiting for the connection…`);
      setWaited(0);
      setSelected(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that session.");
    } finally {
      setImporting(false);
    }
  }

  /* Once the wait stops looking like latency, ask the server what it sees.
     Fetched once, not polled: none of it changes second to second. */
  useEffect(() => {
    if (!selected || diagnostics || waited < 10) return;
    void getWaDiagnostics()
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null));
  }, [selected, waited, diagnostics]);

  const connected = state?.connection === "open";
  // ~30s of polling with no QR and no connection is the datacenter-IP symptom.
  const stalled = Boolean(selected) && !connected && !state?.qr && waited >= 10;

  return (
    <>
      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p> : null}

      {accounts === null ? (
        <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
      ) : accounts.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>No WhatsApp account yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Label</th><th>Connection</th><th>Phone</th><th /></tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.label}</td>
                <td>
                  <span className={a.state?.status === "open" ? "tag tag-accent" : "tag tag-neutral"}>
                    {a.state?.status ?? a.status ?? "not connected"}
                  </span>
                </td>
                <td>{"—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setWaited(0); setPairingCode(null); setSelected(a.id); }}>
                    Pair
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void restart(a.id)}>
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected ? (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <div className="card-kicker">{connected ? "Connected" : "Pairing"}</div>
          <div className="card-title">
            {connected ? `Linked${state?.phone ? ` · ${state.phone}` : ""}` : "Scan with WhatsApp"}
          </div>

          {connected ? (
            <p className="card-body">
              This account is linked. Inbound messages now create and enrich People automatically.
            </p>
          ) : qrImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL generated in the browser */}
              <img src={qrImage} alt="WhatsApp pairing QR code" width={220} height={220} style={{ marginTop: "var(--space-3)", borderRadius: "var(--radius-sm)", background: "#fff", padding: 8 }} />
              <p className="card-body" style={{ marginTop: "var(--space-3)" }}>
                WhatsApp → Settings → Linked devices → Link a device. The code refreshes on its own.
              </p>

              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-divider)" }}>
                <p className="card-body" style={{ margin: 0, fontSize: 12, color: MUTED }}>
                  Can't scan? Link with a phone number instead:{" "}
                  <strong>WhatsApp → Settings → Linked devices → Link with phone number</strong>, then
                  type the code below.
                </p>
                {pairingCode ? (
                  <p
                    style={{
                      marginTop: "var(--space-3)",
                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textAlign: "center",
                    }}
                  >
                    {pairingCode}
                  </p>
                ) : (
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
                    <input
                      className="input"
                      type="tel"
                      placeholder="Phone number, with country code"
                      value={phoneNumber}
                      disabled={requestingCode}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={requestingCode || !phoneNumber.trim()}
                      onClick={() => selected && void requestCode(selected)}
                    >
                      {requestingCode ? "Requesting…" : "Get code"}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : stalled ? (
            <>
              <p className="card-body">
                No QR after {waited * 3}s.{" "}
                {diagnostics && !diagnostics.managerConfigured
                  ? "This server has no WhatsApp manager running — WHATSAPP_SESSION_DIR is unset, so no pairing can start at all. That is a server setting, not something you can fix here."
                  : diagnostics && diagnostics.sessionDirWritable === false
                    ? `The session directory (${diagnostics.sessionDir}) is not writable, so the handshake cannot keep its keys. That is a server setting.`
                    : "WhatsApp refuses the new-pairing handshake from datacenter IPs, which is what this server is on — the connection loops without ever producing a code. Resuming a session it already knows is a different handshake, and that one it accepts, so pair once from your own network and hand the result over."}
              </p>

              {diagnostics ? (
                <dl
                  style={{
                    margin: "var(--space-3) 0 0",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "4px var(--space-3)",
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  <dt>Manager</dt>
                  <dd style={{ margin: 0 }}>{diagnostics.managerConfigured ? "running" : "not configured"}</dd>
                  <dt>Session disk</dt>
                  <dd style={{ margin: 0 }}>
                    {diagnostics.sessionDirWritable === null
                      ? "—"
                      : diagnostics.sessionDirWritable
                        ? "writable"
                        : "not writable"}
                  </dd>
                  <dt>Proxy</dt>
                  <dd style={{ margin: 0 }}>{diagnostics.proxyConfigured ? "configured" : "none"}</dd>
                  <dt>Server egress IP</dt>
                  <dd style={{ margin: 0 }}>{diagnostics.egressIp ?? "unknown"}</dd>
                  <dt>Handshake attempts</dt>
                  <dd style={{ margin: 0 }}>
                    {diagnostics.accounts.reduce((n, a) => n + a.attempts, 0)}
                    {diagnostics.accounts.some((a) => a.sawQr) ? " · a QR did arrive at least once" : ""}
                  </dd>
                  {diagnostics.accounts.find((a) => a.lastError) ? (
                    <>
                      <dt>Last error</dt>
                      <dd style={{ margin: 0 }}>
                        {diagnostics.accounts.find((a) => a.lastError)?.lastError}
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
              <p className="card-body" style={{ marginTop: "var(--space-2)" }}>
                Run this on your own machine. It prints the QR in the terminal, then signs in and
                uploads the paired session here on its own:
              </p>
              <pre style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface)", borderRadius: "var(--radius-sm)", fontSize: 12, overflowX: "auto" }}>
{`pnpm --filter @jamot/workers exec tsx src/wa-pair.ts \\
  --api ${typeof window === "undefined" ? "https://api.jamot.pro" : window.location.origin.replace("://", "://api.")} \\
  --email you@example.com --account ${selected}`}
              </pre>
              <p className="card-body" style={{ marginTop: "var(--space-3)" }}>
                Or pair without <code>--api</code> and upload the session directory here:
              </p>
            </>
          ) : (
            <p className="card-body">Waiting for a pairing code…</p>
          )}

          {connected ? null : (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-divider)" }}>
              <label
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", cursor: importing ? "default" : "pointer" }}
              >
                {importing ? "Importing…" : "Import a paired session"}
                <input
                  type="file"
                  multiple
                  /* Chrome and Safari let this pick a whole directory; other
                     browsers fall back to a multi-file picker, which works too. */
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  disabled={importing}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    if (files && files.length > 0 && selected) void importSession(selected, files);
                  }}
                />
              </label>
              <p className="card-body" style={{ marginTop: "var(--space-2)", fontSize: 12, color: MUTED }}>
                Choose the session directory produced by <code>wa-pair</code> (the one holding{" "}
                <code>creds.json</code>). Nothing leaves your machine except that directory.
              </p>
              {imported ? (
                <p className="card-body" style={{ marginTop: "var(--space-2)", fontSize: 12 }}>{imported}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <form className="card" onSubmit={create} style={{ marginTop: "var(--space-4)" }}>
        <div className="card-title">Add a WhatsApp account</div>
        <div className="field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="wa-label">Label</label>
          <input className="input" id="wa-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "var(--space-4)" }}>
          {busy ? "Working…" : "Add account"}
        </button>
      </form>
    </>
  );
}
