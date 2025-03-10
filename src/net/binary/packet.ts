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
  arrayBuffer: ArrayBuffer;
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

class PacketWriterImplementation implements PacketWriter {
  private buffer: ArrayBuffer;
  private view: DataView;

  private bufferSize: number = 1024;
  private offset = 0;

  constructor() {
    this.buffer = new ArrayBuffer(this.bufferSize);
    this.view = new DataView(this.buffer);
  }

  private resizeBuffer() {
    // Modern browsers also support the resizing of buffers since approximately March 2023,
    // which would improve the performance of `resizeBuffer()`. For now, the legacy approach
    // of copying a small buffer into a larger one is used.

    // this.buffer.resize(this.bufferSize);

    const previousBytes = new Uint8Array(this.buffer);
    this.buffer = new ArrayBuffer(this.bufferSize);
    this.view = new DataView(this.buffer);

    const newBytes = new Uint8Array(this.buffer);
    newBytes.set(previousBytes);
  }

  private allocate(bytes: number) {
    const requiredSize = this.offset + bytes;

    if (requiredSize > this.bufferSize) {
      if (requiredSize > MaxPacketSize) {
        throw new Error(
          `Exceeding packet size limit of ${MaxPacketSize} bytes`,
        );
      }

      // Increase the buffer size until it can hold the new number of bytes.
      do {
        this.bufferSize *= 2;
      } while (requiredSize > this.bufferSize);

      // The do-while loop ensures a minimum number of condition checks,
      // and the buffer gets resized exactly once whenever necessary.
      this.resizeBuffer();
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
    return this.arrayBuffer(stringBytes.buffer as ArrayBuffer);
  }

  arrayBuffer(value: ArrayBuffer) {
    const size = value.byteLength;
    this.uintVarying(size);

    this.allocate(size);
    const bufferRegion = new Uint8Array(
      this.buffer,
      this.offset,
      value.byteLength,
    );

    bufferRegion.set(new Uint8Array(value));
    this.offset += value.byteLength;
    return this;
  }
}

class PacketReaderImplementation implements PacketReader {
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
    const bytes = this.arrayBuffer();
    return textDecoder.decode(bytes);
  }

  arrayBuffer(): ArrayBuffer {
    const size = this.uintVarying();
    const result = this.view.buffer.slice(this.offset, this.offset + size);

    this.offset += size;
    return result as ArrayBuffer;
  }
}

export function readPacket(packet: ArrayBuffer | DataView): PacketReader {
  if (packet instanceof ArrayBuffer) {
    return new PacketReaderImplementation(new DataView(packet));
  } else {
    return new PacketReaderImplementation(packet);
  }
}

export function writePacket(
  write: (writer: PacketWriter) => void,
): ArrayBuffer {
  const writer = new PacketWriterImplementation();
  write(writer);
  return writer.toBuffer();
}
