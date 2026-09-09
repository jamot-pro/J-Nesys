import type {
  HarnessClient,
  HarnessRequest,
  HarnessResponse,
} from "./harness.js";
import { createMcpClient } from "../mcp/client.js";

function toOutput(result: unknown): string {
  if (typeof result === "string") return result;
  if (
    result !== null &&
    typeof result === "object" &&
    "content" in result
  ) {
    const content = (result as { content: unknown }).content;
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (part !== null && typeof part === "object" && "text" in part) {
            return String((part as { text: unknown }).text);
          }
          return JSON.stringify(part);
        })
        .join("\n");
      return text;
    }
  }
  return JSON.stringify(result);
}

export function createMcpHarness(
  endpoint: string,
  headers?: Record<string, string>,
): HarnessClient {
  const client = createMcpClient(endpoint, headers);
  let cachedToolName: string | null = null;

  return {
    kind: "mcp",
    async run(req: HarnessRequest): Promise<HarnessResponse> {
      if (cachedToolName === null) {
        const tools = await client.listTools();
        const runTool = tools.find((tool) => tool.name === "run");
        cachedToolName = (runTool ?? tools[0])?.name ?? null;
      }
      if (cachedToolName === null) {
        throw new Error(`mcp harness at ${endpoint} exposes no callable tools`);
      }
      const result = await client.callTool(cachedToolName, {
        prompt: req.prompt,
        taskId: req.taskId,
      });
      return { output: toOutput(result) };
    },
  };
}
