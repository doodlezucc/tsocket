import {
  codecBinary,
  PacketMessageCodec,
} from "../net/channel/codec-binary.ts";
import { MessageCodec, MessageCodecFactory } from "../net/channel/codec.ts";
import { Message } from "../net/channel/message.ts";
import {
  ChannelTransport,
  ChannelTransportFactory,
} from "../net/channel/transport.ts";
import { StreamSubscription } from "../util.ts";

type WebSocketEncoding = string | ArrayBufferLike | Blob | ArrayBufferView;

type MessageListener = (message: Message) => void;

export class WebSocketChannel<TEncoding extends WebSocketEncoding>
  implements ChannelTransport {
  private outgoingQueue: TEncoding[] = [];
  private isOpen: boolean;

  private listeners: MessageListener[] = [];

  constructor(
    readonly socket: WebSocket,
    readonly codec: MessageCodec<TEncoding>,
  ) {
    if (
      codec instanceof PacketMessageCodec && socket.binaryType !== "arraybuffer"
    ) {
      throw new Error(
        `The WebSocket channel was created with a WebSocket of binaryType "${socket.binaryType}". ` +
          'Please set the binaryType to "arraybuffer".',
      );
    }

    if (socket.readyState === WebSocket.OPEN) {
      this.isOpen = true;
    } else {
      this.isOpen = false;
      socket.addEventListener("open", () => this.onOpen());
    }

    socket.addEventListener("close", () => {
      this.isOpen = false;
    });

    socket.addEventListener("message", (ev) => this.onMessage(ev));
  }

  private onOpen() {
    for (const data of this.outgoingQueue) {
      this.socket.send(data);
    }

    this.outgoingQueue = [];
    this.isOpen = true;
  }

  private onMessage(ev: MessageEvent) {
    const rawData = ev.data as TEncoding;
    const decodedMessage = this.codec.decode(rawData);

    for (const onReceive of this.listeners) {
      try {
        onReceive(decodedMessage);
      } catch (err) {
        console.warn(err);
      }
    }
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
    this.listeners.push(onReceive);

    return {
      unsubscribe: () =>
        this.listeners = this.listeners
          .filter((anyListener) => anyListener !== onReceive),
    };
  }
}

interface WebSocketTransportOptions {
  codec?: MessageCodecFactory<WebSocketEncoding>;
}

export function transportWebSocket(
  webSocket: WebSocket,
  options?: WebSocketTransportOptions,
): ChannelTransportFactory<WebSocketChannel<WebSocketEncoding>> {
  return {
    create(indexedSchema) {
      const codecFactory = options?.codec ?? codecBinary();

      return new WebSocketChannel(
        webSocket,
        codecFactory.create(indexedSchema),
      );
    },
  };
}
