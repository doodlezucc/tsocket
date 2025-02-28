import { EndpointPayload } from "../transport.ts";

export type Message = DispatchMessage | RequestMessage | ResponseMessage;

export type ResponseMessage = ResponseResultMessage | ResponseErrorMessage;

export interface DispatchMessage {
  payload: EndpointPayload;
}

export interface RequestMessage {
  id: number;
  payload: EndpointPayload;
}

export interface ResponseResultMessage {
  id: number;
  result: unknown;
}

export interface ResponseErrorMessage {
  id: number;
  error: string;
}
