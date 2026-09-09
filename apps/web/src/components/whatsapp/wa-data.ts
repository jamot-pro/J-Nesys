export type WaConnection = "connecting" | "open" | "close";

export type WaAccountStatus =
  | "offline"
  | "pairing"
  | "connecting"
  | "connected"
  | "error";

export interface WaAccount {
  id: string;
  spaceId: string;
  label: string;
  phone: string | null;
  status: WaAccountStatus;
  createdAt: string;
  updatedAt: string;
  connection?: WaConnection | null;
  qr?: string | null;
}

export interface WaState {
  connection: WaConnection;
  qr?: string;
}

export interface WaChat {
  jid: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  isGroup: boolean;
}

export interface WaContact {
  jid: string;
  name: string;
}

export interface WaMessage {
  id: string;
  jid: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  mediaType: string | null;
}
