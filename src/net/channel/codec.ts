import * as cbor from "cbor2";
import { Message } from "./message.ts";

export interface MessageCodec<T = unknown> {
  encode(message: Message): T;
  decode(message: T): Message;
}

const jsonCodec: MessageCodec<string> = {
  encode(message: Message): string {
    return JSON.stringify(message);
  },

  decode(message: string): Message {
    return JSON.parse(message);
  },
};

export function codecJson() {
  return jsonCodec;
}

export class CborCodec implements MessageCodec<Uint8Array | ArrayBuffer> {
  constructor(private readonly options?: CborOptions) {}

  encode(message: Message): Uint8Array {
    return cbor.encode(message, this.options);
  }

  decode(message: Uint8Array | ArrayBuffer): Message {
    const array = message instanceof Uint8Array
      ? message
      : new Uint8Array(message);

    return cbor.decode(array, this.options);
  }
}

type CborOptions = cbor.EncodeOptions & cbor.DecodeOptions;

export function codecCbor(
  options?: CborOptions,
): MessageCodec<Uint8Array> {
  return new CborCodec(options);
}
