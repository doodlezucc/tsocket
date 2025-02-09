import { ParseInput, ParseReturnType, ZodType } from "zod";

export type SchemaCollection<T extends SchemaScope = SchemaScope> = [T];

interface SchemaEndpointProperties<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> {
  accepts?: TParams;
  returns?: TResult;
}

export interface SchemaEndpoint<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> extends SchemaEndpointProperties<TParams, TResult> {
  endpointToken: true;
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
