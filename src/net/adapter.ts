import { DataType, IsBaseDataType, Value } from "./binary/data-type.ts";
import {
  IndexDataType,
  SchemaCollection,
  SchemaEndpoint,
  SchemaField,
  SchemaScope,
} from "./schema.ts";

export interface AdaptedCollection<
  TContext = unknown,
  E extends SchemaScope = SchemaScope,
  TIndex extends IndexDataType = IndexDataType,
> {
  get(id: Value<TIndex>): AdaptedScope<TContext, E>;
}

export type ParameterlessAdaptedEndpoint<TContext, TResult> = (
  context: TContext,
) => TResult | Promise<TResult>;

export type ParameterizedAdaptedEndpoint<TContext, TParams, TResult> = (
  params: TParams,
  context: TContext,
) => TResult | Promise<TResult>;

export type AnyAdaptedEndpoint<
  TContext = unknown,
  TParams = unknown,
  TResult = unknown,
> =
  & ParameterlessAdaptedEndpoint<TContext, TResult>
  & ParameterizedAdaptedEndpoint<TContext, TParams, TResult>;

type AdaptedEndpoint<TParams, TResult, TContext> =
  IsBaseDataType<TParams> extends true
    ? ParameterlessAdaptedEndpoint<TContext, TResult>
    : ParameterizedAdaptedEndpoint<TContext, TParams, TResult>;

type SyncFunctionResult<TResult extends DataType> =
  IsBaseDataType<TResult> extends true ? void : Value<TResult>;

type UnwrapAdaptedEndpoint<
  TParams extends DataType,
  TResult extends DataType,
  TContext,
> = AdaptedEndpoint<Value<TParams>, SyncFunctionResult<TResult>, TContext>;

export type AnyAdaptedField =
  | AdaptedCollection<unknown>
  | UnwrapAdaptedEndpoint<DataType, DataType, unknown>
  | AdaptedScope;

export type AdaptedScope<
  TContext = unknown,
  T extends SchemaScope = SchemaScope,
> = {
  [K in keyof T]: SchemaAdapter<T[K], TContext>;
};

export type SchemaAdapter<T extends SchemaField, TContext = unknown> = T extends
  SchemaCollection<infer E, infer TIndex>
  ? AdaptedCollection<TContext, E, TIndex>
  : T extends SchemaEndpoint<infer TParams, infer TResult>
    ? UnwrapAdaptedEndpoint<TParams, TResult, TContext>
  : T extends SchemaScope ? AdaptedScope<TContext, T>
  : never;
