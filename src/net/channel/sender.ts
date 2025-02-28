import { StreamSubscription } from "../../util.ts";
import { EndpointPayload, Sender } from "../transport.ts";
import { ResponseMessage } from "./message.ts";
import { ChannelTransport } from "./transport.ts";

type ResponseHandler = (result: unknown) => void;

interface ChannelSenderOptions {
  channel: ChannelTransport;
}

export class ChannelSender extends Sender {
  readonly channel: ChannelTransport;

  private readonly channelSubscription: StreamSubscription;
  private readonly responseHandlerMap = new Map<number, ResponseHandler>();

  constructor(options: ChannelSenderOptions) {
    super();
    this.channel = options.channel;

    this.channelSubscription = this.channel.subscribe((message) => {
      if ("result" in message) {
        this.handleResponse(message);
      }
    });
  }

  private handleResponse(message: ResponseMessage): void {
    const { id, result } = message;

    const handler = this.responseHandlerMap.get(id);

    if (!handler) {
      return console.warn(
        `Received unexpected response for unawaited request ID ${id}`,
      );
    }

    this.responseHandlerMap.delete(id);
    handler(result);
  }

  request<T>(endpoint: EndpointPayload): Promise<T> {
    let requestId = 0;

    // Find smallest unused request ID
    while (this.responseHandlerMap.has(requestId)) {
      requestId++;
    }

    return new Promise((resolve) => {
      this.responseHandlerMap.set(requestId, (result) => {
        resolve(result as T);
      });

      this.channel.send({
        id: requestId,
        payload: endpoint,
      });
    });
  }

  dispatch(endpoint: EndpointPayload): void {
    this.channel.send({
      payload: endpoint,
    });
  }

  dispose(): void {
    this.channelSubscription.unsubscribe();
  }
}
