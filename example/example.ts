import { z } from "zod";
import { transportWebSocket } from "../src/client/index.ts";
import {
  collection,
  createSocket,
  endpoint,
  schema,
  unchecked,
} from "../src/net/index.ts";

const ServerSchema = schema({
  chat: {
    forwardMessage: endpoint()
      .accepts({
        text: z.string(),
      }),

    messages: collection({
      delete: endpoint(),
    }),
  },

  anotherThing: endpoint()
    .accepts({
      from: z.number(),
      with: z.array(unchecked<{
        name: string;
        description?: string;
      }>()),
    })
    .returns(z.number()),
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
