import { Message } from "./transport.ts";

export interface MessageCodec<T = unknown> {
  encode(message: Message): T;
  decode(message: T): Message;
}

export const JsonCodec: MessageCodec<string> = {
  encode(message: Message): string {
    return JSON.stringify(message);
  },

  decode(message: string): Message {
    return JSON.parse(message);
  },
};
