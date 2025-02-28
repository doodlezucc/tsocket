import { StreamSubscription } from "../../util.ts";
import { Parser } from "../parser.ts";
import { Schema } from "../schema.ts";
import { DispatchMessage, RequestMessage } from "./message.ts";
import { ChannelTransport } from "./transport.ts";

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
    if ("id" in message) {
      // Handle request message
      try {
        let result = this.parser.callEndpoint(message.payload, context);

        if (result instanceof Promise) {
          result = await result;
        }

        // Send back success response
        this.channel.send({ id: message.id, result: result });
      } catch (err) {
        // Send back error response
        const errorMessage = err instanceof Error ? err.message : `${err}`;
        this.channel.send({ id: message.id, error: errorMessage });
      }
    } else {
      // Handle dispatch message
      this.parser.callEndpoint(message.payload, context);
    }
  }

  dispose() {
    this.channelSubscription.unsubscribe();
  }
}
