import { Schema } from "./schema.ts";

export interface Configuration<TSchema extends Schema = Schema> {
  schema: TSchema;
}
