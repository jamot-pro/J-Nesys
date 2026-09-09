import type { MemoryEntry, MemoryProvider } from "./memory.js";

/**
 * A write-only projection of memories into a secondary store.
 *
 * `store`/`update` receive the FULL post-primary entry (including the id the
 * primary generated) — unlike `MemoryProvider.store`, which only accepts input
 * without an id. This is what lets a mirror key its records on the primary's id.
 */
export interface MemoryMirror {
  name: string;
  store(entry: MemoryEntry): Promise<void>;
  update(entry: MemoryEntry): Promise<void>;
  forget(id: string): Promise<void>;
}

/**
 * Wraps a primary `MemoryProvider` (source of truth for reads) with a
 * `MemoryMirror` that is written in parallel. Mirror failures are logged and
 * swallowed — they must never break or slow down the primary write path.
 */
export function createDualWriteMemoryProvider(
  primary: MemoryProvider,
  mirror: MemoryMirror,
): MemoryProvider {
  const log = (err: unknown): void => {
    console.warn(
      `[memory:${mirror.name}] mirror ${typeof err === "string" ? err : (err instanceof Error ? err.message : String(err))}`,
    );
  };

  return {
    async store(input) {
      const entry = await primary.store(input);
      try {
        await mirror.store(entry);
      } catch (err) {
        log(err);
      }
      return entry;
    },

    get(id) {
      return primary.get(id);
    },

    list(filter) {
      return primary.list(filter);
    },

    async update(id, patch) {
      const entry = await primary.update(id, patch);
      if (entry) {
        try {
          await mirror.update(entry);
        } catch (err) {
          log(err);
        }
      }
      return entry;
    },

    async forget(id) {
      await primary.forget(id);
      try {
        await mirror.forget(id);
      } catch (err) {
        log(err);
      }
    },
  };
}
