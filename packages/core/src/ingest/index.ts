export {
  createWhatsAppPersonProvisioner,
  WHATSAPP_IDENTITY_PROVIDER,
} from "./wa-person.js";
export type {
  IngestRepo,
  ProvisionResult,
  WhatsAppPersonProvisioner,
  WhatsAppPersonProvisionerDeps,
} from "./wa-person.js";
export { createChannelPersonProvisioner } from "./channel-person.js";
export type {
  ChannelPersonIngestRepo,
  ChannelPersonProvisioner,
  ChannelPersonProvisionerDeps,
  ChannelProvisionResult,
} from "./channel-person.js";