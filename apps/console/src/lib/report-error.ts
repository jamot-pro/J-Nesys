"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ReportableError {
  message: string;
  stack?: string;
  componentStack?: string;
  meta?: Record<string, unknown>;
}

/** Best-effort report of a client-side error to the API's /client-log sink. */
export async function reportError(input: ReportableError): Promise<void> {
  try {
    await fetch(`${API_URL}/api/client-log`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // logging must never itself throw
  }
}

/** Wire global error + unhandledrejection handlers once (idempotent). */
let installed = false;
export function installGlobalErrorReporting(): void {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    void reportError({
      message: event.message || "window error",
      stack: event.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void reportError({
      message:
        reason instanceof Error
          ? reason.message
          : `Unhandled rejection: ${String(reason)}`,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}