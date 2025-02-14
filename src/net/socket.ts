import { Disposable } from "../util.ts";
import { SchemaAdapter } from "./adapter.ts";
import { createCaller, SchemaCaller } from "./caller.ts";
import { createParser } from "./parser.ts";
import { ChannelReceiver } from "./receiver.ts";
import { Schema } from "./schema.ts";
import { ChannelSender } from "./sender.ts";
import { ChannelTransport, RequestTransport } from "./transport.ts";

type LocalOptions<TSchema extends Schema, TContext> = {
  schema: TSchema;
  adapter: SchemaAdapter<TSchema, TContext>;
  composeContext: () => TContext;
};

interface PartnerOptions<TSchema extends Schema> {
  schema: TSchema;
}

interface HasPartnerProcessing<TPartnerSchema extends Schema = Schema> {
  partnerProcessing: PartnerOptions<TPartnerSchema>;
}

interface HasLocalProcessing<
  TSchema extends Schema = Schema,
  TContext = unknown,
> {
  localProcessing: LocalOptions<TSchema, TContext>;
}

interface HasRequestTransport {
  transport: RequestTransport;
}

interface HasChannelTransport {
  transport: ChannelTransport;
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

type ChannelOptionsPartnerOnly<T extends Schema> =
  & HasChannelTransport
  & HasPartnerProcessing<T>;

type ChannelOptionsLocalOnly = HasChannelTransport & HasLocalProcessing;

type ChannelOptionsBoth<T extends Schema> =
  & HasChannelTransport
  & HasPartnerProcessing<T>
  & HasLocalProcessing;

type Options =
  | RequestOptions<Schema>
  | ChannelOptionsLocalOnly
  | ChannelOptionsPartnerOnly<Schema>
  | ChannelOptionsBoth<Schema>;

function hasRequestTransport(
  options: HasRequestTransport | HasChannelTransport,
): options is HasRequestTransport {
  return "request" in options.transport;
}

function hasPartnerProcessing(
  options: HasLocalOrPartnerProcessing,
): options is HasPartnerProcessing {
  return "partner" in options;
}

function hasLocalProcessing(
  options: HasLocalOrPartnerProcessing,
): options is HasLocalProcessing {
  return "local" in options;
}

function createChannelReceiver(
  options: HasChannelTransport & HasLocalProcessing,
) {
  const { schema, adapter, composeContext } = options.localProcessing;

  return new ChannelReceiver(
    options.transport,
    createParser(schema, adapter),
    composeContext,
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
    const sender = new ChannelSender({ channel: options.transport });
    const partnerCaller = sender.createCaller(options.partnerProcessing.schema);

    if (hasLocalProcessing(options)) {
      // Channel transport with LOCAL and PARTNER processing
      const receiver = createChannelReceiver(options);
      return <Disposable & SocketWithPartner> {
        partner: partnerCaller,
        dispose() {
          sender.dispose();
          receiver.dispose();
        },
      };
    } else {
      // Channel transport with only PARTNER processing
      return <Disposable & SocketWithPartner> {
        partner: partnerCaller,
        dispose() {
          sender.dispose();
        },
      };
    }
  } else {
    // Channel transport with only LOCAL processing
    const receiver = createChannelReceiver(options);
    return <Disposable> {
      dispose() {
        receiver.dispose();
      },
    };
  }
}

type GetReturnType<T extends Options> =
  & (T extends HasPartnerProcessing<infer TPartnerSchema>
    ? SocketWithPartner<TPartnerSchema>
    : unknown)
  & (T extends HasChannelTransport ? Disposable : unknown);

export function createSocket<T extends Options>(
  options: T,
): GetReturnType<T> {
  if (hasRequestTransport(options)) {
    return createRequestSocket(options) as unknown as GetReturnType<T>;
  } else {
    return createChannelSocket(options) as unknown as GetReturnType<T>;
  }
}
