import { transportWebSocket } from "../src/client/index.ts";
import { array, optional } from "../src/net/binary/data-type.ts";
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

    messages: collection("string", {
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

const clientSocket = createSocket({
  transport: transportWebSocket(new WebSocket("http://localhost:8080/ws")),
  partnerProcessing: {
    schema: ServerSchema,
  },
});

clientSocket.partner.chat.messages.get("0").delete();

const response = await clientSocket.partner.anotherThing({
  with: [
    { name: "A name", description: "A description" },
  ],
  from: 0,
});

console.log("Response:", response);
