import { StreamSubscription } from "../../util.ts";
import { IndexedSchema } from "../schema-indexing.ts";
import { MessageCodec, MessageCodecFactory } from "./codec.ts";
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
  send(data: TEncoding): void;
  subscribe(onReceive: (data: TEncoding) => void): StreamSubscription;
}

export class EncodedChannelTransport<TEncoding> implements ChannelTransport {
  constructor(
    private readonly codec: MessageCodec<TEncoding>,
    private readonly channel: EncodedChannel<TEncoding>,
  ) {}

  send(message: Message): void {
    this.channel.send(this.codec.encode(message));
  }

  subscribe(onReceive: (message: Message) => void): StreamSubscription {
    return this.channel.subscribe((data) => {
      onReceive(this.codec.decode(data));
    });
  }
}

interface CustomChannelOptions<TEncoding> extends EncodedChannel<TEncoding> {
  codec: MessageCodecFactory<TEncoding>;
}

export function transportCustomChannel<TEncoding>(
  options: CustomChannelOptions<TEncoding>,
): ChannelTransportFactory<EncodedChannelTransport<TEncoding>> {
  return {
    create: (indexedSchema) =>
      new EncodedChannelTransport(options.codec.create(indexedSchema), options),
  };
}
