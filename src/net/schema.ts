type SchemaCollection<E extends SchemaType> = Array<E>;

type SchemaFunction = (...args: never[]) => unknown;

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

export type MessageName<T extends Schema = Schema> = Flatten<T>;

type SchemaFieldAdapter<T extends AnySchemaField> = T extends SchemaType
  ? {
      [K in keyof T]: SchemaFieldAdapter<T[K]>;
    }
  : T extends SchemaCollection<infer E>
  ? {
      get(id: string): E;
    }
  : T;

export type SchemaAdapter<T extends Schema> = SchemaFieldAdapter<T>;

type SchemaOfMessageName<T extends MessageName> = T extends MessageName<
  infer TSchema
>
  ? TSchema
  : never;

// export type MessageDefinition<T extends MessageName> =
//   (typeof transportMessageMapping)[T];

// export type MessageIdentifiers<T extends MessageName> = Parameters<
//   MessageDefinition<T>
// > extends [unknown, ...infer MParams]
//   ? MParams
//   : never;

// export type Message<T extends MessageName> = ReturnType<MessageDefinition<T>>;
// export type MessageParameters<T extends MessageName> = Parameters<Message<T>>;
// export type MessageReturnType<T extends MessageName> = ReturnType<Message<T>>;

export type MessageMapping<TSchema extends Schema> = Record<
  MessageName<TSchema>,
  (
    session: SchemaAdapter<TSchema>,
    ...ids: string[]
  ) => (...args: never) => unknown
>;
