import { JsonCodec, MessageCodec } from "../net/channel/codec.ts";
import { Message } from "../net/channel/message.ts";
import { ChannelTransport } from "../net/channel/transport.ts";
import { StreamSubscription } from "../util.ts";

type WebSocketEncoding = string | ArrayBufferLike | Blob | ArrayBufferView;

export class WebSocketChannel<TEncoding extends WebSocketEncoding = string>
  implements ChannelTransport {
  private outgoingQueue: TEncoding[] = [];
  private isOpen: boolean;

  constructor(
    readonly socket: WebSocket,
    readonly codec: MessageCodec<TEncoding>,
  ) {
    if (socket.readyState === WebSocket.OPEN) {
      this.isOpen = true;
    } else {
      this.isOpen = false;
      socket.addEventListener("open", () => this.onOpen());
    }

    socket.addEventListener("close", () => {
      this.isOpen = false;
    });
  }

  private onOpen() {
    for (const data of this.outgoingQueue) {
      this.socket.send(data);
    }

    this.outgoingQueue = [];
    this.isOpen = true;
  }

  send(message: Message) {
    const data = this.codec.encode(message);

    if (this.isOpen) {
      this.socket.send(data);
    } else {
      this.outgoingQueue.push(data);
    }
  }

  subscribe(onReceive: (message: Message) => void): StreamSubscription {
    const listener = (ev: MessageEvent) => {
      const rawData = ev.data as TEncoding;
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
