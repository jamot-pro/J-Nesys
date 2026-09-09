import type { NextRequest } from "next/server";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { createOpenAI } from "@ai-sdk/openai";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DEFAULT_PROMPT =
  "You are the Jamot Main Manager. Help plan, delegate and track work. Delegate to searchPeople/searchAgents tools when available. Handle supplier procurement: register suppliers, review POs. High-risk actions must wait for explicit confirmation.";
const BUILDER_PROMPT =
  "You are the Jamot Agent Builder. Help users design and create agents. Ask for name, role, autonomy level (suggest/approve/autonomous), and channels. Then call createAgent.";
const SKILLS_PROMPT =
  "You are the Jamot Skill Assistant. Help users author and improve skills in Markdown. Produce FULL revised Markdown on modification requests.";
const DREAM_PROMPT =
  "You are the Vibe DREAM Configurator. You configure the organization's DREAM and its surrounding org graph (TEAMS, HUMANS+AGENTS, RESPONSIBILITIES, TOOLS, HEARTBEATS). Help users define the DREAM naturally (objectives, outcomes, KPIs, constraints, timeline, required capabilities and responsibilities) and turn it into a configured, resilient organization. You can PERFORM configuration actions via the frontend tools: configureDream, createTeam, createHeartbeat, createResponsibility, addTool, connectNodes, assignResponsibility, moveMemberToTeam, createAgent. Reason responsibility-first: DREAM -> required responsibilities -> owners. Uncover missing owners, missing heartbeats, and gaps, and act to resolve them. The DREAM orchestration skill is platform-owned and not user-editable.";

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
 * Resolve the chat model from the platform's Settings configuration
 * (Settings > Models) by calling the API's /models/runtime with the user's
 * session cookie. Falls back to env vars when the API is unreachable.
 */
async function resolveChatModel(req: NextRequest): Promise<{
  modelId: string;
  kind: "openai" | "anthropic";
  apiKey: string;
  baseUrl: string | null;
}> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const orgId = req.cookies.get("jamot_active_org")?.value;

  try {
    if (cookieHeader) {
      const url = new URL(`${API_URL}/api/models/runtime`);
      if (orgId) url.searchParams.set("organizationId", orgId);
      const res = await fetch(url.toString(), {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as RuntimeModelResponse;
        if (data.configured && data.apiKey && data.kind && data.model) {
          console.log(
            "[copilotkit] resolved model:",
            data.providerName ?? data.model,
            data.baseUrl ? "@" + data.baseUrl : "",
          );
          return {
            modelId: data.model,
            kind: data.kind,
            apiKey: data.apiKey,
            baseUrl: data.baseUrl ?? null,
          };
        }
        console.warn("[copilotkit] runtime not configured, reason:", data.reason ?? "unknown");
      } else {
        console.warn("[copilotkit] runtime status:", res.status);
      }
    }
  } catch (err) {
    console.error("[copilotkit] resolve error:", err instanceof Error ? err.message : String(err));
  }

  // Fallback to env vars.
  console.log("[copilotkit] using env fallback");
  const modelId = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return {
    modelId,
    kind: "openai",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseUrl: process.env.OPENAI_BASE_URL ?? null,
  };
}

function buildModel(input: { modelId: string; kind: string; apiKey: string; baseUrl: string | null }) {
  // Custom OpenAI-compatible endpoint -> use @ai-sdk/openai with baseURL.
  if (input.baseUrl && input.apiKey) {
    const provider = createOpenAI({ apiKey: input.apiKey, baseURL: input.baseUrl });
    return provider(input.modelId);
  }
  return `${input.kind}/${input.modelId}`;
}

async function buildRuntime(req: NextRequest) {
  const resolved = await resolveChatModel(req);
  const model = buildModel(resolved);

  const runtime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({ model, apiKey: resolved.apiKey, prompt: DEFAULT_PROMPT, maxSteps: 5 }),
      builder: new BuiltInAgent({ model, apiKey: resolved.apiKey, prompt: BUILDER_PROMPT, maxSteps: 6 }),
      skills: new BuiltInAgent({ model, apiKey: resolved.apiKey, prompt: SKILLS_PROMPT, maxSteps: 4 }),
      dream: new BuiltInAgent({ model, apiKey: resolved.apiKey, prompt: DREAM_PROMPT, maxSteps: 8 }),
    },
    a2ui: {},
  });

  return copilotRuntimeNextJSAppRouterEndpoint({ runtime, endpoint: "/api/copilotkit" });
}

async function handler(req: NextRequest) {
  try {
    console.log("[copilotkit] REQUEST method=", req.method, "path=", req.nextUrl.pathname);
    const { handleRequest } = await buildRuntime(req);
    const result = await handleRequest(req);
    console.log("[copilotkit] RESPONSE status=", result?.status);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[copilotkit] HANDLER ERROR:", msg);
    return new Response(
      JSON.stringify({ error: "CopilotKit error: " + msg }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const runtime = "nodejs";
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
export const HEAD = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;