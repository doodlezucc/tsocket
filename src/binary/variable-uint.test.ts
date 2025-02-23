import { assertEquals, assertThrows } from "@std/assert";
import { readPacket, writePacket } from "./packet.ts";
import { readVariableUint, writeVariableUint } from "./variable-uint.ts";

Deno.test("Variable UInt size is minimal", () => {
  function packedUint(value: number) {
    return writePacket((p) => writeVariableUint(p, value));
  }

  assertEquals(packedUint(0).byteLength, 1);
  assertEquals(packedUint(0b00111111).byteLength, 1);
  assertEquals(packedUint(0b01000000).byteLength, 2);

  assertEquals(packedUint(0b00111111_11111111).byteLength, 2);
  assertEquals(packedUint(0b01000000_00000000).byteLength, 3);

  assertEquals(packedUint(0b00111111_11111111_11111111).byteLength, 3);
  assertEquals(packedUint(0b01000000_00000000_00000000).byteLength, 4);

  assertEquals(packedUint(0b00111111_11111111_11111111_11111111).byteLength, 4);
  assertThrows(() => packedUint(0b01000000_00000000_00000000_00000000));
});

Deno.test("Variable UInt gets encoded correctly", () => {
  function testForValue(value: number) {
    const packet = writePacket((p) => writeVariableUint(p, value));

    const reader = readPacket(packet);
    assertEquals(readVariableUint(reader), value);
  }

  testForValue(0);
  testForValue(1);
  testForValue(2);
  testForValue(0b00111111);
  testForValue(0b01000000);

  testForValue(0b00111111_11111111);
  testForValue(0b01000000_00000000);

  testForValue(0b00111111_11111111_11111111);
  testForValue(0b01000000_00000000_00000000);

  testForValue(0b00111111_11111111_11111111_11111111);
});
