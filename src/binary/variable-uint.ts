import { PacketReader, PacketWriter } from "./packet.ts";

enum Header {
  Uint8 = 0b00_000000,
  Uint16 = 0b01_000000,
  Uint24 = 0b10_000000,
  Uint32 = 0b11_000000,
}

enum Limits {
  Uint8 = 0b00111111,
  Uint16 = 0b00111111_11111111,
  Uint24 = 0b00111111_11111111_11111111,
  Uint32 = 0b00111111_11111111_11111111_11111111,
}

export function writeVariableUint(writer: PacketWriter, naturalInt: number) {
  if (naturalInt <= Limits.Uint8) {
    writer.uint8(Header.Uint8 | naturalInt);
  } else if (naturalInt <= Limits.Uint16) {
    writer.uint8(Header.Uint16 | (naturalInt >> 8));
    writer.uint8(naturalInt & 0xFF);
  } else if (naturalInt <= Limits.Uint24) {
    writer.uint8(Header.Uint24 | (naturalInt >> 16));
    writer.uint8((naturalInt >> 8) & 0xFF);
    writer.uint8(naturalInt & 0xFF);
  } else if (naturalInt <= Limits.Uint32) {
    writer.uint8(Header.Uint32 | (naturalInt >> 24));
    writer.uint8((naturalInt >> 16) & 0xFF);
    writer.uint8((naturalInt >> 8) & 0xFF);
    writer.uint8(naturalInt & 0xFF);
  } else {
    throw new Error(
      `${naturalInt} exceeds maximum 4-byte variable-uint value`,
    );
  }
}

export function readVariableUint(reader: PacketReader): number {
  const firstByte = reader.uint8();
  const header = firstByte & 0b11000000;

  let result = firstByte & 0b00111111;

  if (header > Header.Uint8) {
    result = (result << 8) | reader.uint8();

    if (header > Header.Uint16) {
      result = (result << 8) | reader.uint8();

      if (header > Header.Uint24) {
        result = (result << 8) | reader.uint8();
      }
    }
  }

  return result;
}
