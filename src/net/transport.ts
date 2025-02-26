import { createCaller } from "./caller.ts";
import { IndexType, Schema } from "./schema.ts";

export interface EndpointPayload {
  endpointIndex: number;
  collectionIndices: IndexType[];
  params?: unknown;
}

export abstract class Sender {
  abstract dispatch(endpoint: EndpointPayload): void;
  abstract request<T>(endpoint: EndpointPayload): Promise<T>;

  createCaller<T extends Schema>(partnerSchema: T) {
    return createCaller(partnerSchema, {
      sendRequest: (payload, expectResponse) => {
        if (expectResponse) {
          return this.request(payload);
        } else {
          this.dispatch(payload);
        }
      },
    });
  }
}
