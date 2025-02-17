import { EndpointPayload } from "../transport.ts";

export type Message = DispatchMessage | RequestMessage | ResponseMessage;

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
