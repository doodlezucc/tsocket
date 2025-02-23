import { readVariableUint, writeVariableUint } from "./variable-uint.ts";

interface Types {
  boolean: boolean;

  uint8: number;
  uint16: number;
  uint32: number;
  uintVar: number;

  int: number;
  double: number;

  string: string;
}

const SizeInBytes = {
  boolean: 1,

  uint8: 1,
  uint16: 2,
  uint32: 4,

  int: 4,
  double: 8,
};

export type PacketWriter = {
  [K in keyof Types]: (value: Types[K]) => PacketWriter;
};

export type PacketReader = {
  [K in keyof Types]: () => Types[K];
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class PacketWriterImpl implements PacketWriter {
  private readonly view: DataView;
  private offset = 0;

  constructor(readonly allocatedBytes: number = 1024) {
    const buffer = new ArrayBuffer(allocatedBytes);
    this.view = new DataView(buffer);
  }

  toBuffer() {
    return this.view.buffer.slice(0, this.offset);
  }

  boolean(value: boolean) {
    return this.uint8(value ? 1 : 0);
  }

  uint8(value: number) {
    this.view.setUint8(this.offset, value);
    this.offset += SizeInBytes.uint8;
    return this;
  }

  uint16(value: number) {
    this.view.setUint16(this.offset, value);
    this.offset += SizeInBytes.uint16;
    return this;
  }

  uint32(value: number) {
    this.view.setUint32(this.offset, value);
    this.offset += SizeInBytes.uint32;
    return this;
  }

  uintVar(value: number) {
    writeVariableUint(this, value);
    return this;
  }

  int(value: number) {
    this.view.setInt32(this.offset, value);
    this.offset += SizeInBytes.int;
    return this;
  }

  double(value: number) {
    this.view.setFloat64(this.offset, value);
    this.offset += SizeInBytes.double;
    return this;
  }

  string(value: string) {
    const stringBytes = textEncoder.encode(value);
    const stringLength = stringBytes.length;
    this.uintVar(stringLength);

    const bufferRegion = new Uint8Array(
      this.view.buffer,
      this.offset,
      stringLength,
    );
    bufferRegion.set(stringBytes);

    this.offset += stringLength;
    return this;
  }
}

class PacketReaderImpl implements PacketReader {
  private offset = 0;

  constructor(private readonly view: DataView) {}

  boolean() {
    return this.uint8() === 0 ? false : true;
  }

  uint8() {
    const result = this.view.getUint8(this.offset);
    this.offset += SizeInBytes.uint8;
    return result;
  }

  uint16() {
    const result = this.view.getUint16(this.offset);
    this.offset += SizeInBytes.uint16;
    return result;
  }

  uint32() {
    const result = this.view.getUint32(this.offset);
    this.offset += SizeInBytes.uint32;
    return result;
  }

  uintVar() {
    return readVariableUint(this);
  }

  int() {
    const result = this.view.getInt32(this.offset);
    this.offset += SizeInBytes.int;
    return result;
  }

  double() {
    const result = this.view.getFloat64(this.offset);
    this.offset += SizeInBytes.double;
    return result;
  }

  string() {
    const stringLength = this.uintVar();
    const stringRegion = new Uint8Array(
      this.view.buffer,
      this.offset,
      stringLength,
    );

    const result = textDecoder.decode(stringRegion);
    this.offset += stringLength;
    return result;
  }
}

export function readPacket(packet: ArrayBuffer | DataView): PacketReader {
  if (packet instanceof ArrayBuffer) {
    return new PacketReaderImpl(new DataView(packet));
  } else {
    return new PacketReaderImpl(packet);
  }
}

export function writePacket(write: (p: PacketWriter) => void): ArrayBuffer {
  const writer = new PacketWriterImpl();
  write(writer);
  return writer.toBuffer();
}
