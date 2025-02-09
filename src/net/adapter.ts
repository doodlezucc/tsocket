import { IsAny, ZodOutput } from "../util.ts";
import { CallerFunctionResult } from "./caller.ts";
import {
  SchemaCollection,
  SchemaEndpoint,
  SchemaField,
  SchemaScope,
} from "./schema.ts";

type SchemaEndpointAdapterFunction<TParams, TResult, TContext> =
  IsAny<TParams> extends true ? (context: TContext) => TResult
    : (params: TParams, context: TContext) => TResult;

type SchemaEndpointAdapter<TParams, TResult, TContext> =
  SchemaEndpointAdapterFunction<
    ZodOutput<TParams>,
    CallerFunctionResult<TResult>,
    TContext
  >;

export type SchemaAdapter<T extends SchemaField, TContext> = T extends
  SchemaCollection<infer E> ? {
    get(id: string | number): SchemaAdapter<E, TContext>;
  }
  : T extends SchemaEndpoint<infer TParams, infer TResult>
    ? SchemaEndpointAdapter<TParams, TResult, TContext>
  : T extends SchemaScope ? {
      [K in keyof T]: SchemaAdapter<T[K], TContext>;
    }
  : never;
