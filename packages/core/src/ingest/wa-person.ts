import type { InboundMessage } from "../channels/channel.js";
import {
  createChannelPersonProvisioner,
  type ChannelPersonIngestRepo,
  type ChannelProvisionResult,
  type ChannelPersonProvisioner,
} from "./channel-person.js";

export const WHATSAPP_IDENTITY_PROVIDER = "whatsapp";

/** WhatsApp ingestion delegates to the channel-general identity resolver. */
export type IngestRepo = ChannelPersonIngestRepo;
export type ProvisionResult = ChannelProvisionResult;

export type WhatsAppPersonProvisioner = ChannelPersonProvisioner;

export interface WhatsAppPersonProvisionerDeps {
  repo: IngestRepo;
  /** Resolve the space a new contact should belong to from the channel. */
  spaceResolver?: (channelId: string) => Promise<string | undefined>;
}

export function createWhatsAppPersonProvisioner(
  deps: WhatsAppPersonProvisionerDeps,
): WhatsAppPersonProvisioner {
  return createChannelPersonProvisioner({
    repo: deps.repo,
    spaceResolver: deps.spaceResolver,
    providerOf: () => WHATSAPP_IDENTITY_PROVIDER,
  });
}
