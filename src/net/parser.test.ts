import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";

import { z } from "zod";
import { SchemaAdapter } from "./adapter.ts";
import { createParser } from "./parser.ts";
import { collection, endpoint, schema } from "./schema.ts";

type TestSchema = typeof TestSchema;
const TestSchema = schema({
  chat: {
    create: endpoint().accepts({
      text: z.string(),
    }),

    messages: collection({
      delete: endpoint(),
    }),
  },
});

interface AdapterContext {
  initiatorId: string;
}

Deno.test("Request parsing", () => {
  const adapter: SchemaAdapter<TestSchema, AdapterContext> = {
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

  const parser = createParser(TestSchema, adapter);
  using createMessageStub = stub(adapter.chat, "create");

  const adapterContext: AdapterContext = {
    initiatorId: "initiator",
  };

  parser.callEndpoint({
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
