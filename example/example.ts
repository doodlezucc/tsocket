import { Configuration } from "../src/net/configuration.ts";
import { MessageMapping, MessageName, Schema } from "../src/net/schema.ts";

type MySchema = Schema<{
  chat: {
    sendMessage(text: string): void;

    messages: {
      delete(): void;
    }[];
  };

  anotherThing(from: number): number;
}>;

export const mapping = {
  "chat.messages.*.delete": (adapter, messageId) =>
    adapter.chat.messages.get(messageId).delete,

  "chat.sendMessage": (adapter) => adapter.chat.sendMessage,

  anotherThing: (adapter) => adapter.anotherThing,
} satisfies MessageMapping<MySchema>;

type MyConfiguration = Configuration<MySchema>;

type MyMessages = MessageName<MySchema>;
