import { Schema, SchemaRequest } from "../src/net/schema.ts";
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

type MyRequest = SchemaRequest<ServerSchema>;

const req: MyRequest = {
  chat: {
    // messages: {
    //   messageid: {
    //     delete: [],
    //   },
    // },
    forwardMessage: ["this is my message"],
  },
};

class ServerSocket extends Socket<ServerSchema, AdapterContext> {
  constructor() {
    super({
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
