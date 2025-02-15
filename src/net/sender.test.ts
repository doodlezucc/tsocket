import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { ControlledChannel, timeout } from "./helpers.test.ts";
import { ChannelSender } from "./sender.ts";

type CreateMessageSuccess = { id: string };

Deno.test("Message sending over channel", async () => {
  const controlledChannel = new ControlledChannel();

  const sender = new ChannelSender({
    channel: controlledChannel,
  });

  const responsePromise = sender.request<CreateMessageSuccess>({
    path: ["createMessage"],
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
