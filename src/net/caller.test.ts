import {
  assertEquals,
  assertGreater,
  assertGreaterOrEqual,
  assertLess,
} from "@std/assert";
import { spy, SpyLike } from "@std/testing/mock";
import { oneOf } from "../binary/data-type.ts";
import { createCaller } from "./caller.ts";
import { collection, endpoint, IndexType, schema } from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

enum AreaStatus {
  Unvisited,
  Visited,
}

const TestSchema = schema({
  sandbox: {
    increaseCounter: endpoint(),

    areas: collection({
      setStatus: endpoint().accepts(oneOf(AreaStatus)),
    }),
  },

  community: {
    users: collection("string", {
      updateNickname: endpoint().accepts("string"),

      posts: collection({
        update: endpoint().accepts({
          content: "string",
        }).returns("boolean"),

        delete: endpoint(),
      }),
    }),
  },
});

interface SendRequestCall {
  collectionIndices: IndexType[];
  params: unknown;

  expectResponse: boolean;
}

function assertSendRequestCall(
  spy: SpyLike<unknown, [payload: EndpointPayload, expectResponse: boolean]>,
  expectedCall: SendRequestCall,
) {
  assertGreater(spy.calls.length, 0);
  const lastCallArgs = spy.calls[spy.calls.length - 1].args;

  // Assert that the endpoint index is defined and a natural number
  assertGreaterOrEqual(lastCallArgs[0].endpointIndex, 0);
  assertLess(lastCallArgs[0].endpointIndex, 5);

  assertEquals(
    lastCallArgs[0].collectionIndices,
    expectedCall.collectionIndices,
  );
  assertEquals(lastCallArgs[0].params, expectedCall.params);
  assertEquals(lastCallArgs[1], expectedCall.expectResponse);
}

Deno.test("Caller produces correct payload", () => {
  const sendRequestSpy = spy(
    (payload: EndpointPayload, expectResponse: boolean) => {
      console.log("Payload:", payload, "Expect response:", expectResponse);

      if (expectResponse) {
        return Promise.resolve(true);
      }
    },
  );

  const partner = createCaller(TestSchema, {
    sendRequest: sendRequestSpy,
  });

  partner.sandbox.increaseCounter();
  assertSendRequestCall(sendRequestSpy, {
    collectionIndices: [],
    params: undefined,
    expectResponse: false,
  });

  partner.sandbox.areas.get(51).setStatus(AreaStatus.Visited);
  assertSendRequestCall(sendRequestSpy, {
    collectionIndices: [51],
    params: AreaStatus.Visited,
    expectResponse: false,
  });

  partner.community.users.get("user-1").updateNickname("Nick");
  assertSendRequestCall(sendRequestSpy, {
    collectionIndices: ["user-1"],
    params: "Nick",
    expectResponse: false,
  });

  partner.community.users.get("user-1").posts.get(0).delete();
  assertSendRequestCall(sendRequestSpy, {
    collectionIndices: ["user-1", 0],
    params: undefined,
    expectResponse: false,
  });

  partner.community.users.get("user-1").posts.get(1234).update({
    content: "This is my first updated post",
  });
  assertSendRequestCall(sendRequestSpy, {
    collectionIndices: ["user-1", 1234],
    params: { content: "This is my first updated post" },
    expectResponse: true,
  });
});
