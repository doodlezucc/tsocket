import { transportWebSocket } from "../src/client/transport-websocket.ts";
import {
  collection,
  endpoint,
  schema,
  unchecked,
  z,
} from "../src/net/index.ts";
import { createSocket } from "../src/net/socket.ts";

const ServerSchema = schema({
  chat: {
    forwardMessage: endpoint({
      accepts: z.object({
        text: z.string(),
      }),
    }),

    messages: collection({
      delete: endpoint(),
    }),
  },

  anotherThing: endpoint({
    accepts: z.object({
      from: z.number(),
      with: z.array(unchecked<{
        name: string;
        description?: string;
      }>()),
    }),
    returns: z.number(),
  }),
});

const socket = createSocket({
  transport: transportWebSocket(new WebSocket("")),
  partnerProcessing: {
    schema: ServerSchema,
  },
});

socket.partner.chat.messages.get("0").delete();

const response = await socket.partner.anotherThing({
  with: [
    { name: "A name", description: "A description" },
  ],
  from: 0,
});

console.log("Response:", response);
