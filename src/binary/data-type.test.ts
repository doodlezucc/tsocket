import { assertEquals, assertThrows } from "@std/assert";
import {
  array,
  createCodecFor,
  DataType,
  object,
  oneOf,
  optional,
  partial,
  Value,
} from "./data-type.ts";
import { readPacket, writePacket } from "./packet.ts";

interface TestCodecOptions {
  disableEqualityAssertion: boolean;
}

function testCodec<T extends DataType>(
  dataType: T,
  value: Value<T>,
  options?: TestCodecOptions,
) {
  const codec = createCodecFor(dataType);

  const encoded = writePacket((p) => codec.write(p, value));
  console.log(encoded);

  const reader = readPacket(encoded);
  const decoded = codec.read(reader);

  const disableEqualityCheck = options?.disableEqualityAssertion ?? false;
  if (!disableEqualityCheck) {
    assertEquals(decoded, value);
  }

  assertThrows(
    () => reader.uint8(),
    "Packet yielded more data than was necessary for decoding",
  );

  return decoded;
}

function testCodecNoAssertEquals<T extends DataType>(
  dataType: T,
  value: Value<T>,
) {
  return testCodec(dataType, value, { disableEqualityAssertion: true });
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
    isEpic: false,
  });

  testCodec(objectDataTypeSchema, {
    age: 21,
    name: "Theo",
    favouriteNumbers: [],
  });

  // The optional property "isEpic" can be passed as "undefined" in the input,
  // but will be omitted from the output after deserializing.
  // Therefore the input and output is not EXACTLY equal.
  const decodedObject = testCodecNoAssertEquals(
    objectDataTypeSchema,
    {
      isEpic: undefined,
      age: 21,
      name: "Theo",
      favouriteNumbers: [],
    },
  );

  assertEquals(decodedObject, { name: "Theo", age: 21, favouriteNumbers: [] });
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

Deno.test("Partial Object Codec", () => {
  const baseObjectType = object({
    requiredString: "string",
    optionalDouble: optional("double"),
  });

  const optionalObjectType = partial(baseObjectType);

  testCodec(optionalObjectType, {});
  testCodec(optionalObjectType, {
    requiredString: "this is a string",
  });
  testCodec(optionalObjectType, {
    optionalDouble: 0.25,
  });
  testCodec(optionalObjectType, {
    requiredString: "this is a string",
    optionalDouble: 0.25,
  });

  // Assert that explicit "undefined" values get omitted after encoding/decoding
  assertEquals(
    testCodecNoAssertEquals(optionalObjectType, {
      requiredString: undefined,
      optionalDouble: undefined,
    }),
    {},
  );
  assertEquals(
    testCodecNoAssertEquals(optionalObjectType, {
      requiredString: "this is a string",
      optionalDouble: undefined,
    }),
    { requiredString: "this is a string" },
  );
  assertEquals(
    testCodecNoAssertEquals(optionalObjectType, {
      requiredString: undefined,
      optionalDouble: 0.25,
    }),
    { optionalDouble: 0.25 },
  );
});
