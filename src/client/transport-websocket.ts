import { JsonCodec, MessageCodec } from "../net/codec.ts";
import { ChannelTransport, Message } from "../net/transport.ts";
import { StreamSubscription } from "../util.ts";

interface WebSocketMessageEvent {
  // deno-lint-ignore no-explicit-any
  data: any;
}

export class WebSocketChannel implements ChannelTransport {
  constructor(
    readonly socket: WebSocket,
    readonly codec: MessageCodec<string>,
  ) {}

  send(data: Message) {
    this.socket.send(this.codec.encode(data));
  }

  subscribe(onReceive: (message: Message) => void): StreamSubscription {
    const listener = (ev: WebSocketMessageEvent) => {
      const rawData = ev.data;
      const message = this.codec.decode(rawData);

      onReceive(message);
    };

    this.socket.addEventListener("message", listener);

    return {
      unsubscribe: () => this.socket.removeEventListener("message", listener),
    };
  }
}

interface WebSocketTransportOptions {
  codec?: MessageCodec<string>;
}

export function transportWebSocket(
  webSocket: WebSocket,
  options?: WebSocketTransportOptions,
) {
  return new WebSocketChannel(webSocket, options?.codec ?? JsonCodec);
}
