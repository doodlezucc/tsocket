import { StreamSubscription } from "../util.ts";
import { MessageCodec } from "./channel/codec.ts";
import { Message } from "./channel/message.ts";
import { ChannelTransport } from "./channel/transport.ts";

export function timeout<T>(promise: Promise<T>, timeoutMilliseconds: number) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(reject, timeoutMilliseconds)),
  ]);
}

type ChannelListener<T> = (message: T) => void;

interface ControlledChannelOptions<T> {
  onSend?: ChannelListener<T>;
  codec?: MessageCodec<T>;
}

export class ControlledChannel<T = Message> implements ChannelTransport {
  private readonly onSend?: ChannelListener<T>;
  private readonly codec: MessageCodec<T>;

  private readonly responseListeners = new Set<ChannelListener<Message>>();

  constructor(options?: ControlledChannelOptions<T>) {
    this.onSend = options?.onSend;
    this.codec = options?.codec ?? {
      encode: (message) => message as T,
      decode: (message) => message as Message,
    };
  }

  send(message: Message): void {
    const encodedMessage = this.codec.encode(message);

    if (this.onSend) {
      this.onSend(encodedMessage);
    } else {
      console.log("Sending", encodedMessage);
    }
  }

  simulateIncomingMessage(data: T) {
    const decodedMessage = this.codec.decode(data);

    for (const onReceive of this.responseListeners) {
      try {
        onReceive(decodedMessage);
      } catch (err) {
        console.warn(err);
      }
    }
  }

  subscribe(onReceive: ChannelListener<Message>): StreamSubscription {
    this.responseListeners.add(onReceive);

    return {
      unsubscribe: () => this.responseListeners.delete(onReceive),
    };
  }
}
