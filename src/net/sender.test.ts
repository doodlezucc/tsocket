import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { StreamSubscription } from "../util.ts";
import { ChannelSender } from "./sender.ts";
import { ChannelTransport, Message } from "./transport.ts";

type ChannelListener = (message: Message) => void;

function timeout<T>(promise: Promise<T>, timeoutMilliseconds: number) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(reject, timeoutMilliseconds)),
  ]);
}

class ControlledChannel implements ChannelTransport {
  private readonly responseListeners = new Set<ChannelListener>();

  send(data: Message): void {
    console.log(`Sending ${data}`);
  }

  simulateResponse(data: Message) {
    for (const onReceive of this.responseListeners) {
      try {
        onReceive(data);
      } catch (err) {
        console.warn(err);
      }
    }
  }

  subscribe(onReceive: ChannelListener): StreamSubscription {
    this.responseListeners.add(onReceive);

    return {
      unsubscribe: () => this.responseListeners.delete(onReceive),
    };
  }
}

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

  controlledChannel.simulateResponse({ id: 1, result: null });
  await assertRejects(() => timeout(responsePromise, 50));

  controlledChannel.simulateResponse({
    id: 0,
    result: { id: "1234" },
  });
  const response = await responsePromise;

  assertEquals(response, { id: "1234" });
});
