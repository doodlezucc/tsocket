import { ZodType } from "zod";

type SchemaCollection<T extends SchemaScope = SchemaScope> = [T];

type SchemaEndpoint<
  TParams extends ZodType = ZodType,
  TResult extends ZodType = ZodType,
> = {
  accepts?: TParams;
  returns?: TResult;
};

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

export function endpoint<
  TParams extends ZodType,
  TResult extends ZodType,
>(
  endpoint?: SchemaEndpoint<TParams, TResult>,
): SchemaEndpoint<TParams, TResult> {
  return endpoint ?? {};
}

export function collection<T extends SchemaScope>(
  schema: T,
): SchemaCollection<T> {
  return [schema];
}

// interface UncheckedZodTypeDef extends ZodTypeDef {
//   unchecked: true;
// }

// type Unchecked<T> = ZodType<T, UncheckedZodTypeDef>;

const UNCHECKED = {};

export function unchecked<T>(): ZodType<T> {
  // return { _def: { unchecked: true } } as Unchecked<T>;
  return UNCHECKED as ZodType<T>;
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
  IsAny<ZodOutput<TResult>> extends true ? void : ZodOutput<TResult>
>;

export type SchemaCaller<T extends SchemaField> = T extends
  SchemaCollection<infer E> ? {
    get(id: string): SchemaCaller<E>;
  }
  : T extends SchemaEndpoint<infer TParams, infer TResult>
    ? ModelFunctionFrom<TParams, TResult>
  : T extends SchemaScope ? {
      [K in keyof T]: SchemaCaller<T[K]>;
    }
  : never;
