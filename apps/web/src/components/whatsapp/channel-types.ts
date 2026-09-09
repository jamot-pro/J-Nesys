export type ChannelProtocol = "whatsapp" | "telegram" | "matrix";

export type AgentAutonomyMode = "autonomous" | "draft" | "disabled";

export interface ChannelAccountItem {
  id: string;
  spaceId: string;
  protocol: ChannelProtocol;
  label: string;
  identifier: string | null; // Phone number for WA, @handle for TG, @user:server for Matrix
  status: "connected" | "pairing" | "connecting" | "offline" | "error";
  createdAt: string;
  unreadCount?: number;
  qr?: string | null;
  connection?: "open" | "connecting" | "close" | null;
}

export interface AutoActorMemory {
  actorId: string;
  jid: string;
  displayName: string;
  avatar?: string;
  role?: string;
  email?: string;
  phone?: string;
  channel: ChannelProtocol;
  firstSeenAt: string;
  lastInteractionAt: string;
  interactionCount: number;
  sentiment: "positive" | "neutral" | "cautious" | "inquiry";
  contextSummary: string;
  memoryNotes: string[];
  preferences: string[];
}

export interface ChatAgentSetting {
  jid: string;
  agentId: string | null;
  agentName?: string;
  autonomy: AgentAutonomyMode;
  customPrompt?: string;
  autoDraftReply?: boolean;
  enabledAt?: string;
}
