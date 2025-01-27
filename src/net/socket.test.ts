import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";

import { Schema, SchemaAdapter } from "./schema.ts";
import { Socket } from "./socket.ts";

type ServerSchema = Schema<{
  chat: {
    create(options: { text: string }): void;
    messages: {
      delete(): void;
    }[];
  };
}>;

type AdapterContext = {
  initiatorId: string;
};

class ExampleSocket extends Socket<ServerSchema, AdapterContext> {
  constructor(adapter: SchemaAdapter<ServerSchema, AdapterContext>) {
    super(adapter);
  }
}

Deno.test("Request parsing", () => {
  const adapter: SchemaAdapter<ServerSchema, AdapterContext> = {
    chat: {
      create(_context, { text }) {
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

  socket.handleIncomingMessage(adapterContext, {
    request: {
      chat: {
        create: {
          text: "This is a new message",
        },
      },
    },
  });

  assertSpyCalls(createMessageStub, 1);
  assertSpyCall(createMessageStub, 0, {
    args: [adapterContext, { text: "This is a new message" }],
  });
});
