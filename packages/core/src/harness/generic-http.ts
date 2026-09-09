import type {
  HarnessClient,
  HarnessRequest,
  HarnessResponse,
} from "./harness.js";

export function createGenericHttpHarness(endpoint: string): HarnessClient {
  return {
    kind: "generic_http",
    async run(req: HarnessRequest): Promise<HarnessResponse> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: req.prompt, taskId: req.taskId }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`generic-http harness returned ${res.status}: ${text.slice(0, 200)}`);
      }

      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "output" in parsed &&
            typeof (parsed as { output: unknown }).output === "string"
          ) {
            return { output: (parsed as { output: string }).output };
          }
        } catch {
          // fall through to plain-text output
        }
      }
      return { output: text };
    },
  };
}
