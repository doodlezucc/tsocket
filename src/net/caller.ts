import { ZodType } from "zod";
import { IsAny, ZodOutput } from "../util.ts";
import {
  isEndpoint,
  Schema,
  SchemaCollection,
  SchemaEndpoint,
  SchemaField,
  SchemaScope,
} from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

type CallerFunction<TParams, TResult> = IsAny<TParams> extends true
  ? () => TResult
  : (params: TParams) => TResult;

export type CallerFunctionResult<TResult> = IsAny<ZodOutput<TResult>> extends
  true ? void
  : Promise<ZodOutput<TResult>>;

type CallerFunctionFrom<TParams, TResult> = CallerFunction<
  ZodOutput<TParams>,
  CallerFunctionResult<TResult>
>;

interface SchemaCollectionCaller<E extends SchemaScope> {
  get(id: string | number): SchemaCaller<E>;
}

type SchemaEndpointCaller<T extends SchemaEndpoint> = T extends
  SchemaEndpoint<infer TParams, infer TResult>
  ? CallerFunctionFrom<TParams, TResult>
  : never;

type SchemaScopeCaller<T extends SchemaScope> = {
  [K in keyof T]: SchemaCaller<T[K]>;
};

export type SchemaCaller<T extends SchemaField = SchemaField> = T extends
  SchemaCollection<infer E> ? SchemaCollectionCaller<E>
  : T extends SchemaEndpoint ? SchemaEndpointCaller<T>
  : T extends SchemaScope ? SchemaScopeCaller<T>
  : never;

interface RecursiveContext {
  options: CreateCallerOptions;
  path: (string | number)[];
}

function createCallerForEndpoint<T extends SchemaEndpoint>(
  endpoint: T,
  context: RecursiveContext,
): SchemaEndpointCaller<T> {
  function callEndpointWith(params?: unknown) {
    const endpointExpectsResponse = endpoint.returns instanceof ZodType;

    const payload: EndpointPayload = {
      path: context.path,
    };

    if (params !== undefined) {
      payload.params = params;
    }

    const request = context.options.sendRequest(
      payload,
      endpointExpectsResponse,
    );

    if (endpointExpectsResponse && request instanceof Promise) {
      return request.then((response) => {
        return endpoint.returns!.parse(response);
      });
    }
  }

  return callEndpointWith as SchemaEndpointCaller<T>;
}

function createCallerForField<T extends SchemaField>(
  field: T,
  context: RecursiveContext,
): SchemaCaller<T> {
  if (Array.isArray(field)) {
    const collectionSchemaType = field[0];

    return <SchemaCaller<T>> {
      get(id) {
        return createCallerForField(collectionSchemaType, {
          ...context,
          path: [...context.path, id],
        });
      },
    };
  } else if (isEndpoint(field)) {
    return createCallerForEndpoint(field, context) as SchemaCaller<T>;
  } else {
    const scope = field as SchemaScope;
    const callScope: Record<string, SchemaCaller> = {};

    for (const key in scope) {
      callScope[key] = createCallerForField(scope[key], {
        ...context,
        path: [...context.path, key],
      });
    }

    return callScope as SchemaCaller<T>;
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
  return createCallerForField(schema, { options, path: [] });
}
