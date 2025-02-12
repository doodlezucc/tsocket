import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { assertSpyCallArg, stub } from "@std/testing/mock";
import { JsonCodec } from "./codec.ts";
import { createSender } from "./sender.ts";
import { Channel, StreamSubscription } from "./transport.ts";

type DataListener = (data: string) => void;

function timeout<T>(promise: Promise<T>, timeoutMilliseconds: number) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(reject, timeoutMilliseconds)),
  ]);
}

class ControlledChannel implements Channel<string> {
  private readonly responseListeners = new Set<DataListener>();

  send(data: string): void {
    console.log(`Sending ${data}`);
  }

  simulateResponse(data: string) {
    for (const onNewData of this.responseListeners) {
      try {
        onNewData(data);
      } catch (err) {
        console.warn(err);
      }
    }
  }

  subscribe(onNewData: DataListener): StreamSubscription {
    this.responseListeners.add(onNewData);

    return {
      unsubscribe: () => this.responseListeners.delete(onNewData),
    };
  }
}

type CreateMessageSuccess = { id: string };

Deno.test("Message sending over channel", async () => {
  const controlledChannel = new ControlledChannel();

  const sender = createSender({
    channel: controlledChannel,
    codec: JsonCodec,
  });

  using channelSendStub = stub(controlledChannel, "send");

  const responsePromise = sender.request<CreateMessageSuccess>({
    path: ["createMessage"],
    params: {
      text: "My new message",
    },
  });

  const expectedMessage =
    '{"id":0,"payload":{"path":["createMessage"],"params":{"text":"My new message"}}}';
  assertSpyCallArg(channelSendStub, 0, 0, expectedMessage);

  controlledChannel.simulateResponse("Invalid JSON");
  await assertRejects(() => timeout(responsePromise, 50));

  controlledChannel.simulateResponse('{"id":0,"result":{"id":"1234"}}');
  const response = await responsePromise;

  assertEquals(response, { id: "1234" });
});
