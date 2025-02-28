import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { ControlledChannel, timeout } from "../helpers.test.ts";
import { Message, RequestMessage } from "./message.ts";
import { ChannelSender } from "./sender.ts";

type CreateMessageSuccess = { id: string };

Deno.test("Message sending over channel", async () => {
  const controlledChannel = new ControlledChannel();

  const sender = new ChannelSender({
    channel: controlledChannel,
  });

  const responsePromise = sender.request<CreateMessageSuccess>({
    endpointIndex: 0,
    collectionIndices: [],
    params: {
      text: "My new message",
    },
  });

  controlledChannel.simulateIncomingMessage({ id: 1, result: null });
  await assertRejects(() => timeout(responsePromise, 50));

  controlledChannel.simulateIncomingMessage({
    id: 0,
    result: { id: "1234" },
  });
  const response = await responsePromise;

  assertEquals(response, { id: "1234" });
});

Deno.test("Request returns error response", async () => {
  const controlledChannel = new ControlledChannel();

  const sender = new ChannelSender({
    channel: controlledChannel,
  });

  const responsePromise = sender.request<CreateMessageSuccess>({
    endpointIndex: 0,
    collectionIndices: [],
    params: {
      text: "My new message",
    },
  });

  controlledChannel.simulateIncomingMessage({
    id: 0,
    error: "Failed to create message",
  });
  await assertRejects(() => responsePromise, Error, "Failed to create message");
});

Deno.test("Request IDs are reused after resolving/rejecting", async () => {
  const sendMessageSpy = spy((message: Message) => {
    console.log("Sending message", message);
  });

  const controlledChannel = new ControlledChannel({
    onSend: sendMessageSpy,
  });

  const sender = new ChannelSender({
    channel: controlledChannel,
  });

  function createMessage() {
    return sender.request<CreateMessageSuccess>({
      endpointIndex: 0,
      collectionIndices: [],
      params: {
        text: "My new message",
      },
    });
  }

  const responsePromises = Array(5).fill(0).map(() => createMessage());

  assertSpyCalls(sendMessageSpy, 5);
  assertEquals((sendMessageSpy.calls[0].args[0] as RequestMessage).id, 0);
  assertEquals((sendMessageSpy.calls[1].args[0] as RequestMessage).id, 1);
  assertEquals((sendMessageSpy.calls[2].args[0] as RequestMessage).id, 2);
  assertEquals((sendMessageSpy.calls[3].args[0] as RequestMessage).id, 3);
  assertEquals((sendMessageSpy.calls[4].args[0] as RequestMessage).id, 4);

  // Assert that rejecting a request frees up its ID
  controlledChannel.simulateIncomingMessage({
    id: 1,
    error: "Failed to create message",
  });
  await assertRejects(
    () => responsePromises[1],
    Error,
    "Failed to create message",
  );

  createMessage();
  assertEquals((sendMessageSpy.calls[5].args[0] as RequestMessage).id, 1);

  createMessage();
  assertEquals((sendMessageSpy.calls[6].args[0] as RequestMessage).id, 5);

  // Assert that resolving a request frees up its ID
  controlledChannel.simulateIncomingMessage({ id: 2, result: { id: "1234" } });
  const response = await responsePromises[2];
  assertEquals(response, { id: "1234" });

  createMessage();
  assertEquals((sendMessageSpy.calls[7].args[0] as RequestMessage).id, 2);
});
