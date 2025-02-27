import { readVariableUint, writeVariableUint } from "./uint-varying.ts";

interface Types {
  boolean: boolean;

  uint8: number;
  uint16: number;
  uint32: number;
  uintVarying: number;

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

const MaxPacketSize = 0xffffff; // 16 MiB (or 16.78 MB)

class PacketWriterImpl implements PacketWriter {
  private readonly buffer: ArrayBuffer;
  private readonly view: DataView;

  private bufferSize: number = 1024;
  private offset = 0;

  constructor() {
    this.buffer = new ArrayBuffer(this.bufferSize, {
      maxByteLength: MaxPacketSize,
    });
    this.view = new DataView(this.buffer);
  }

  private allocate(bytes: number) {
    const requiredSize = this.offset + bytes;

    if (requiredSize > this.bufferSize) {
      // Increase the buffer size until it can hold the new number of bytes.
      do {
        this.bufferSize *= 2;
      } while (requiredSize > this.bufferSize);

      // The do-while loop ensures a minimum number of condition checks,
      // and the buffer gets resized exactly once whenever necessary.
      this.buffer.resize(this.bufferSize);
    }
  }

  toBuffer() {
    return this.buffer.slice(0, this.offset);
  }

  boolean(value: boolean) {
    return this.uint8(value ? 1 : 0);
  }

  uint8(value: number) {
    this.allocate(SizeInBytes.uint8);

    this.view.setUint8(this.offset, value);
    this.offset += SizeInBytes.uint8;
    return this;
  }

  uint16(value: number) {
    this.allocate(SizeInBytes.uint16);

    this.view.setUint16(this.offset, value);
    this.offset += SizeInBytes.uint16;
    return this;
  }

  uint32(value: number) {
    this.allocate(SizeInBytes.uint32);

    this.view.setUint32(this.offset, value);
    this.offset += SizeInBytes.uint32;
    return this;
  }

  uintVarying(value: number) {
    writeVariableUint(this, value);
    return this;
  }

  int(value: number) {
    this.allocate(SizeInBytes.int);

    this.view.setInt32(this.offset, value);
    this.offset += SizeInBytes.int;
    return this;
  }

  double(value: number) {
    this.allocate(SizeInBytes.double);

    this.view.setFloat64(this.offset, value);
    this.offset += SizeInBytes.double;
    return this;
  }

  string(value: string) {
    const stringBytes = textEncoder.encode(value);
    const stringSize = stringBytes.length;
    this.uintVarying(stringSize);

    this.allocate(stringSize);
    const bufferRegion = new Uint8Array(
      this.view.buffer,
      this.offset,
      stringSize,
    );
    bufferRegion.set(stringBytes);

    this.offset += stringSize;
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

  uintVarying() {
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
    const stringLength = this.uintVarying();
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

export function writePacket(
  write: (writer: PacketWriter) => void,
): ArrayBuffer {
  const writer = new PacketWriterImpl();
  write(writer);
  return writer.toBuffer();
}
