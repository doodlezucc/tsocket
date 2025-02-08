import { z } from "zod";
import {
  collection,
  createCaller,
  endpoint,
  schema,
  unchecked,
} from "../src/net/schema.ts";

const ServerSchema = schema({
  chat: {
    forwardMessage: endpoint({
      accepts: z.object({
        text: z.string(),
      }),
    }),

    messages: collection({
      delete: endpoint(),
    }),
  },

  anotherThing: endpoint({
    accepts: z.object({
      from: z.number(),
      with: z.array(unchecked<{
        name: string;
        description?: string;
      }>()),
    }),
    returns: z.number(),
  }),
});

const server = createCaller(ServerSchema, {
  sendRequest(payload, expectResponse) {
    console.log(expectResponse, payload);

    if (expectResponse) {
      return new Promise((resolve) => {
        resolve(1234);
      });
    }
  },
});

server.chat.messages.get("0").delete();

const response = await server.anotherThing({
  with: [
    { name: "A name", description: "A description" },
  ],
  from: 0,
});

console.log("Response:", response);
