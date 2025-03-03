import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";

import { assertEquals } from "@std/assert";
import { SchemaAdapter } from "./adapter.ts";
import { createParser } from "./parser.ts";
import { collection, endpoint, schema } from "./schema.ts";

type TestSchema = typeof TestSchema;
const TestSchema = schema({
  chat: {
    create: endpoint().accepts({
      text: "string",
    }),

    messages: collection({
      delete: endpoint().returns("string"),
    }),
  },
});

interface AdapterContext {
  initiatorId: string;
}

Deno.test("Request parsing", () => {
  const deleteMessageSpy = spy((id: number) => {
    console.log(`Deleting message with ID ${id}`);
  });

  const adapter: SchemaAdapter<TestSchema, AdapterContext> = {
    chat: {
      create({ text }) {
        console.log(`Creating a message with content "${text}"`);
      },

      messages: {
        get(id) {
          const myMessage = {
            delete() {
              deleteMessageSpy(id);
              return "ok";
            },
          };

          return myMessage;
        },
      },
    },
  };

  const parser = createParser(TestSchema, { adapter });
  using createMessageStub = stub(adapter.chat, "create");

  const adapterContext: AdapterContext = {
    initiatorId: "initiator",
  };

  parser.callEndpoint({
    endpointIndex: 0,
    collectionIndices: [],
    params: {
      text: "This is a new message",
    },
  }, adapterContext);

  assertSpyCalls(createMessageStub, 1);
  assertSpyCall(createMessageStub, 0, {
    args: [{ text: "This is a new message" }, adapterContext],
  });

  const result = parser.callEndpoint({
    endpointIndex: 1,
    collectionIndices: [1234],
  }, adapterContext);

  assertSpyCalls(deleteMessageSpy, 1);
  assertSpyCall(deleteMessageSpy, 0, {
    args: [1234],
  });

  assertEquals(result, "ok");
});
