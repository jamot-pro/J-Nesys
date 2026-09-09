"use client";

import { useEffect, useRef } from "react";

import { API_URL } from "@/components/auth/auth-context";

export interface StreamEvent {
  id?: string;
  type: string;
  spaceId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

/**
 * Subscribe to live events for a space via SSE. The connection tails the
 * server's events outbox; no frontend polling needed.
 */
export function useEventStream(
  spaceId: string | null | undefined,
  onEvent: (event: StreamEvent) => void,
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!spaceId || typeof EventSource === "undefined") return;

    const source = new EventSource(
      `${API_URL}/api/events/stream?spaceId=${encodeURIComponent(spaceId)}`,
      { withCredentials: true },
    );

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamEvent;
        if (event && event.type) handlerRef.current(event);
      } catch {
        // ignore malformed frames
      }
    };

    return () => source.close();
  }, [spaceId]);
}
