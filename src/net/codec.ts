import { Message } from "./transport.ts";

export interface Codec<T = unknown> {
  encode(message: Message): T;
  decode(message: T): Message;
}

export const JsonCodec: Codec<string> = {
  encode(message: Message): string {
    return JSON.stringify(message);
  },

  decode(message: string): Message {
    return JSON.parse(message);
  },
};
