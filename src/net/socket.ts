import { Message } from "./message.ts";
import {
  EndpointMapping,
  EndpointName,
  Schema,
  SchemaAdapter,
} from "./schema.ts";

export abstract class Socket<TSchema extends Schema, TContext> {
  constructor(
    readonly mapping: EndpointMapping<TSchema, TContext>,
    readonly adapter: SchemaAdapter<TSchema, TContext>
  ) {}

  private isValidEndpoint(endpoint: string): endpoint is EndpointName<TSchema> {
    return endpoint in this.mapping;
  }

  handleIncomingMessage(context: TContext, message: Message) {
    const { endpoint, ids, args } = message;

    if (this.isValidEndpoint(endpoint)) {
      const resolveAdaptedFunction = this.mapping[endpoint];
      const callImplementation = resolveAdaptedFunction(this.adapter, ...ids);
      callImplementation(context, ...args);
    }
  }
}
