import { SchemaAdapter } from "./adapter.ts";
import { IndexedSchema, indexSchema } from "./schema-indexing.ts";
import { Schema } from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

export interface Parser<TSchema extends Schema, TContext> {
  readonly indexedSchema: IndexedSchema<TSchema>;
  readonly adapter: SchemaAdapter<TSchema, TContext>;
  readonly composeContext?: () => TContext;

  callEndpoint(payload: EndpointPayload, context?: TContext): unknown;
}

class ParserImplementation<TSchema extends Schema, TContext>
  implements Parser<TSchema, TContext> {
  constructor(
    readonly indexedSchema: IndexedSchema<TSchema>,
    readonly adapter: SchemaAdapter<TSchema, TContext>,
    readonly composeContext?: () => TContext,
  ) {}

  callEndpoint(payload: EndpointPayload, context?: TContext) {
    const { endpointIndex, collectionIndices, params } = payload;

    const adapterContext = context ?? this.composeContext?.() as TContext;

    const endpoint = this.indexedSchema.indexedAdaptedEndpoints[endpointIndex]
      .resolveInAdapter(this.adapter, collectionIndices);

    if (params !== undefined) {
      return endpoint(params, adapterContext);
    } else {
      return endpoint(adapterContext);
    }
  }
}

interface ParserOptions<TSchema extends Schema, TContext> {
  adapter: SchemaAdapter<TSchema, TContext>;
  context?: TContext | (() => TContext);
}

export function createParser<TSchema extends Schema, TContext>(
  schema: TSchema,
  options: ParserOptions<TSchema, TContext>,
): Parser<TSchema, TContext> {
  const indexedSchema = indexSchema(schema);

  const { adapter, context } = options;

  let composeContext: (() => TContext) | undefined;

  if (context) {
    if (typeof context === "function") {
      composeContext = context as (() => TContext);
    } else {
      composeContext = () => context;
    }
  }

  return new ParserImplementation(indexedSchema, adapter, composeContext);
}
