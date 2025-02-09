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
