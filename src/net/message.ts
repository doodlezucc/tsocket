import { Schema, SchemaRequest } from "./schema.ts";

export interface Message<TSchema extends Schema = Schema> {
  request: SchemaRequest<TSchema>;
}
