import {
  BinaryCodec,
  createCodecFor,
  createCodecForNaturalInteger,
  DataTypeCodec,
} from "../binary/data-type.ts";
import {
  AdaptedCollection,
  AdaptedScope,
  AnyAdaptedEndpoint,
  AnyAdaptedField,
  SchemaAdapter,
} from "./adapter.ts";
import {
  IndexDataType,
  IndexType,
  isEndpoint,
  Schema,
  SchemaCollection,
  SchemaEndpointImplementation,
  SchemaField,
  SchemaScope,
} from "./schema.ts";

export interface IndexedSchema<T extends Schema = Schema> {
  readonly indexedEndpoints: IndexedEndpoint[];
  readonly endpointIndexCodec: DataTypeCodec<"int">;

  readonly indexedAdaptedEndpoints: IndexedAdaptedEndpoint<T>[];
}

export interface IndexedEndpoint {
  collectionIndexCodecs: BinaryCodec[];
  paramsCodec?: BinaryCodec;
  resultCodec?: BinaryCodec;
}

interface IndexedAdaptedEndpoint<T extends Schema> {
  resolveInAdapter<TContext>(
    adapter: SchemaAdapter<T, TContext>,
    collectionIndices: IndexType[],
  ): AnyAdaptedEndpoint;
}

interface RecursiveContext<T extends Schema> {
  collectionIndexCodecs: DataTypeCodec<IndexDataType>[];
  resolveInAdapter<TContext>(
    adapter: SchemaAdapter<T, TContext>,
    indices: IndexType[],
  ): AnyAdaptedField;
}

class SchemaIndexer<T extends Schema> {
  private indexedEndpoints: IndexedEndpoint[] = [];
  private indexedAdaptedEndpoints: IndexedAdaptedEndpoint<T>[] = [];

  constructor(private readonly schema: T) {}

  traverse(): IndexedSchema<T> {
    // Clean up state of previous call
    this.indexedEndpoints = [];
    this.indexedAdaptedEndpoints = [];

    this.traverseScope(this.schema, {
      collectionIndexCodecs: [],
      resolveInAdapter: (adapter) => adapter as AdaptedScope,
    });

    return {
      indexedEndpoints: this.indexedEndpoints,
      indexedAdaptedEndpoints: this.indexedAdaptedEndpoints,

      endpointIndexCodec: createCodecForNaturalInteger({
        exclusiveMaximum: this.indexedEndpoints.length,
      }),
    };
  }

  private traverseScope(scope: SchemaScope, context: RecursiveContext<T>) {
    for (const [key, field] of Object.entries(scope)) {
      this.traverseField(field, {
        ...context,

        resolveInAdapter(adapter, indices) {
          const outerScope = context.resolveInAdapter(adapter, indices);
          return (outerScope as AdaptedScope)[key];
        },
      });
    }
  }

  private traverseField(field: SchemaField, context: RecursiveContext<T>) {
    if (isEndpoint(field)) {
      return this.registerEndpoint(field, context);
    } else if (Array.isArray(field)) {
      return this.traverseCollection(field, context);
    } else {
      return this.traverseScope(field, context);
    }
  }

  private traverseCollection(
    collection: SchemaCollection,
    context: RecursiveContext<T>,
  ) {
    const schemaInsideCollection = collection[0];
    const collectionIndex = collection[1];

    const currentCollectionDepth = context.collectionIndexCodecs.length;

    return this.traverseScope(schemaInsideCollection, {
      ...context,

      // Every endpoint INSIDE this collection can ONLY be called
      // by passing a "collection index" in the payload. In case
      // of a collection WITHIN a collection, multiple indices
      // are required for referencing any of the nested endpoints.
      //
      // This is comparable to REST APIs with parameterized endpoints, e.g.
      // `PUT /users/[user-id]/posts/[post-id]`
      collectionIndexCodecs: [
        ...context.collectionIndexCodecs,
        createCodecFor(collectionIndex),
      ],

      resolveInAdapter(adapter, indices) {
        const adaptedField = context.resolveInAdapter(adapter, indices);
        const adaptedCollection = adaptedField as AdaptedCollection;

        return adaptedCollection.get(indices[currentCollectionDepth]);
      },
    });
  }

  private registerEndpoint(
    endpoint: SchemaEndpointImplementation,
    context: RecursiveContext<T>,
  ) {
    this.indexedEndpoints.push({
      collectionIndexCodecs: context.collectionIndexCodecs,

      paramsCodec: endpoint.params !== undefined
        ? createCodecFor(endpoint.params)
        : undefined,

      resultCodec: endpoint.result !== undefined
        ? createCodecFor(endpoint.result)
        : undefined,
    });

    this.indexedAdaptedEndpoints.push({
      resolveInAdapter(adapter, indices) {
        return context.resolveInAdapter(adapter, indices) as AnyAdaptedEndpoint;
      },
    });
  }
}

export function indexSchema<T extends Schema>(schema: T): IndexedSchema<T> {
  const indexer = new SchemaIndexer(schema);
  return indexer.traverse();
}
