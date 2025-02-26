import { PacketReader, PacketWriter } from "./packet.ts";
import { Limit as VaryingUintlimit } from "./uint-varying.ts";

export type PrimitiveDataType = "boolean" | "int" | "double" | "string";
type ArrayDataType<T extends DataType> = [T];
type ObjectDataType = {
  [key: string]: DataType;
};

type EnumLike = {
  [key: string]: string | number;
};

type EnumDataType<T extends EnumLike = EnumLike> = {
  __enum: T;
};

type OptionalDataType<T extends RequiredDataType = RequiredDataType> = {
  __optional: T;
};

type PartialDataType<T extends ObjectDataType = ObjectDataType> = {
  __partial: T;
};

type RequiredDataType =
  | PrimitiveDataType
  | [DataType]
  | EnumDataType
  | PartialDataType
  | ObjectDataType;

export type DataType = RequiredDataType | OptionalDataType;

export type IsBaseDataType<T> = DataType extends T ? true : false;

export type ArrayValue<E extends DataType> = Value<E>[];
export type ObjectValue<T extends ObjectDataType> =
  & {
    [K in keyof T as T[K] extends OptionalDataType ? never : K]: Value<T[K]>;
  }
  & {
    [K in keyof T as T[K] extends OptionalDataType ? K : never]?: Value<T[K]>;
  };

export type EnumValue<T extends EnumLike> = T[keyof T];

export type Value<T extends DataType> = T extends "boolean" ? boolean
  : T extends "int" ? number
  : T extends "double" ? number
  : T extends "string" ? string
  : T extends EnumDataType<infer TEnum> ? TEnum[keyof TEnum] // This shows up as the enum itself
  : T extends OptionalDataType<infer TSubType> ? (Value<TSubType> | undefined)
  : T extends PartialDataType<infer TObject> ? Partial<ObjectValue<TObject>>
  : T extends ArrayDataType<infer E> ? ArrayValue<E>
  : T extends ObjectDataType ? ObjectValue<T>
  : never;

export function oneOf<T extends EnumLike>(type: T): EnumDataType<T> {
  return { __enum: type };
}

export function optional<T extends DataType>(type: T): OptionalDataType<T> {
  return { __optional: type };
}

export function partial<T extends ObjectDataType>(
  object: T,
): PartialDataType<T> {
  return { __partial: object };
}

export function array<E extends DataType>(elementType: E): ArrayDataType<E> {
  return [elementType];
}

export function object<T extends ObjectDataType>(object: T): T {
  return object;
}

// deno-lint-ignore no-explicit-any
export interface BinaryCodec<T = any> {
  write: (writer: PacketWriter, value: T) => void;
  read: (reader: PacketReader) => T;
}

export type DataTypeCodec<T extends DataType = DataType> = BinaryCodec<
  Value<T>
>;

const CodecUint8: DataTypeCodec<"int"> = {
  write: (writer, value) => writer.uint8(value),
  read: (reader) => reader.uint8(),
};
const CodecUint16: DataTypeCodec<"int"> = {
  write: (writer, value) => writer.uint16(value),
  read: (reader) => reader.uint16(),
};
const CodecUint32: DataTypeCodec<"int"> = {
  write: (writer, value) => writer.uint32(value),
  read: (reader) => reader.uint32(),
};
const CodecUintVarying: DataTypeCodec<"int"> = {
  write: (writer, value) => writer.uintVarying(value),
  read: (reader) => reader.uintVarying(),
};

const CodecBoolean: DataTypeCodec<"boolean"> = {
  write: (writer, value) => writer.boolean(value),
  read: (reader) => reader.boolean(),
};
const CodecInt: DataTypeCodec<"int"> = {
  write: (writer, value) => writer.int(value),
  read: (reader) => reader.int(),
};
const CodecDouble: DataTypeCodec<"double"> = {
  write: (writer, value) => writer.double(value),
  read: (reader) => reader.double(),
};
const CodecString: DataTypeCodec<"string"> = {
  write: (writer, value) => writer.string(value),
  read: (reader) => reader.string(),
};

class CodecArray<E extends DataType> implements BinaryCodec<ArrayValue<E>> {
  private readonly elementCodec: DataTypeCodec<E>;

  constructor(elementType: E) {
    this.elementCodec = createCodecFor(elementType);
  }

  write(writer: PacketWriter, array: ArrayValue<E>) {
    writer.uintVarying(array.length);
    for (const element of array) {
      this.elementCodec.write(writer, element);
    }
  }

  read(reader: PacketReader) {
    const result: ArrayValue<E> = [];
    const arrayLength = reader.uintVarying();

    for (let i = 0; i < arrayLength; i++) {
      result.push(this.elementCodec.read(reader));
    }

    return result;
  }
}

