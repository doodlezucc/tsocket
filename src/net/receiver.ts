import { StreamSubscription } from "../util.ts";
import { Parser } from "./parser.ts";
import { Schema } from "./schema.ts";
import {
  ChannelTransport,
  DispatchMessage,
  RequestMessage,
} from "./transport.ts";

export class ChannelReceiver<TContext> {
  private readonly channelSubscription: StreamSubscription;

  constructor(
    readonly channel: ChannelTransport,
    readonly parser: Parser<Schema, TContext>,
  ) {
    this.channelSubscription = channel.subscribe((message) => {
      if ("payload" in message) {
        this.processEndpointCall(message);
      }
    });
  }

  async processEndpointCall(
    message: DispatchMessage | RequestMessage,
    context?: TContext,
  ) {
    let result = this.parser.callEndpoint(message.payload, context);

    if ("id" in message) {
      if (result instanceof Promise) {
        result = await result;
      }

      this.channel.send({
        id: message.id,
        result: result,
      });
    }
  }

  dispose() {
    this.channelSubscription.unsubscribe();
  }
}
