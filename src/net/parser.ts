import { SchemaAdapter } from "./adapter.ts";
import { IndexedSchema, indexSchema } from "./schema-indexing.ts";
import { Schema } from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

export interface Parser<TSchema extends Schema, TContext> {
  readonly indexedSchema: IndexedSchema<TSchema>;
  readonly adapter: SchemaAdapter<TSchema, TContext>;

  callEndpoint(payload: EndpointPayload, context?: TContext): unknown;
}

class ParserImplementation<TSchema extends Schema, TContext>
  implements Parser<TSchema, TContext> {
  private readonly logError: (err: unknown) => void;

  constructor(
    readonly indexedSchema: IndexedSchema<TSchema>,
    readonly adapter: SchemaAdapter<TSchema, TContext>,
    private readonly composeContext?: () => TContext,
    logError?: (err: unknown) => void,
  ) {
    if (logError) {
      this.logError = logError;
    } else {
      this.logError = (err) => console.error(err);
    }
  }

  callEndpoint(payload: EndpointPayload, context?: TContext) {
    const { endpointIndex, collectionIndices, params } = payload;

    const adapterContext = context ?? this.composeContext?.() as TContext;

    const endpoint = this.indexedSchema.indexedAdaptedEndpoints[endpointIndex]
      .resolveInAdapter(this.adapter, collectionIndices);

    try {
      if (params !== undefined) {
        return endpoint(params, adapterContext);
      } else {
        return endpoint(adapterContext);
      }
    } catch (err) {
      this.logError?.(err);
      throw err;
    }
  }
}

interface ParserOptions<TSchema extends Schema, TContext> {
  adapter: SchemaAdapter<TSchema, TContext>;
  context?: TContext | (() => TContext);

  /**
   * A function which is called whenever an error is thrown by the underlying
   * adapter. Pass an empty function `() => {}` to disable error logging.
   *
   * @default (err) => console.error(err)
   */
  logError?: (err: unknown) => void;
}

export function createParser<TSchema extends Schema, TContext>(
  schema: TSchema,
  options: ParserOptions<TSchema, TContext>,
): Parser<TSchema, TContext> {
  const indexedSchema = indexSchema(schema);

  const { adapter, context, logError } = options;

  let composeContext: (() => TContext) | undefined;

  if (context) {
    if (typeof context === "function") {
      composeContext = context as (() => TContext);
    } else {
      composeContext = () => context;
    }
  }

  return new ParserImplementation(
    indexedSchema,
    adapter,
    composeContext,
    logError,
  );
}
