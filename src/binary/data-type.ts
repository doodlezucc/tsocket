import { PacketReader, PacketWriter } from "./packet.ts";
import { Limit as VaryingUintlimit } from "./uint-varying.ts";

type PrimitiveDataType = "boolean" | "int" | "double" | "string";
type ArrayDataType<T extends DataType> = [T];
type ObjectDataType = {
  [key: string]: DataType;
};

type OptionalDataType<T extends RequiredDataType = RequiredDataType> = {
  _optional: T;
};

type RequiredDataType = PrimitiveDataType | [DataType] | ObjectDataType;

export type DataType = RequiredDataType | OptionalDataType;

export type ArrayValue<E extends DataType> = Value<E>[];
export type ObjectValue<T extends ObjectDataType> =
  & {
    [K in keyof T as T[K] extends OptionalDataType ? never : K]: Value<T[K]>;
  }
  & {
    [K in keyof T as T[K] extends OptionalDataType ? K : never]?: Value<T[K]>;
  };

export type Value<T extends DataType> = T extends "boolean" ? boolean
  : T extends "int" ? number
  : T extends "double" ? number
  : T extends "string" ? string
  : T extends OptionalDataType<infer TSubType> ? (Value<TSubType> | undefined)
  : T extends ArrayDataType<infer E> ? ArrayValue<E>
  : T extends ObjectDataType ? ObjectValue<T>
  : never;

export function array<E extends DataType>(elementType: E): ArrayDataType<E> {
  return [elementType];
}

export function optional<T extends DataType>(type: T): OptionalDataType<T> {
  return { _optional: type };
}

export function object<T extends ObjectDataType>(object: T): T {
  return object;
}

export interface DataTypeCodec<
  T extends DataType = DataType,
  TValue = Value<T>,
> {
  write: (writer: PacketWriter, value: TValue) => void;
  read: (reader: PacketReader) => TValue;
}

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

class CodecArray<E extends DataType>
  implements DataTypeCodec<ArrayDataType<E>, ArrayValue<E>> {
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
  implements DataTypeCodec<T, ObjectValue<T>> {
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
      result[key] = value;
    }

    return result as ObjectValue<T>;
  }
}

class CodecOptional<T extends RequiredDataType>
  implements DataTypeCodec<OptionalDataType<T>> {
  private readonly subTypeCodec: DataTypeCodec<T>;

  constructor(subType: T) {
    this.subTypeCodec = createCodecFor(subType);
  }

  write(writer: PacketWriter, value: Value<T> | undefined) {
    if (value !== undefined) {
      writer.boolean(true);
      this.subTypeCodec.write(writer, value);
    } else {
      writer.boolean(false);
    }
  }

  read(reader: PacketReader) {
    const isDefined = reader.boolean();
    if (isDefined) {
      return this.subTypeCodec.read(reader);
    } else {
      return undefined;
    }
  }
}

export function createCodecForNaturalInteger(exclusiveMaximum: number) {
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
  } else if (type._optional) {
    return new CodecOptional(type._optional);
  } else {
    return new CodecObject(type);
  }
}
