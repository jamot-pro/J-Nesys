import type { Harness } from "@jamot/contracts";
import type { HarnessClient } from "./harness.js";
import { createGenericHttpHarness } from "./generic-http.js";
import { createMcpHarness } from "./mcp.js";

export type HarnessFactory = (harness: Harness) => HarnessClient;

export interface HarnessRegistry {
  register(kind: string, factory: HarnessFactory): void;
  resolve(harness: Harness): HarnessClient;
}

export function createHarnessRegistry(): HarnessRegistry {
  const factories = new Map<string, HarnessFactory>();

  function register(kind: string, factory: HarnessFactory): void {
    factories.set(kind, factory);
  }

  function resolve(harness: Harness): HarnessClient {
    const factory = factories.get(harness.kind);
    if (!factory) {
      throw new Error(`unsupported harness kind: ${harness.kind}`);
    }
    return factory(harness);
  }

  register("generic_http", (harness) => {
    if (!harness.endpoint) {
      throw new Error("generic_http harness requires an endpoint");
    }
    return createGenericHttpHarness(harness.endpoint);
  });

  register("mcp", (harness) => {
    if (!harness.endpoint) {
      throw new Error("mcp harness requires an endpoint");
    }
    return createMcpHarness(harness.endpoint);
  });

  return { register, resolve };
}
