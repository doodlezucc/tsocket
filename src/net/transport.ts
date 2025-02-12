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

export interface Channel<TEncoding> {
  send(data: TEncoding): void;
  subscribe(onNewData: (data: TEncoding) => void): StreamSubscription;
}

export interface StreamSubscription {
  unsubscribe(): void;
}

export class WebSocketChannel implements Channel<string> {
  constructor(readonly socket: WebSocket) {}

  send(data: string) {
    this.socket.send(data);
  }

  subscribe(onNewData: (data: string) => void): StreamSubscription {
    const listener = (ev: MessageEvent) => onNewData(ev.data);

    this.socket.addEventListener("message", listener);

    return {
      unsubscribe: () => this.socket.removeEventListener("message", listener),
    };
  }
}
