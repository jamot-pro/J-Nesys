/**
 * Structured JSON logging. Never pass secrets (proxy credentials, API keys,
 * cookies) into `fields` — nothing in this module redacts them.
 */
export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export function createLogger(workerId: string): Logger {
  const emit = (level: "info" | "error", event: string, fields?: Record<string, unknown>) => {
    const line = JSON.stringify({
      level,
      event,
      worker_id: workerId,
      ts: new Date().toISOString(),
      ...fields,
    });
    if (level === "error") console.error(line);
    else console.log(line);
  };

  return {
    info: (event, fields) => emit("info", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}
