import { Message } from "./message.ts";
import { Schema, SchemaAdapter, SchemaRequest } from "./schema.ts";

export abstract class Socket<TSchema extends Schema, TContext> {
  constructor(readonly adapter: SchemaAdapter<TSchema, TContext>) {}

  handleIncomingMessage(context: TContext, message: Message<TSchema>) {
    const { request } = message;

    return this.parseRequest(context, request, this.adapter);
  }

  private parseRequest(
    context: TContext,
    request: SchemaRequest,
    scope: Record<string, unknown>,
  ): unknown {
    const keys = Object.keys(request);

    if (keys.length !== 1) {
      throw new Error(
        "Nested requests require exactly one property per object",
      );
    }

    const nextKey = keys[0];
    if (!(nextKey in scope)) {
      throw new Error(`"${nextKey}" property not handled`);
    }

    const nextRequestScope = request[nextKey];
    const nextAdapterScope = scope[nextKey];

    if (typeof nextAdapterScope === "function") {
      // TODO: handle malicious function calls

      let args: unknown[];
      if (Array.isArray(nextRequestScope)) {
        args = nextRequestScope;
      } else if (typeof nextRequestScope === "object") {
        args = [nextRequestScope];
      } else {
        throw new Error("Invalid function call syntax in nested request");
      }

      return nextAdapterScope(context, ...args);
    }

    return this.parseRequest(
      context,
      nextRequestScope as SchemaRequest,
      nextAdapterScope as Record<string, unknown>,
    );
  }
}
