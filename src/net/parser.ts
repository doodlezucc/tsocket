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

export function createParser<TSchema extends Schema, TContext>(
  schema: TSchema,
  adapter: SchemaAdapter<TSchema, TContext>,
): Parser<TSchema, TContext>;

export function createParser<TSchema extends Schema, TContext>(
  schema: TSchema,
  context: TContext | (() => TContext),
  adapter: SchemaAdapter<TSchema, TContext>,
): Parser<TSchema, TContext>;

export function createParser<TSchema extends Schema, TContext>(
  schema: TSchema,
  adapterOrContext:
    | SchemaAdapter<TSchema, TContext>
    | TContext
    | (() => TContext),
  adapter?: SchemaAdapter<TSchema, TContext>,
): Parser<TSchema, TContext> {
  const indexedSchema = indexSchema(schema);

  if (adapter) {
    if (typeof adapterOrContext === "function") {
      return new ParserImplementation(
        indexedSchema,
        adapter,
        adapterOrContext as (() => TContext),
      );
    } else {
      return new ParserImplementation(
        indexedSchema,
        adapter,
        () => adapterOrContext as TContext,
      );
    }
  }

  return new ParserImplementation(
    indexedSchema,
    adapterOrContext as SchemaAdapter<TSchema, TContext>,
  );
}
