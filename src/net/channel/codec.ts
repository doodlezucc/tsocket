import { IndexedSchema } from "../schema-indexing.ts";
import { Message } from "./message.ts";

export interface MessageCodec<T = unknown> {
  initialize?: (indexedSchema: IndexedSchema) => void;

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
