import { StreamSubscription } from "../util.ts";
import { Message } from "./channel/message.ts";
import { ChannelTransport } from "./channel/transport.ts";

export function timeout<T>(promise: Promise<T>, timeoutMilliseconds: number) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(reject, timeoutMilliseconds)),
  ]);
}

type ChannelListener = (message: Message) => void;

export class ControlledChannel implements ChannelTransport {
  private readonly responseListeners = new Set<ChannelListener>();

  constructor(private readonly onSend?: ChannelListener) {}

  send(data: Message): void {
    if (this.onSend) {
      this.onSend(data);
    } else {
      console.log("Sending", data);
    }
  }

  simulateIncomingMessage(data: Message) {
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
