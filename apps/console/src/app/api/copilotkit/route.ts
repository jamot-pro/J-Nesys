import type { NextRequest } from "next/server";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { createOpenAI } from "@ai-sdk/openai";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * The console's chat is the mockup's: "Ask about the organization, or instruct
 * a change." The prompt is written to that brief rather than copied from the
 * cockpit's Main Manager, because the surfaces differ — this one answers for a
 * single organization and drives the console's own sections.
 */
const CONSOLE_PROMPT = [
  "You are the Jamot organization console assistant.",
  "You answer questions about the organization the user is currently in, and carry out changes they ask for.",
  "Be concise and concrete. Prefer doing over explaining.",
  "When an action is destructive, irreversible, or spends money, describe what you are about to do and wait for explicit confirmation.",
  "If a capability is not yet available in this console, say so plainly rather than pretending to act.",
].join(" ");

interface RuntimeModelResponse {
  configured: boolean;
  kind?: "openai" | "anthropic";
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  providerName?: string;
  reason?: string;
}

/**
 * Resolve the chat model from the platform's own configuration by calling the
 * API's /models/runtime with the user's session cookie.
 *
 * Model choice, keys and per-organization preference stay backend-owned: this
 * route holds no credentials of its own beyond an optional env fallback for
 * local development.
 */
async function resolveChatModel(req: NextRequest): Promise<{
  modelId: string;
  kind: "openai" | "anthropic";
  apiKey: string;
  baseUrl: string | null;
  configured: boolean;
  reason?: string;
}> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  try {
    if (cookieHeader) {
      const res = await fetch(`${API_URL}/api/models/runtime`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as RuntimeModelResponse;
        if (data.configured && data.apiKey && data.kind && data.model) {
          return {
            modelId: data.model,
            kind: data.kind,
            apiKey: data.apiKey,
            baseUrl: data.baseUrl ?? null,
            configured: true,
          };
        }
        return {
          modelId: "",
          kind: "openai",
          apiKey: "",
          baseUrl: null,
          configured: false,
          reason: data.reason ?? "no model provider is configured",
        };
      }
    }
  } catch (err) {
    console.error("[copilotkit] model resolution failed:", err instanceof Error ? err.message : String(err));
  }

  // Local-development fallback only; production resolves through the API.
  const envKey = process.env.OPENAI_API_KEY ?? "";
  return {
    modelId: process.env.OPENAI_MODEL || "gpt-4o-mini",
    kind: "openai",
    apiKey: envKey,
    baseUrl: process.env.OPENAI_BASE_URL ?? null,
    configured: Boolean(envKey),
    reason: envKey ? undefined : "no session model and no OPENAI_API_KEY",
  };
}

function buildModel(input: { modelId: string; kind: string; apiKey: string; baseUrl: string | null }) {
  if (input.baseUrl && input.apiKey) {
    return createOpenAI({ apiKey: input.apiKey, baseURL: input.baseUrl })(input.modelId);
  }
  return `${input.kind}/${input.modelId}`;
}

async function handler(req: NextRequest) {
  try {
    const resolved = await resolveChatModel(req);

    // Fail loudly and specifically rather than letting the SDK throw something
    // opaque: "no model configured" is the single most likely reason chat does
    // not work, and the user can act on it.
    if (!resolved.configured) {
      return new Response(
        JSON.stringify({
          error: `Chat is not available: ${resolved.reason ?? "no model provider is configured"}. Configure one in Settings → Models.`,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const runtime = new CopilotRuntime({
      agents: {
        default: new BuiltInAgent({
          model: buildModel(resolved),
          apiKey: resolved.apiKey,
          prompt: CONSOLE_PROMPT,
          maxSteps: 5,
        }),
      },
      a2ui: {},
    });

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      endpoint: "/api/copilotkit",
    });
    return await handleRequest(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[copilotkit] handler error:", msg);
    return new Response(JSON.stringify({ error: `CopilotKit error: ${msg}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const runtime = "nodejs";
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
export const HEAD = handler;
export const PUT = handler;
export const DELETE = handler;
