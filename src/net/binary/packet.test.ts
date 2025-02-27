import { assertEquals } from "@std/assert/equals";
import { readPacket, writePacket } from "./packet.ts";

Deno.test("Packet writing/reading", () => {
  const packet = writePacket((writer) =>
    writer.boolean(false)
      .double(61782364.23587324)
      .double(-61782364.23587324)
      .int(632458723)
      .int(-632458723)
      .string("short string")
      .string(
        "a long, well thought out string of characters with more than 64 bytes 🐛🐢🐈🐅🐆",
      )
      .boolean(true)
  );

  const reader = readPacket(packet);
  assertEquals(reader.boolean(), false);
  assertEquals(reader.double(), 61782364.23587324);
  assertEquals(reader.double(), -61782364.23587324);
  assertEquals(reader.int(), 632458723);
  assertEquals(reader.int(), -632458723);
  assertEquals(reader.string(), "short string");
  assertEquals(
    reader.string(),
    "a long, well thought out string of characters with more than 64 bytes 🐛🐢🐈🐅🐆",
  );
  assertEquals(reader.boolean(), true);
});

Deno.test("Packet allocates space when needed", () => {
  writePacket((writer) => {
    for (let i = 0; i < 1000000; i++) {
      writer.uint32(i);
    }
  });
});
