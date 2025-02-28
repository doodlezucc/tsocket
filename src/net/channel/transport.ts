import { StreamSubscription } from "../../util.ts";
import { IndexedSchema } from "../schema-indexing.ts";
import { MessageCodec } from "./codec.ts";
import { Message } from "./message.ts";

export interface ChannelTransport {
  send(message: Message): void;
  subscribe(onReceive: (message: Message) => void): StreamSubscription;
}

export interface ChannelTransportFactory<
  T extends ChannelTransport = ChannelTransport,
> {
  create(indexedSchema: IndexedSchema): T;
}

export interface EncodedChannel<TEncoding> {
  codec: MessageCodec<TEncoding>;

  send(data: TEncoding): void;
  subscribe(onReceive: (data: TEncoding) => void): StreamSubscription;
}

export class EncodedChannelTransport<TEncoding> implements ChannelTransport {
  constructor(private readonly channel: EncodedChannel<TEncoding>) {}

  send(message: Message): void {
    this.channel.send(this.channel.codec.encode(message));
  }

  subscribe(onReceive: (message: Message) => void): StreamSubscription {
    return this.channel.subscribe((data) => {
      onReceive(this.channel.codec.decode(data));
    });
  }
}

export function transportCustomChannel<TEncoding>(
  options: EncodedChannel<TEncoding>,
): ChannelTransportFactory<EncodedChannelTransport<TEncoding>> {
  return {
    create: () => new EncodedChannelTransport(options),
  };
}
