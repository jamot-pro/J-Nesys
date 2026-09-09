export const DREAM_CONFIG_EVENT = "jamot:dream-config";

export interface DreamConfigEventDetail {
  objective?: string;
}

/**
 * Open the DREAM conversational configurator in the main chat. The chat
 * workspace listens for this event and pre-fills a prompt so the agent can
 * guide configuring the organization's DREAM.
 */
export function openDreamConfig(objective?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DreamConfigEventDetail>(DREAM_CONFIG_EVENT, {
      detail: { objective },
    }),
  );
}