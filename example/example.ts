import { EndpointMapping, EndpointName, Schema } from "../src/net/schema.ts";
import { Socket } from "../src/net/socket.ts";

type ServerSchema = Schema<{
  chat: {
    forwardMessage(text: string): void;

    messages: {
      delete(): void;
    }[];
  };

  anotherThing(from: number): number;
}>;

type AdapterContext = {
  initiatorId: string;
};

export const mapping = {
  "chat.messages.*.delete": (adapter, messageId) =>
    adapter.chat.messages.get(messageId).delete,

  "chat.forwardMessage": (adapter) => adapter.chat.forwardMessage,

  anotherThing: (adapter) => adapter.anotherThing,
} satisfies EndpointMapping<ServerSchema, AdapterContext>;

type MyEndpoints = EndpointName<ServerSchema>;

class ServerSocket extends Socket<ServerSchema, AdapterContext> {
  constructor() {
    super(mapping, {
      anotherThing(context, a) {
        return a;
      },
      chat: {
        forwardMessage(text) {},
        messages: {
          get(id) {
            return { delete() {} };
          },
        },
      },
    });
  }
}
