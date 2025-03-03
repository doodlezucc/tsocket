import {
  assertEquals,
  assertGreater,
  assertLessOrEqual,
  assertRejects,
} from "@std/assert";
import { assertSpyCall, spy } from "@std/testing/mock";
import { oneOf } from "../binary/data-type.ts";
import { ControlledChannel } from "../helpers.test.ts";
import { createParser } from "../parser.ts";
import { collection, endpoint, schema } from "../schema.ts";
import { createSocket } from "../socket.ts";
import { codecBinary } from "./codec-binary.ts";
import { ChannelTransportFactory } from "./transport.ts";

enum AreaStatus {
  Unvisited,
  Visited,
}

const ServerSchema = schema({
  sandbox: {
    increaseCounter: endpoint(),

    areas: collection({
      setStatus: endpoint()
        .accepts(oneOf(AreaStatus))
        .returns({
          processedAreaId: "int",
          status: oneOf(AreaStatus),
        }),

      throwAnError: endpoint().returns("boolean"),
    }),
  },

  community: {
    users: collection("string", {
      updateNickname: endpoint().accepts("string"),

      posts: collection({
        update: endpoint().accepts({
          content: "string",
        }).returns("boolean"),

        delete: endpoint(),
      }),
    }),
  },
});

const PingSchema = schema({
  ping: endpoint().returns("int"),
});

Deno.test("Bidirectional binary channel transport", async () => {
  // Setup bidirectional communication between two sockets with binary transport
  let channelClientToServer: ControlledChannel<ArrayBuffer>;
  let channelServerToClient: ControlledChannel<ArrayBuffer>;

  const codecFactory = codecBinary();

  const transportClientToServer: ChannelTransportFactory = {
    create: (schemas) =>
      channelClientToServer = new ControlledChannel({
        codec: codecFactory.create(schemas),
        onSend(outgoingMessage) {
          console.log("\n[CLIENT --> SERVER]:", outgoingMessage);
          channelServerToClient.simulateIncomingMessage(outgoingMessage);
        },
      }),
  };
  const transportServerToClient: ChannelTransportFactory = {
    create: (schemas) =>
      channelServerToClient = new ControlledChannel({
        codec: codecFactory.create(schemas),
        onSend(outgoingMessage) {
          console.log("\n[SERVER --> CLIENT]:", outgoingMessage);
          channelClientToServer.simulateIncomingMessage(outgoingMessage);
        },
      }),
  };

  // Define the client's schema adapter with spy functions
  const pingSpy = spy(() => {
    console.log("Processing ping command client-side");
    return Date.now();
  });
  const clientSocket = createSocket({
    transport: transportClientToServer,
    partnerProcessing: {
      schema: ServerSchema,
    },
    localProcessing: {
      parser: createParser(PingSchema, {
        adapter: {
          ping: () => pingSpy(),
        },
      }),
    },
  });

  // Define the server's schema adapter with spy functions
  const updateNicknameSpy = spy((userId: string, nickname: string) => {
    console.log(`Updating nickname of user "${userId}" to ${nickname}`);
  });
  const updatePostSpy = spy(
    (userId: string, postId: number, content: string) => {
      console.log(
        `Updating post ${postId} (user: "${userId}") content to "${content}"`,
      );
      return true;
    },
  );
  const deletePostSpy = spy((userId: string, postId: number) => {
    console.log(`Deleting post ${postId} by user "${userId}"`);
  });

  const increaseCounterSpy = spy(() => {
    console.log(`Increasing global counter`);
  });
  const setAreaStatusSpy = spy((areaId: number, status: AreaStatus) => {
    console.log(`Setting area status (id: ${areaId}) to ${status}`);
    return {
      processedAreaId: areaId,
      status: status,
    };
  });

  const serverSocket = createSocket({
    transport: transportServerToClient,
    partnerProcessing: {
      schema: PingSchema,
    },
    localProcessing: {
      parser: createParser(ServerSchema, {
        adapter: {
          community: {
            users: {
              get: (userId) => ({
                updateNickname: (nickname) =>
                  updateNicknameSpy(userId, nickname),

                posts: {
                  get: (postId) => ({
                    update: ({ content }) =>
                      updatePostSpy(userId, postId, content),

                    delete: () => deletePostSpy(userId, postId),
                  }),
                },
              }),
            },
          },
          sandbox: {
            increaseCounter: () => increaseCounterSpy(),
            areas: {
              get: (areaId) => ({
                setStatus: (status) => setAreaStatusSpy(areaId, status),
                throwAnError: () => {
                  throw new Error(`Error thrown from area ${areaId}`);
                },
              }),
            },
          },
        },
      }),
    },
  });

  const pingResult = await serverSocket.partner.ping();
  assertLessOrEqual(pingResult, Date.now());
  assertSpyCall(pingSpy, 0, { args: [] });

  clientSocket.partner.sandbox.increaseCounter();
  assertSpyCall(increaseCounterSpy, 0, { args: [] });

  const setStatusResult = await clientSocket.partner.sandbox.areas.get(51)
    .setStatus(AreaStatus.Visited);
  assertSpyCall(setAreaStatusSpy, 0, { args: [51, AreaStatus.Visited] });

  clientSocket.partner.community.users.get("user-1").updateNickname("Nick");
  assertSpyCall(updateNicknameSpy, 0, { args: ["user-1", "Nick"] });

  clientSocket.partner.community.users.get("user-1").posts.get(0).delete();
  assertSpyCall(deletePostSpy, 0, { args: ["user-1", 0] });

  const updatePostResult = await clientSocket.partner.community
    .users.get("user-1")
    .posts.get(1234)
    .update({
      content: "This is my first updated post",
    });
  assertSpyCall(updatePostSpy, 0, {
    args: ["user-1", 1234, "This is my first updated post"],
  });

  assertRejects(
    () => clientSocket.partner.sandbox.areas.get(505).throwAnError(),
    Error,
    "Error thrown from area 505",
  );

  const secondSetStatusResult = await clientSocket.partner.sandbox
    .areas.get(12345678)
    .setStatus(AreaStatus.Unvisited);
  assertSpyCall(setAreaStatusSpy, 1, {
    args: [12345678, AreaStatus.Unvisited],
  });

  // Assert that the client has received responses for all requests
  assertEquals(setStatusResult, {
    processedAreaId: 51,
    status: AreaStatus.Visited,
  });
  assertEquals(updatePostResult, true);
  assertEquals(secondSetStatusResult, {
    processedAreaId: 12345678,
    status: AreaStatus.Unvisited,
  });

  clientSocket.dispose();
  serverSocket.dispose();
});

