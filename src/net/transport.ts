import { StreamSubscription } from "../util.ts";

export interface EndpointPayload {
  path: (string | number)[];
  params?: unknown;
}

export interface DispatchMessage {
  payload: EndpointPayload;
}

export interface RequestMessage {
  id: number;
  payload: EndpointPayload;
}

export interface ResponseMessage {
  id: number;
  result: unknown;
}

export type Message = DispatchMessage | RequestMessage | ResponseMessage;

export interface ChannelTransport {
  send(message: Message): void;
  subscribe(onReceive: (message: Message) => void): StreamSubscription;
}

export interface RequestTransport {
  request(
    endpoint: EndpointPayload,
    expectResponse: boolean,
  ): void | Promise<unknown>;
}
