type SchemaCollection<E extends SchemaType> = Array<E>;

// deno-lint-ignore no-explicit-any
type SchemaFunction<TArgs extends any[] = any[], TResult = unknown> = (
  ...args: TArgs
) => TResult;

type AnySchemaField =
  | SchemaType
  | SchemaFunction
  | SchemaCollection<SchemaType>;

type SchemaType = {
  [key: string]: AnySchemaField;
};

export type Schema<T extends SchemaType = SchemaType> = T;

type FlattenObjectKeys<T, K extends keyof T = keyof T> = K extends string
  ? keyof T[K] extends never
    ? `${K}`
    : `${K}.${Flatten<T[K]>}`
  : never;

type Flatten<T> = T extends SchemaCollection<infer E>
  ? `*.${Flatten<E>}`
  : FlattenObjectKeys<T>;

export type EndpointName<T extends Schema = Schema> = Flatten<T>;

type SchemaFieldAdapter<
  T extends AnySchemaField,
  TContext
> = T extends SchemaType
  ? {
      [K in keyof T]: SchemaFieldAdapter<T[K], TContext>;
    }
  : T extends SchemaCollection<infer E>
  ? {
      get(id: string): E;
    }
  : T extends SchemaFunction<infer TArgs, infer TResult>
  ? (context: TContext, ...args: TArgs) => TResult
  : T;

export type SchemaAdapter<T extends Schema, TContext> = SchemaFieldAdapter<
  T,
  TContext
>;

export type EndpointMapping<TSchema extends Schema, TContext> = Record<
  EndpointName<TSchema>,
  (
    session: SchemaAdapter<TSchema, TContext>,
    ...ids: string[]
  ) => // deno-lint-ignore no-explicit-any
  (context: TContext, ...args: any[]) => unknown
>;
