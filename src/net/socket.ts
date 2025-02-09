import {
  AdaptedCollection,
  AdaptedScope,
  AnyAdaptedEndpoint,
  SchemaAdapter,
} from "./adapter.ts";
import {
  isEndpoint,
  Schema,
  SchemaCollection,
  SchemaEndpoint,
  SchemaField,
  SchemaScope,
} from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

interface RecursiveContext<TContext> {
  adapterContext: TContext;

  payload: EndpointPayload;
  remainingPath: (string | number)[];

  scopeInSchema: SchemaScope;
  scopeInAdapter: AdaptedScope<TContext>;
}

export abstract class Socket<TSchema extends Schema, TContext> {
  constructor(
    readonly schema: TSchema,
    readonly adapter: SchemaAdapter<TSchema, TContext>,
  ) {}

  callEndpoint(payload: EndpointPayload, context: TContext) {
    return this.parseAndCall({
      adapterContext: context,
      payload,
      remainingPath: payload.path,
      scopeInAdapter: this.adapter,
      scopeInSchema: this.schema,
    });
  }

  private parseAndCall(context: RecursiveContext<TContext>): unknown {
    const { payload, remainingPath, scopeInAdapter, scopeInSchema } = context;

    const segment = remainingPath[0];
    const schemaField: SchemaField = scopeInSchema[segment];
    const nextScopeInAdapter = scopeInAdapter[segment];

    if (!schemaField || !nextScopeInAdapter) {
      throw new Error(`Invalid endpoint path "${payload.path.join(".")}"`);
    }

    if (Array.isArray(schemaField)) {
      const collection = nextScopeInAdapter as AdaptedCollection<TContext>;
      return this.parseAndCallCollection(schemaField, collection, context);
    }

    if (isEndpoint(schemaField)) {
      const endpoint = nextScopeInAdapter as AnyAdaptedEndpoint<TContext>;

      return this.callParsedEndpoint(
        schemaField,
        endpoint,
        payload,
        context.adapterContext,
      );
    }

    // Traverse into inner scope
    return this.parseAndCall({
      ...context,
      remainingPath: remainingPath.slice(1),
      scopeInAdapter: nextScopeInAdapter as AdaptedScope<TContext>,
      scopeInSchema: schemaField,
    });
  }

  private parseAndCallCollection(
    collectionInSchema: SchemaCollection,
    collectionInAdapter: AdaptedCollection<TContext>,
    context: RecursiveContext<TContext>,
  ) {
    const elementSchema = collectionInSchema[0];

    const collectionElementId = context.remainingPath[1];
    const retrievedElement = collectionInAdapter.get(collectionElementId);

    return this.parseAndCall({
      ...context,
      remainingPath: context.remainingPath.slice(2),
      scopeInAdapter: retrievedElement,
      scopeInSchema: elementSchema,
    });
  }

  private callParsedEndpoint(
    endpointInSchema: SchemaEndpoint,
    endpointInAdapter: AnyAdaptedEndpoint<TContext>,
    payload: EndpointPayload,
    context: TContext,
  ) {
    if (endpointInSchema.accepts !== undefined) {
      // Endpoint takes parameters
      const validatedParams = endpointInSchema.accepts.parse(payload.params);

      return endpointInAdapter(
        validatedParams,
        context,
      );
    }

    return endpointInAdapter(context);
  }
}
