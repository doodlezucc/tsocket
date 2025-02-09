import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";

import { z } from "zod";
import { SchemaAdapter } from "./adapter.ts";
import { collection, endpoint, schema } from "./schema.ts";
import { Socket } from "./socket.ts";

const ServerSchema = schema({
  chat: {
    create: endpoint({
      accepts: z.object({ text: z.string() }),
    }),

    messages: collection({
      delete: endpoint(),
    }),
  },
});

type ServerSchema = typeof ServerSchema;

type AdapterContext = {
  initiatorId: string;
};

class ExampleSocket extends Socket<ServerSchema, AdapterContext> {
  constructor(adapter: SchemaAdapter<ServerSchema, AdapterContext>) {
    super(ServerSchema, adapter);
  }
}

Deno.test("Request parsing", () => {
  const adapter: SchemaAdapter<ServerSchema, AdapterContext> = {
    chat: {
      create({ text }) {
        console.log(`Creating a message with content "${text}"`);
      },

      messages: {
        get(id) {
          const myMessage = {
            delete() {
              console.log(`Deleting message with ID ${id}`);
            },
          };

          return myMessage;
        },
      },
    },
  };

  const socket = new ExampleSocket(adapter);
  using createMessageStub = stub(adapter.chat, "create");

  const adapterContext: AdapterContext = {
    initiatorId: "initiator",
  };

  socket.callEndpoint({
    path: ["chat", "create"],
    params: {
      text: "This is a new message",
    },
  }, adapterContext);

  assertSpyCalls(createMessageStub, 1);
  assertSpyCall(createMessageStub, 0, {
    args: [{ text: "This is a new message" }, adapterContext],
  });
});
