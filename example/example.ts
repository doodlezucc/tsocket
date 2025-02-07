import { z } from "zod";
import {
  collection,
  endpoint,
  schema,
  SchemaCaller,
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

type ServerSchemaType = typeof ServerSchema;
type ServerSchemaCaller = SchemaCaller<ServerSchemaType>;

const server = {} as ServerSchemaCaller;

server.chat.messages.get("0").delete();

server.anotherThing({
  with: [
    { name: "A name", description: "A description" },
  ],
  from: 0,
});
