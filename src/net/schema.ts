import { ParseInput, ParseReturnType, ZodType } from "zod";

type SchemaCollection<T extends SchemaScope = SchemaScope> = [T];

interface SchemaEndpointProperties<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> {
  accepts?: TParams;
  returns?: TResult;
}

interface SchemaEndpoint<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> extends SchemaEndpointProperties<TParams, TResult> {
  endpointToken: true;
}

type SchemaField =
  | SchemaCollection
  | SchemaEndpoint
  | SchemaScope;

type SchemaScope = {
  [key: string]: SchemaField;
};

export type Schema = SchemaScope;

export function schema<T extends Schema>(schema: T) {
  return schema;
}

function isEndpoint(field: SchemaField): field is SchemaEndpoint {
  return "endpointToken" in field && field.endpointToken === true;
}

export function endpoint<TParams extends ZodType, TResult extends ZodType>(
  endpoint?: SchemaEndpointProperties<TParams, TResult>,
): SchemaEndpoint<TParams, TResult> {
  return {
    endpointToken: true,
    ...endpoint,
  };
}

export function collection<T extends SchemaScope>(
  schema: T,
): SchemaCollection<T> {
  return [schema];
}

class ZodUnchecked<T> extends ZodType {
  override _parse(input: ParseInput): ParseReturnType<T> {
    return input as unknown as ParseReturnType<T>;
  }
}

export function unchecked<T>(): ZodType<T> {
  return new ZodUnchecked({});
}

type IsAny<T> = 0 extends (1 & T) ? true : false;

type ZodOutput<T> = T extends ZodType<infer TOut> ? TOut
  : T extends object ? { [K in keyof T]: ZodOutput<T[K]> }
  : T;

type ModelFunction<TParams, TResult> = IsAny<TParams> extends true
  ? () => TResult
  : (params: TParams) => TResult;

type ModelFunctionFrom<TParams, TResult> = ModelFunction<
  ZodOutput<TParams>,
  IsAny<ZodOutput<TResult>> extends true ? void : Promise<ZodOutput<TResult>>
>;

interface SchemaCollectionCaller<E extends SchemaScope> {
  get(id: string | number): SchemaCaller<E>;
}

type SchemaEndpointCaller<T extends SchemaEndpoint> = T extends
  SchemaEndpoint<infer TParams, infer TResult>
  ? ModelFunctionFrom<TParams, TResult>
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

export interface EndpointPayload {
  path: (string | number)[];
  params?: unknown;
}

export type SendRequestFn = (
  payload: EndpointPayload,
  expectResponse: boolean,
) => void | Promise<unknown>;

export interface CreateCallerOptions {
  sendRequest: SendRequestFn;
}

export function createCaller<T extends Schema>(
  schema: T,
  options: CreateCallerOptions,
): SchemaCaller<T> {
  return createCallerForField(schema, { options, path: [] });
}
