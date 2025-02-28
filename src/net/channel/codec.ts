import { IndexedSchema } from "../schema-indexing.ts";
import { Message } from "./message.ts";

export interface MessageCodec<T = unknown> {
  encode(message: Message): T;
  decode(message: T): Message;
}

export interface MessageCodecFactory<T = unknown> {
  create(indexedSchema: IndexedSchema): MessageCodec<T>;
}

const JsonCodec: MessageCodec<string> = {
  encode(message: Message): string {
    return JSON.stringify(message);
  },

  decode(message: string): Message {
    return JSON.parse(message);
  },
};

export function codecJson(): MessageCodecFactory<string> {
  return { create: () => JsonCodec };
}
