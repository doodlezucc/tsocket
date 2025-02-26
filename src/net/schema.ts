import { DataType } from "../binary/data-type.ts";

const DefaultCollectionIndex: DataType = "int";

export type SchemaCollection<
  E extends SchemaScope = SchemaScope,
  TIndex extends DataType = DataType,
> = [E, TIndex];

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

export function isEndpoint(
  field: SchemaField,
): field is SchemaEndpoint {
  return field instanceof SchemaEndpointImplementation;
}

export interface SchemaEndpoint<
  TParams extends DataType = DataType,
  TResult extends DataType = DataType,
> {
  accepts<T extends DataType>(params: T): SchemaEndpoint<T, TResult>;

  returns<T extends DataType>(result: T): SchemaEndpoint<TParams, T>;
}

export class SchemaEndpointImplementation<
  TParams extends DataType = DataType,
  TResult extends DataType = DataType,
> implements SchemaEndpoint<TParams, TResult> {
  constructor(readonly params?: TParams, readonly result?: TResult) {
  }

  accepts<T extends DataType>(params: T) {
    return new SchemaEndpointImplementation(params, this.result);
  }
  returns<T extends DataType>(result: T) {
    return new SchemaEndpointImplementation(this.params, result);
  }
}

const emptyEndpoint: SchemaEndpoint = new SchemaEndpointImplementation();

export function endpoint(): SchemaEndpoint {
  return emptyEndpoint;
}

export function collection<TIndex extends DataType, T extends SchemaScope>(
  index: TIndex,
  schema: T,
): SchemaCollection<T, TIndex>;
export function collection<T extends SchemaScope>(
  schema: T,
): SchemaCollection<T>;

export function collection<TIndex extends DataType, T extends SchemaScope>(
  indexOrSchema: TIndex | T,
  schemaIfTypeSpecified?: T,
): SchemaCollection<T, TIndex> {
  if (schemaIfTypeSpecified === undefined) {
    return [indexOrSchema as T, DefaultCollectionIndex as TIndex];
  } else {
    return [schemaIfTypeSpecified, indexOrSchema as TIndex];
  }
}
