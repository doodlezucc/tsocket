import { assertEquals, assertThrows } from "@std/assert";
import {
  array,
  createCodecFor,
  DataType,
  object,
  oneOf,
  optional,
  Value,
} from "./data-type.ts";
import { readPacket, writePacket } from "./packet.ts";

function testCodec<T extends DataType>(dataType: T, value: Value<T>) {
  const codec = createCodecFor(dataType);

  const encoded = writePacket((p) => codec.write(p, value));
  console.log(encoded);

  const reader = readPacket(encoded);
  const decoded = codec.read(reader);

  assertEquals(decoded, value);
  assertThrows(
    () => reader.uint8(),
    "Packet yielded more data than was necessary for decoding",
  );

  return decoded;
}

Deno.test("Boolean Codec", () => {
  testCodec("boolean", false);
  testCodec("boolean", true);
});

Deno.test("Int Codec", () => {
  testCodec("int", 2352354);
  testCodec("int", -2352354);

  assertThrows(() => testCodec("int", 0.25));
});

Deno.test("Double Codec", () => {
  testCodec("double", 2352354);
  testCodec("double", -2352354);
  testCodec("double", 0.234234);
  testCodec("double", -892345.347283);
});

Deno.test("String Codec", () => {
  testCodec("string", "smol string");
  testCodec(
    "string",
    "Another string, yet a bit longer than the last one, which was relatively short.",
  );
});

Deno.test("Array Codec", () => {
  testCodec(array("double"), []);
  testCodec(array("string"), ["one string in this array"]);
  testCodec(array("double"), [-3463.3489, 234234872]);

  testCodec(array("int"), Array<number>(1000).fill(0).map((_, i) => i));
});

Deno.test("Optional Codec", () => {
  testCodec(optional("double"), undefined);
  testCodec(optional("double"), 5.25);
});

Deno.test("Object Codec", () => {
  const objectDataTypeSchema = object({
    name: "string",
    age: "int",
    isEpic: optional("boolean"),
    favouriteNumbers: array(object({
      number: "double",
      reason: optional("string"),
    })),
  });

  testCodec(objectDataTypeSchema, {
    age: 21,
    name: "Theo",
    favouriteNumbers: [
      { reason: "idk", number: 3 },
      { number: Math.PI, reason: "very rotund number" },
    ],
    isEpic: undefined,
  });

  // The optional property "isEpic" can be omitted in an object,
  // but will be deserialized as having the value "undefined".
  assertThrows(() =>
    testCodec(objectDataTypeSchema, {
      age: 21,
      name: "Theo",
      favouriteNumbers: [],
      // isEpic: false,
    })
  );
});

Deno.test("Enum Codec", () => {
  enum MyEnum {
    First,
    Second = 2,
    Third = "third",
    Fourth = "4",
    Fifth = "5th",
  }

  const codec = oneOf(MyEnum);

  testCodec(codec, MyEnum.First);
  testCodec(codec, MyEnum.Second);
  testCodec(codec, MyEnum.Third);
  testCodec(codec, MyEnum.Fourth);
  testCodec(codec, MyEnum.Fifth);
});
