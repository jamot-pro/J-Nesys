"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the root-level render/hydration error so it can be diagnosed from
    // the API's server logs without a browser.
    try {
      void fetch(`${API_URL}/api/client-log`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
        }),
      });
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0d0d0d",
          color: "#f0f0f0",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            padding: 24,
            border: "1px solid rgba(239,68,68,.35)",
            borderRadius: 12,
            background: "#161616",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#f87171" }}>
            <AlertTriangle size={18} />
            Something went wrong rendering this page
          </div>
          <p style={{ color: "#a1a1aa", fontSize: 13 }}>This error was logged. Reloading may recover.</p>
          {error.message ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                color: "#c7c7c7",
                margin: "12px 0",
                background: "#0d0d0d",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: 0,
              background: "#8b5cf6",
              color: "#fff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RefreshCcw size={14} />
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}