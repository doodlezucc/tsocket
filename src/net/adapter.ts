import { z, ZodType } from "zod";
import { IsAny } from "../util.ts";
import {
  SchemaCollection,
  SchemaEndpoint,
  SchemaField,
  SchemaScope,
} from "./schema.ts";

export interface AdaptedCollection<
  TContext,
  E extends SchemaScope = SchemaScope,
> {
  get(id: string | number): AdaptedScope<TContext, E>;
}

export type ParameterlessAdaptedEndpoint<TContext, TResult> = (
  context: TContext,
) => TResult | Promise<TResult>;

export type ParameterizedAdaptedEndpoint<TContext, TParams, TResult> = (
  params: TParams,
  context: TContext,
) => TResult | Promise<TResult>;

export type AnyAdaptedEndpoint<TContext, TParams = unknown, TResult = unknown> =
  & ParameterlessAdaptedEndpoint<TContext, TResult>
  & ParameterizedAdaptedEndpoint<TContext, TParams, TResult>;

type AdaptedEndpoint<TParams, TResult, TContext> = IsAny<TParams> extends true
  ? ParameterlessAdaptedEndpoint<TContext, TResult>
  : ParameterizedAdaptedEndpoint<TContext, TParams, TResult>;

type SyncFunctionResult<TResult extends ZodType> =
  IsAny<z.infer<TResult>> extends true ? void
    : z.infer<TResult>;

type UnzodAdaptedEndpoint<
  TParams extends ZodType,
  TResult extends ZodType,
  TContext,
> = AdaptedEndpoint<
  z.infer<TParams>,
  SyncFunctionResult<TResult>,
  TContext
>;

export type AdaptedScope<TContext, T extends SchemaScope = SchemaScope> = {
  [K in keyof T]: SchemaAdapter<T[K], TContext>;
};

export type SchemaAdapter<T extends SchemaField, TContext = unknown> = T extends
  SchemaCollection<infer E> ? AdaptedCollection<TContext, E>
  : T extends SchemaEndpoint<infer TParams, infer TResult>
    ? UnzodAdaptedEndpoint<TParams, TResult, TContext>
  : T extends SchemaScope ? AdaptedScope<TContext, T>
  : never;
