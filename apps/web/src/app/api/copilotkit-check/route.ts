import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Diagnostic: call this from the browser while logged in.
 * Shows whether the session cookie reaches this server and whether the
 * model provider can be resolved for the authenticated user.
 */
export const GET = async (req: NextRequest) => {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const host = req.headers.get("host") ?? "(none)";
  const orgId = req.cookies.get("jamot_active_org")?.value;
  const hasSession = /(^|;\s*)jamot_session=/.test(cookieHeader);

  let runtime: Record<string, unknown> = { attempted: false };
  if (cookieHeader) {
    try {
      const url = new URL(`${API_URL}/api/models/runtime`);
      if (orgId) url.searchParams.set("organizationId", orgId);
      const res = await fetch(url.toString(), {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      runtime = { attempted: true, status: res.status, body };
    } catch (err) {
      runtime = {
        attempted: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    note: "CopilotKit debug — paste this JSON to the assistant",
    request: { host, orgId: orgId ?? "(unset)", has_jamot_session: hasSession, cookie_length: cookieHeader.length },
    api_url: API_URL,
    model_runtime: runtime,
  });
};