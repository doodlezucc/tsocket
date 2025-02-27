import { DataType, IsBaseDataType, Value } from "./binary/data-type.ts";
import {
  IndexType,
  isEndpoint,
  Schema,
  SchemaCollection,
  SchemaEndpoint,
  SchemaEndpointImplementation,
  SchemaField,
  SchemaScope,
} from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

type CallerFunction<TParams, TResult> = IsBaseDataType<TParams> extends true
  ? () => TResult
  : (params: TParams) => TResult;

type CallerFunctionResult<TResult extends DataType> =
  IsBaseDataType<TResult> extends true ? void
    : Promise<Value<TResult>>;

type CallerFunctionFrom<TParams extends DataType, TResult extends DataType> =
  CallerFunction<
    Value<TParams>,
    CallerFunctionResult<TResult>
  >;

interface SchemaCollectionCaller<
  E extends SchemaScope,
  TIndex extends DataType,
> {
  get(index: Value<TIndex>): SchemaCaller<E>;
}

type SchemaEndpointCaller<T extends SchemaEndpoint> = T extends
  SchemaEndpoint<infer TParams, infer TResult>
  ? CallerFunctionFrom<TParams, TResult>
  : never;

type SchemaScopeCaller<T extends SchemaScope> = {
  [K in keyof T]: SchemaCaller<T[K]>;
};

export type SchemaCaller<T extends SchemaField = SchemaField> = T extends
  SchemaCollection<infer E, infer TIndex> ? SchemaCollectionCaller<E, TIndex>
  : T extends SchemaEndpoint ? SchemaEndpointCaller<T>
  : T extends SchemaScope ? SchemaScopeCaller<T>
  : never;

interface RecursiveContext {
  currentEndpointIndex: number;
  collectionIndices: IndexType[];
}

class CallerIndexer {
  constructor(private readonly options: CreateCallerOptions) {}

  traverse<T extends Schema>(schema: T) {
    return this.createCallerForField(schema, {
      currentEndpointIndex: 0,
      collectionIndices: [],
    });
  }

  private createCallerForEndpoint<T extends SchemaEndpointImplementation>(
    endpoint: SchemaEndpointImplementation,
    endpointIndex: number,
    context: RecursiveContext,
  ): SchemaEndpointCaller<T> {
    const { sendRequest } = this.options;

    function callEndpointWith(params?: Value<DataType>) {
      const endpointExpectsResponse = endpoint.result !== undefined;

      const payload: EndpointPayload = {
        endpointIndex,
        collectionIndices: context.collectionIndices,
      };

      if (params !== undefined) {
        payload.params = params;
      }

      const response = sendRequest(
        payload,
        endpointExpectsResponse,
      );

      if (endpointExpectsResponse && response instanceof Promise) {
        return response;
      }
    }

    return callEndpointWith as SchemaEndpointCaller<T>;
  }

  private createCallerForField<T extends SchemaField>(
    field: T,
    context: RecursiveContext,
  ): SchemaCaller<T> {
    if (Array.isArray(field)) {
      const collectionSchemaType = field[0];

      // Destructure "context" to evaluate the endpoint index AT THIS TIME
      const {
        currentEndpointIndex: startIndexWithinCollection,
        collectionIndices,
      } = context;

      // Dry run to find and count all nested endpoints (the "context" object gets updated)
      this.createCallerForField(collectionSchemaType, context);

      return <SchemaCaller<T>> {
        get: (index) => {
          // The recursive context is freshly constructed on a per-call basis
          return this.createCallerForField(collectionSchemaType, {
            currentEndpointIndex: startIndexWithinCollection,
            collectionIndices: [...collectionIndices, index],
          });
        },
      };
    } else if (isEndpoint(field)) {
      const endpointIndex = context.currentEndpointIndex;
      context.currentEndpointIndex++;

      return this.createCallerForEndpoint(
        field,
        endpointIndex,
        context,
      ) as SchemaCaller<T>;
    } else {
      const scope = field as SchemaScope;
      const callScope: Record<string, SchemaCaller> = {};

      for (const key of Object.keys(scope)) {
        callScope[key] = this.createCallerForField(scope[key], context);
      }

      return callScope as SchemaCaller<T>;
    }
  }
}

export type SendRequestFunction = (
  payload: EndpointPayload,
  expectResponse: boolean,
) => void | Promise<unknown>;

interface CreateCallerOptions {
  sendRequest: SendRequestFunction;
}

export function createCaller<T extends Schema>(
  schema: T,
  options: CreateCallerOptions,
): SchemaCaller<T> {
  const callerIndexer = new CallerIndexer(options);

  return callerIndexer.traverse(schema);
}
