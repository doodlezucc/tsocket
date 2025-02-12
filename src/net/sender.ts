import { Codec } from "./codec.ts";
import {
  Channel,
  EndpointPayload,
  ResponseMessage,
  StreamSubscription,
} from "./transport.ts";

export interface Sender {
  dispatch(endpoint: EndpointPayload): void;
  request<T>(endpoint: EndpointPayload): Promise<T>;
}

// export interface Receiver {
//   processIncomingMessage(message: DispatchMessage): void;
//   processIncomingMessage(message: RequestMessage): Promise<ResponseMessage>;
// }

type ResponseHandler = (result: unknown) => void;

class SenderImplementation<TEncoding> implements Sender {
  private readonly channelSubscription: StreamSubscription;
  private readonly responseHandlerMap = new Map<number, ResponseHandler>();
  private sequenceNumber: number = 0;

  constructor(
    readonly channel: Channel<TEncoding>,
    readonly codec: Codec<TEncoding>,
  ) {
    this.channelSubscription = channel.subscribe((data) => {
      try {
        const message = codec.decode(data);

        if ("result" in message) {
          this.handleResponse(message);
        }
      } catch (err) {
        return console.error("Failed to decode response message:", err);
      }
    });
  }

  private handleResponse(message: ResponseMessage): void {
    const { id, result } = message;

    const handler = this.responseHandlerMap.get(id);

    if (!handler) {
      return console.warn(
        `Received unexpected response for unawaited sequence number ${id}`,
      );
    }

    handler(result);
  }

  request<T>(endpoint: EndpointPayload): Promise<T> {
    const requestSequenceNumber = this.sequenceNumber;
    this.sequenceNumber++;

    return new Promise((resolve) => {
      this.responseHandlerMap.set(requestSequenceNumber, (result) => {
        resolve(result as T);
      });

      this.channel.send(this.codec.encode({
        id: requestSequenceNumber,
        payload: endpoint,
      }));
    });
  }

  dispatch(endpoint: EndpointPayload): void {
    this.channel.send(this.codec.encode({
      payload: endpoint,
    }));
  }

  dispose(): void {
    this.channelSubscription.unsubscribe();
  }
}

interface SenderOptions<TEncoding> {
  channel: Channel<TEncoding>;
  codec: Codec<TEncoding>;
}

export function createSender<TEncoding>(
  options: SenderOptions<TEncoding>,
): Sender {
  return new SenderImplementation(options.channel, options.codec);
}
