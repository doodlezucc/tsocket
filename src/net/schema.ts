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

type SingleKeyObject<T, K = keyof T> = T extends SchemaFunction ? T
  : T extends SchemaCollection<infer TArr> ? Record<string, TArr>
  : K extends keyof T ?
      & {
        [P in K]: SingleKeyObject<T[K]>;
      }
      & {
        [P in keyof Omit<T, K>]?: never;
      }
  : never;

type PossibleRequest<T> = T extends (...args: infer TArgs) => unknown
  ? TArgs extends [Record<string, unknown>] ? TArgs[0]
  : TArgs
  : {
    [K in keyof T]: PossibleRequest<T[K]>;
  };

export type SchemaRequest<T extends Schema = Schema> = PossibleRequest<
  SingleKeyObject<T>
>;

type SchemaFieldAdapter<
  T extends AnySchemaField,
  TContext,
> = T extends SchemaType ? {
    [K in keyof T]: SchemaFieldAdapter<T[K], TContext>;
  }
  : T extends SchemaCollection<infer E> ? {
      get(id: string): E;
    }
  : T extends SchemaFunction<infer TArgs, infer TResult>
    ? (context: TContext, ...args: TArgs) => TResult
  : T;

export type SchemaAdapter<T extends Schema, TContext> = SchemaFieldAdapter<
  T,
  TContext
>;
