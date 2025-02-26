import { array, optional } from "../src/binary/data-type.ts";
import { transportWebSocket } from "../src/client/index.ts";
import {
  collection,
  createSocket,
  endpoint,
  schema,
} from "../src/net/index.ts";

const ServerSchema = schema({
  chat: {
    forwardMessage: endpoint()
      .accepts({
        text: "string",
      }),

    messages: collection({
      delete: endpoint(),
    }),
  },

  anotherThing: endpoint()
    .accepts({
      from: "int",
      with: array({
        name: "string",
        description: optional("string"),
      }),
    })
    .returns("string"),
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
