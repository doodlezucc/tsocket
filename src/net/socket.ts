import { SchemaAdapter } from "./adapter.ts";
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
  scopeInAdapter: Record<string, unknown>;
}

type EndpointAdapterWithParams<TContext> = (
  params: unknown,
  context: TContext,
) => unknown;
type EndpointAdapterWithoutParams<TContext> = (context: TContext) => unknown;
type EndpointAdapter<TContext> =
  & EndpointAdapterWithParams<TContext>
  & EndpointAdapterWithoutParams<TContext>;

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
      const elementSchema = schemaField[0];

      const collectionAdapter = nextScopeInAdapter as SchemaAdapter<
        SchemaCollection,
        TContext
      >;

      const collectionElementId = remainingPath[1];
      const retrievedElement = collectionAdapter.get(collectionElementId);

      return this.parseAndCall({
        ...context,
        remainingPath: remainingPath.slice(2),
        scopeInAdapter: retrievedElement,
        scopeInSchema: elementSchema,
      });
    }

    if (isEndpoint(schemaField)) {
      return this.callParsedEndpoint(
        schemaField,
        nextScopeInAdapter as EndpointAdapter<TContext>,
        payload,
        context.adapterContext,
      );
    }

    // Traverse into inner scope
    return this.parseAndCall({
      ...context,
      remainingPath: remainingPath.slice(1),
      scopeInAdapter: nextScopeInAdapter as Record<string, unknown>,
      scopeInSchema: schemaField,
    });
  }

  private callParsedEndpoint(
    endpointInSchema: SchemaEndpoint,
    endpointInAdapter: EndpointAdapter<TContext>,
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
