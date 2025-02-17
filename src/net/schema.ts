import {
  ParseInput,
  ParseReturnType,
  z,
  ZodObject,
  ZodRawShape,
  ZodType,
} from "zod";

export type SchemaCollection<T extends SchemaScope = SchemaScope> = [T];

interface SchemaEndpointProperties<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> {
  accepts?: TParams;
  returns?: TResult;
}

export type SchemaField =
  | SchemaCollection
  | SchemaEndpoint
  | SchemaScope;

export type SchemaScope = {
  [key: string]: SchemaField;
};

export type Schema = SchemaScope;

export function schema<T extends Schema>(schema: T) {
  return schema;
}

export function isEndpoint(field: SchemaField): field is SchemaEndpoint {
  return field instanceof SchemaEndpointImplementation;
}

export interface SchemaEndpoint<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> {
  accepts<T extends ZodRawShape>(
    params: T,
  ): SchemaEndpoint<ZodObject<T>, TResult>;
  accepts<T extends ZodType>(params: T): SchemaEndpoint<T, TResult>;

  returns<T extends ZodRawShape>(
    result: T,
  ): SchemaEndpoint<TParams, ZodObject<T>>;
  returns<T extends ZodType>(result: T): SchemaEndpoint<TParams, T>;
}

export class SchemaEndpointImplementation<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> implements SchemaEndpoint<TParams, TResult> {
  constructor(readonly params?: TParams, readonly result?: TResult) {
  }

  accepts<T extends ZodType | ZodRawShape>(params: T) {
    if (params instanceof ZodType) {
      return new SchemaEndpointImplementation(params, this.result);
    } else {
      return new SchemaEndpointImplementation(z.object(params), this.result);
    }
  }
  returns<T extends ZodType | ZodRawShape>(result: T) {
    if (result instanceof ZodType) {
      return new SchemaEndpointImplementation(this.params, result);
    } else {
      return new SchemaEndpointImplementation(this.params, z.object(result));
    }
  }
}

const emptyEndpoint: SchemaEndpoint = new SchemaEndpointImplementation();

export function endpoint(): SchemaEndpoint {
  return emptyEndpoint;
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