class CodecObject<T extends ObjectDataType>
  implements BinaryCodec<ObjectValue<T>> {
  private readonly entryCodecs: [string, DataTypeCodec][];

  constructor(dataType: ObjectDataType) {
    this.entryCodecs = Object.entries(dataType)
      .map(([key, type]) => [key, createCodecFor(type)]);
  }

  write(writer: PacketWriter, object: Record<string, Value<DataType>>) {
    for (const [key, propertyCodec] of this.entryCodecs) {
      const value = object[key];
      propertyCodec.write(writer, value);
    }
  }

  read(reader: PacketReader) {
    const result: Record<string, unknown> = {};

    for (const [key, propertyCodec] of this.entryCodecs) {
      const value = propertyCodec.read(reader);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result as ObjectValue<T>;
  }
}

class CodecEnum<T extends EnumLike> implements BinaryCodec<EnumValue<T>> {
  private readonly indexingCodec: DataTypeCodec<"int">;
  private readonly enumValues: EnumValue<T>[];

  constructor(enumType: T) {
    // Remove reverse mappings from the compiled TypeScript enum.
    // https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings
    const enumEntries = Object.entries(enumType).filter(([key]) =>
      isNaN(Number(key))
    );

    this.enumValues = enumEntries.map(([_, value]) => value) as EnumValue<T>[];
    this.indexingCodec = createCodecForNaturalInteger({
      exclusiveMaximum: this.enumValues.length,
    });
  }

  write(writer: PacketWriter, value: EnumValue<T>) {
    const index = this.enumValues.indexOf(value);
    this.indexingCodec.write(writer, index);
  }

  read(reader: PacketReader) {
    const index = this.indexingCodec.read(reader);
    return this.enumValues[index];
  }
}

class CodecOptional<T extends RequiredDataType>
  implements BinaryCodec<Value<T> | undefined> {
  private readonly definedCodec: BinaryCodec<Value<T>>;

  constructor(subType: T) {
    this.definedCodec = createCodecFor(subType);
  }

  write(writer: PacketWriter, value: Value<T> | undefined) {
    if (value !== undefined) {
      writer.boolean(true);
      this.definedCodec.write(writer, value);
    } else {
      writer.boolean(false);
    }
  }

  read(reader: PacketReader) {
    const isDefined = reader.boolean();
    if (isDefined) {
      return this.definedCodec.read(reader);
    } else {
      return undefined;
    }
  }
}

function createCodecForPartialObject<T extends ObjectDataType>(
  object: T,
) {
  const objectWithOptionals: Record<string, OptionalDataType> = {};

  for (const key in object) {
    const propertyDataType = object[key] as DataType;
    if (isOptionalDataType(propertyDataType)) {
      objectWithOptionals[key] = propertyDataType;
    } else {
      objectWithOptionals[key] = optional(propertyDataType);
    }
  }

  return new CodecObject(objectWithOptionals) as unknown as DataTypeCodec<
    PartialDataType<T>
  >;
}

interface NaturalIntegerOptions {
  exclusiveMaximum: number;
}

export function createCodecForNaturalInteger(options: NaturalIntegerOptions) {
  const { exclusiveMaximum } = options;

  if (exclusiveMaximum <= 0xff) {
    return CodecUint8;
  } else if (exclusiveMaximum <= VaryingUintlimit.Uint16) {
    return CodecUintVarying;
  } else if (exclusiveMaximum <= 0xffff) {
    return CodecUint16;
  } else if (exclusiveMaximum <= VaryingUintlimit.Uint32) {
    return CodecUintVarying;
  } else {
    return CodecUint32;
  }
}

export function createCodecFor<T extends DataType>(type: T): DataTypeCodec<T> {
  return uncheckedCreateCodecFor(type) as unknown as DataTypeCodec<T>;
}

function isEnumDataType(type: DataType & object): type is EnumDataType {
  return "__enum" in type;
}
function isPartialDataType(type: DataType & object): type is PartialDataType {
  return "__partial" in type;
}
function isOptionalDataType(type: DataType): type is OptionalDataType {
  return typeof type === "object" && "__optional" in type;
}

function uncheckedCreateCodecFor<T extends DataType>(type: T) {
  if (typeof type === "string") {
    switch (type) {
      case "boolean":
        return CodecBoolean;
      case "int":
        return CodecInt;
      case "double":
        return CodecDouble;
      case "string":
        return CodecString;
      default:
        throw new Error(`Invalid primitive type ${type}`);
    }
  } else if (Array.isArray(type)) {
    const elementType = type[0];
    return new CodecArray(elementType);
  } else if (isEnumDataType(type)) {
    return new CodecEnum(type.__enum);
  } else if (isPartialDataType(type)) {
    return createCodecForPartialObject(type.__partial);
  } else if (isOptionalDataType(type)) {
    return new CodecOptional(type.__optional);
  } else {
    return new CodecObject(type);
  }
}
