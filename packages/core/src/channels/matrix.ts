import { createClient, EventType, MsgType, RoomEvent } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";
import type { ChannelAdapter, InboundMessage } from "./channel.js";

export interface MatrixAdapterOpts {
  id?: string;
  homeserver: string;
  userId: string;
  accessToken: string;
}

export function createMatrixAdapter(opts: MatrixAdapterOpts): ChannelAdapter {
  const id = opts.id ?? "matrix";
  const handlers = new Set<(msg: InboundMessage) => void>();
  let client: MatrixClient | undefined;

  return {
    id,
    kind: "matrix",

    async connect() {
      client = createClient({
        baseUrl: opts.homeserver,
        userId: opts.userId,
        accessToken: opts.accessToken,
      });

      client.on(RoomEvent.Timeline, (event, room) => {
        if (event.getType() !== EventType.RoomMessage) return;
        const content = event.getContent();
        if (content.msgtype !== MsgType.Text) return;
        const text = content.body as string | undefined;
        if (!text) return;
        const sender = event.getSender();
        if (!sender) return;
        for (const handler of handlers) {
          handler({
            channelId: id,
            kind: "matrix",
            sender,
            text,
            timestamp: new Date(event.getTs()).toISOString(),
            room: event.getRoomId() ?? room?.roomId,
            raw: content,
          });
        }
      });

      await client.startClient();
    },

    async disconnect() {
      if (client) {
        client.stopClient();
        client = undefined;
      }
    },

    async send(recipient, text) {
      if (!client) throw new Error("matrix adapter not connected");
      await client.sendMessage(recipient, { msgtype: MsgType.Text, body: text });
    },

    onMessage(handler) {
      handlers.add(handler);
    },
  };
}