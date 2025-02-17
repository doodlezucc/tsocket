import { assertEquals } from "@std/assert/equals";
import { assertSpyCall, assertSpyCalls, spy } from "@std/testing/mock";
import { z } from "zod";
import { ControlledChannel } from "./helpers.test.ts";
import { createParser } from "./parser.ts";
import { endpoint, schema } from "./schema.ts";
import { createSocket, RequestTransport } from "./socket.ts";

const serverSchema = schema({
  createMessage: endpoint({
    accepts: z.object({
      text: z.string(),
    }),
    returns: z.string(),
  }),
});

interface ServerAdapterContext {
  connectionId: string;
}

const clientSchema = schema({
  onMessagePosted: endpoint({
    accepts: z.object({
      messageId: z.string(),
    }),
  }),
});

Deno.test("Socket over request transport", async () => {
  const parser = createParser(
    serverSchema,
    { connectionId: "connection-id" } as ServerAdapterContext,
    {
      createMessage({ text }, { connectionId }) {
        console.log(`Creating message "${text}" (by ${connectionId})`);
        return "message-id";
      },
    },
  );

  const requestTransport: RequestTransport = {
    async request(endpoint, expectResponse) {
      if (expectResponse) {
        console.log(`Requesting ${endpoint.path}`);
        return await parser.callEndpoint(endpoint);
      } else {
        console.log(`Dispatching ${endpoint.path}`);
        parser.callEndpoint(endpoint);
      }
    },
  };

  const socket = createSocket({
    transport: requestTransport,
    partnerProcessing: {
      schema: serverSchema,
    },
  });

  const messageId = await socket.partner.createMessage({
    text: "My new message",
  });

  assertEquals(messageId, "message-id");
});

Deno.test("Socket over channel transport", async (t) => {
  const channelServerToClient = new ControlledChannel((outgoingMessage) =>
    channelClientToServer.simulateIncomingMessage(outgoingMessage)
  );
  const channelClientToServer = new ControlledChannel((outgoingMessage) =>
    channelServerToClient.simulateIncomingMessage(outgoingMessage)
  );

  await t.step("Onesided sockets", async () => {
    const createMessageSpy = spy(({ text }, { connectionId }) => {
      console.log(`Creating message "${text}" (by ${connectionId})`);
      return "message-id";
    });

    const serverSocket = createSocket({
      transport: channelServerToClient,
      localProcessing: {
        parser: createParser(
          serverSchema,
          { connectionId: "connection-id" } as ServerAdapterContext,
          {
            createMessage: createMessageSpy,
          },
        ),
      },
    });

    const clientSocket = createSocket({
      transport: channelClientToServer,
      partnerProcessing: {
        schema: serverSchema,
      },
    });

    const createdMessageId = await clientSocket.partner.createMessage({
      text: "My new message",
    });

    assertSpyCalls(createMessageSpy, 1);
    assertSpyCall(createMessageSpy, 0, {
      args: [
        { text: "My new message" },
        { connectionId: "connection-id" },
      ],
    });

    assertEquals(createdMessageId, "message-id");

    clientSocket.dispose();
    serverSocket.dispose();
  });

  await t.step("Local and partner processing", async () => {
    const createMessageSpy = spy(({ text }, { connectionId }) => {
      console.log(`Creating message "${text}" (by ${connectionId})`);
      return "message-id";
    });

    const serverSocket = createSocket({
      transport: channelServerToClient,
      localProcessing: {
        parser: createParser(
          serverSchema,
          { connectionId: "connection-id" } as ServerAdapterContext,
          {
            createMessage: createMessageSpy,
          },
        ),
      },
      partnerProcessing: {
        schema: clientSchema,
      },
    });

    const onMessagePostedSpy = spy(({ messageId }) => {
      console.log(`Message ${messageId} was posted`);
    });

    const clientSocket = createSocket({
      transport: channelClientToServer,
      localProcessing: {
        parser: createParser(clientSchema, {
          onMessagePosted: onMessagePostedSpy,
        }),
      },
      partnerProcessing: {
        schema: serverSchema,
      },
    });

    const createdMessageId = await clientSocket.partner.createMessage({
      text: "My new message",
    });

    assertEquals(createdMessageId, "message-id");
    assertSpyCalls(createMessageSpy, 1);
    assertSpyCall(createMessageSpy, 0, {
      args: [
        { text: "My new message" },
        { connectionId: "connection-id" },
      ],
    });

    serverSocket.partner.onMessagePosted({
      messageId: "message-id",
    });

    assertSpyCalls(onMessagePostedSpy, 1);
    assertSpyCall(onMessagePostedSpy, 0, {
      args: [{ messageId: "message-id" }, undefined],
    });

    clientSocket.dispose();
    serverSocket.dispose();
  });
});