Deno.test("One-sided binary channel transport", async () => {
  // Setup bidirectional communication between two sockets with binary transport
  let channelClientToServer: ControlledChannel<ArrayBuffer>;
  let channelServerToClient: ControlledChannel<ArrayBuffer>;

  const codecFactory = codecBinary();

  const transportClientToServer: ChannelTransportFactory = {
    create: (schemas) =>
      channelClientToServer = new ControlledChannel({
        codec: codecFactory.create(schemas),
        onSend(outgoingMessage) {
          console.log("\n[CLIENT --> SERVER]:", outgoingMessage);
          channelServerToClient.simulateIncomingMessage(outgoingMessage);
        },
      }),
  };
  const transportServerToClient: ChannelTransportFactory = {
    create: (schemas) =>
      channelServerToClient = new ControlledChannel({
        codec: codecFactory.create(schemas),
        onSend(outgoingMessage) {
          console.log("\n[SERVER --> CLIENT]:", outgoingMessage);
          channelClientToServer.simulateIncomingMessage(outgoingMessage);
        },
      }),
  };

  const clientSocket = createSocket({
    transport: transportClientToServer,
    partnerProcessing: {
      schema: PingSchema,
    },
  });

  const pingSpy = spy(() => {
    console.log("Processing ping command server-side");
    return Date.now();
  });

  const serverSocket = createSocket({
    transport: transportServerToClient,
    localProcessing: {
      parser: createParser(PingSchema, {
        adapter: {
          ping: () => pingSpy(),
        },
      }),
    },
  });

  const pingResult = await clientSocket.partner.ping();
  assertLessOrEqual(pingResult, Date.now());
  assertSpyCall(pingSpy, 0, { args: [] });

  // Wait at least 1ms before triggering the next ping
  await new Promise((resolve) => setTimeout(resolve, 1));

  const secondPingResult = await clientSocket.partner.ping();
  assertGreater(secondPingResult, pingResult);
  assertSpyCall(pingSpy, 1, { args: [] });

  clientSocket.dispose();
  serverSocket.dispose();
});
