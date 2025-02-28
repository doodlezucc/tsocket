import { createCaller, SchemaCaller } from "./caller.ts";
import { ChannelReceiver } from "./channel/receiver.ts";
import { ChannelSender } from "./channel/sender.ts";
import { ChannelTransportFactory } from "./channel/transport.ts";
import { Parser } from "./parser.ts";
import { indexSchema } from "./schema-indexing.ts";
import { Schema } from "./schema.ts";
import { EndpointPayload } from "./transport.ts";

export interface RequestTransport {
  request(
    endpoint: EndpointPayload,
    expectResponse: boolean,
  ): void | Promise<unknown>;
}

type LocalOptions<TSchema extends Schema, TContext> = {
  parser: Parser<TSchema, TContext>;
};

interface PartnerOptions<TSchema extends Schema> {
  schema: TSchema;
}

interface HasPartnerProcessing<TPartnerSchema extends Schema = Schema> {
  partnerProcessing: PartnerOptions<TPartnerSchema>;
}

interface HasLocalProcessing<
  TSchema extends Schema = Schema,
  // deno-lint-ignore no-explicit-any
  TContext = any,
> {
  localProcessing: LocalOptions<TSchema, TContext>;
}

interface HasRequestTransport {
  transport: RequestTransport;
}

interface HasChannelTransport {
  transport: ChannelTransportFactory;
}

interface SocketWithPartner<TPartnerSchema extends Schema = Schema> {
  partner: SchemaCaller<TPartnerSchema>;
}

type HasLocalOrPartnerProcessing =
  | HasPartnerProcessing
  | HasLocalProcessing
  | (HasPartnerProcessing & HasLocalProcessing);

type RequestOptions<T extends Schema> =
  & HasRequestTransport
  & HasPartnerProcessing<T>
  & {
    localProcessing?: never;
  };

type ChannelOptionsPartnerOnly<TPartnerSchema extends Schema> =
  & HasChannelTransport
  & HasPartnerProcessing<TPartnerSchema>;

type ChannelOptionsLocalOnly = HasChannelTransport & HasLocalProcessing;

type ChannelOptionsBoth<TPartnerSchema extends Schema> =
  & HasChannelTransport
  & HasPartnerProcessing<TPartnerSchema>
  & HasLocalProcessing;

type Options =
  | RequestOptions<Schema>
  | ChannelOptionsLocalOnly
  | ChannelOptionsPartnerOnly<Schema>
  | ChannelOptionsBoth<Schema>;

export type RequestSocket<TSchema extends Schema> = SocketWithPartner<TSchema>;

export interface LocalChannelSocket {
  dispose(): void;
}

export type ChannelSocket<TSchema extends Schema> =
  & LocalChannelSocket
  & SocketWithPartner<TSchema>;

function hasRequestTransport(
  options: HasRequestTransport | HasChannelTransport,
): options is HasRequestTransport {
  return "request" in options.transport;
}

function hasPartnerProcessing(
  options: HasLocalOrPartnerProcessing,
): options is HasPartnerProcessing {
  return "partnerProcessing" in options;
}

function hasLocalProcessing(
  options: HasLocalOrPartnerProcessing,
): options is HasLocalProcessing {
  return "localProcessing" in options;
}

function createChannelReceiver(
  options: HasChannelTransport & HasLocalProcessing,
) {
  return new ChannelReceiver(
    options.transport.create(options.localProcessing.parser.indexedSchema),
    options.localProcessing.parser,
  );
}

function createRequestSocket<TPartnerSchema extends Schema>(
  options: HasRequestTransport & HasPartnerProcessing<TPartnerSchema>,
): SocketWithPartner<TPartnerSchema> {
  return {
    partner: createCaller(options.partnerProcessing.schema, {
      sendRequest: options.transport.request,
    }),
  };
}

function createChannelSocket(
  options: HasChannelTransport & HasLocalOrPartnerProcessing,
) {
  if (hasPartnerProcessing(options)) {
    const channel = options.transport.create(
      indexSchema(options.partnerProcessing.schema),
    );

    const sender = new ChannelSender({ channel: channel });
    const partnerCaller = sender.createCaller(options.partnerProcessing.schema);

    if (hasLocalProcessing(options)) {
      // Channel transport with LOCAL and PARTNER processing
      const receiver = createChannelReceiver(options);
      return {
        partner: partnerCaller,
        dispose() {
          sender.dispose();
          receiver.dispose();
        },
      } as ChannelSocket<Schema>;
    } else {
      // Channel transport with only PARTNER processing
      return {
        partner: partnerCaller,
        dispose() {
          sender.dispose();
        },
      } as ChannelSocket<Schema>;
    }
  } else {
    // Channel transport with only LOCAL processing
    const receiver = createChannelReceiver(options);
    return {
      dispose() {
        receiver.dispose();
      },
    } as LocalChannelSocket;
  }
}

type GetReturnType<T extends Options> = T extends RequestOptions<infer TSchema>
  ? RequestSocket<TSchema>
  : T extends ChannelOptionsBoth<infer TSchema> ? ChannelSocket<TSchema>
  : T extends ChannelOptionsPartnerOnly<infer TSchema> ? ChannelSocket<TSchema>
  : T extends ChannelOptionsLocalOnly ? LocalChannelSocket
  : never;

export function createSocket<T extends Options>(
  options: T,
): GetReturnType<T> {
  if (hasRequestTransport(options)) {
    return createRequestSocket(options) as unknown as GetReturnType<T>;
  } else {
    return createChannelSocket(options) as unknown as GetReturnType<T>;
  }
}
