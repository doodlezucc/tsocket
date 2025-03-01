export { createCodecFor, createCodecForNaturalInteger } from "./data-type.ts";
export type {
  ArrayValue,
  BinaryCodec,
  DataType,
  DataTypeCodec,
  EnumValue,
  ObjectValue,
} from "./data-type.ts";
export { readPacket, writePacket } from "./packet.ts";
export type { PacketReader, PacketWriter } from "./packet.ts";
export { readVariableUint, writeVariableUint } from "./uint-varying.ts";
