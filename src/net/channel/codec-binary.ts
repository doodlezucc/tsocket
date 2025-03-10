import {
  BinaryCodec,
  CodecUint8,
  CodecUintVarying,
  createCodecFor,
  DataTypeCodec,
  oneOf,
} from "../binary/data-type.ts";
import {
  PacketReader,
  PacketWriter,
  readPacket,
  writePacket,
} from "../binary/packet.ts";
import { IndexedSchema } from "../schema-indexing.ts";
import { IndexDataType } from "../schema.ts";
import { EndpointPayload } from "../transport.ts";
import { MessageCodec, MessageCodecFactory } from "./codec.ts";
import {
  Message,
  RequestMessage,
  ResponseErrorMessage,
  ResponseResultMessage,
} from "./message.ts";

class EndpointPayloadCodec implements BinaryCodec<EndpointPayload> {
  constructor(private readonly schema: IndexedSchema) {}

  write(writer: PacketWriter, payload: EndpointPayload) {
    const { endpointIndex, collectionIndices, params } = payload;

    this.schema.endpointIndexCodec.write(writer, payload.endpointIndex);

    const endpoint = this.schema.indexedEndpoints[endpointIndex];
    const collectionDepth = endpoint.collectionIndexCodecs.length;

    for (let i = 0; i < collectionDepth; i++) {
      const collectionIndexCodec = endpoint.collectionIndexCodecs[i];
      const collectionIndex = collectionIndices[i];

      collectionIndexCodec.write(writer, collectionIndex);
    }

    if (endpoint.paramsCodec !== undefined) {
      // Endpoint accepts parameters
      endpoint.paramsCodec.write(writer, params);
    }
  }

  read(reader: PacketReader): EndpointPayload {
    const endpointIndex = this.schema.endpointIndexCodec.read(reader);
    const endpoint = this.schema.indexedEndpoints[endpointIndex];

    const collectionIndices: IndexDataType[] = [];

    for (const collectionIndexCodec of endpoint.collectionIndexCodecs) {
      const collectionIndex = collectionIndexCodec.read(reader);
      collectionIndices.push(collectionIndex);
    }

    if (endpoint.paramsCodec !== undefined) {
      // Endpoint accepts parameters
      const params = endpoint.paramsCodec.read(reader);
      return { endpointIndex, collectionIndices, params };
    }

    return { endpointIndex, collectionIndices };
  }
}

enum MessageType {
  Dispatch,
  Request,
  Response,
  ResponseError,
}

const CodecMessageType = createCodecFor(oneOf(MessageType));

class StatefulMessageBinaryCodec implements BinaryCodec<Message> {
  private readonly partnerEndpointCodec?: EndpointPayloadCodec;
  private readonly localEndpointCodec?: EndpointPayloadCodec;

  private readonly outgoingRequestResultCodecs = new Map<number, BinaryCodec>();
  private readonly incomingRequestResultCodecs = new Map<number, BinaryCodec>();

  constructor(
    readonly requestIdCodec: DataTypeCodec<"int">,
    readonly partnerSchema?: IndexedSchema,
    readonly localSchema?: IndexedSchema,
  ) {
    if (partnerSchema) {
      this.partnerEndpointCodec = new EndpointPayloadCodec(partnerSchema);
    }

    if (localSchema) {
      this.localEndpointCodec = new EndpointPayloadCodec(localSchema);
    }
  }

  private getPartnerEndpointResult(endpointIndex: number) {
    const indexedEndpoint = this.partnerSchema!.indexedEndpoints[endpointIndex];

    return indexedEndpoint.resultCodec!;
  }

  private getLocalEndpointResult(endpointIndex: number) {
    const indexedEndpoint = this.localSchema!.indexedEndpoints[endpointIndex];

    return indexedEndpoint.resultCodec!;
  }

  private useStoredRequestResultCodec(
    requestId: number,
    idToCodecMap: Map<number, BinaryCodec>,
  ) {
    const resultCodec = idToCodecMap.get(requestId);
    if (!resultCodec) {
      throw new Error(
        "The message encoder didn't record a request with this ID and can't send a response",
      );
    }

    idToCodecMap.delete(requestId);
    return resultCodec;
  }

  private writeRequestBody(writer: PacketWriter, message: RequestMessage) {
    const { id: requestId, payload } = message;

    const resultCodec = this.getPartnerEndpointResult(payload.endpointIndex);

    // Register the endpoint result's codec for use in `readResponse...Body(...)`
    this.outgoingRequestResultCodecs.set(requestId, resultCodec);

    this.requestIdCodec.write(writer, requestId);
    this.partnerEndpointCodec!.write(writer, payload);
  }

  private readResponseResultBody(reader: PacketReader): ResponseResultMessage {
    const requestId = this.requestIdCodec.read(reader);

    const resultCodec = this.useStoredRequestResultCodec(
      requestId,
      this.outgoingRequestResultCodecs,
    );

    return { id: requestId, result: resultCodec.read(reader) };
  }

  private readResponseErrorBody(reader: PacketReader): ResponseErrorMessage {
    const requestId = this.requestIdCodec.read(reader);
    this.useStoredRequestResultCodec(
      requestId,
      this.outgoingRequestResultCodecs,
    );

    return { id: requestId, error: reader.string() };
  }

  private readRequestBody(reader: PacketReader): RequestMessage {
    const requestId = this.requestIdCodec.read(reader);
    const payload = this.localEndpointCodec!.read(reader);

    const resultCodec = this.getLocalEndpointResult(payload.endpointIndex);

    // Register the endpoint result's codec for use in `writeResponseBody(...)`
    this.incomingRequestResultCodecs.set(requestId, resultCodec);

    return { id: requestId, payload };
  }

  private writeResponseResultBody(
    writer: PacketWriter,
    message: ResponseResultMessage,
  ) {
    const { id: requestId, result } = message;

    const resultCodec = this.useStoredRequestResultCodec(
      requestId,
      this.incomingRequestResultCodecs,
    );

    this.requestIdCodec.write(writer, requestId);
    resultCodec.write(writer, result);
  }

  private writeResponseErrorBody(
    writer: PacketWriter,
    message: ResponseErrorMessage,
  ) {
    const { id: requestId, error } = message;
    this.useStoredRequestResultCodec(
      requestId,
      this.incomingRequestResultCodecs,
    );

    this.requestIdCodec.write(writer, requestId);
    writer.string(error);
  }

  write(writer: PacketWriter, message: Message) {
    if ("payload" in message) {
      if ("id" in message) {
        CodecMessageType.write(writer, MessageType.Request);

        this.writeRequestBody(writer, message);
      } else {
        CodecMessageType.write(writer, MessageType.Dispatch);

        this.partnerEndpointCodec!.write(writer, message.payload);
      }
    } else {
      if ("result" in message) {
        CodecMessageType.write(writer, MessageType.Response);

        this.writeResponseResultBody(writer, message);
      } else {
        CodecMessageType.write(writer, MessageType.ResponseError);

        this.writeResponseErrorBody(writer, message);
      }
    }
  }

  read(reader: PacketReader): Message {
    const messageType = CodecMessageType.read(reader);
    switch (messageType) {
      case MessageType.Dispatch:
        return { payload: this.localEndpointCodec!.read(reader) };
      case MessageType.Request:
        return this.readRequestBody(reader);
      case MessageType.Response:
        return this.readResponseResultBody(reader);
      case MessageType.ResponseError:
        return this.readResponseErrorBody(reader);
    }
  }
}

interface PacketMessageCodecOptions {
  partnerSchema?: IndexedSchema;
  localSchema?: IndexedSchema;
  requestIdCodec: DataTypeCodec<"int">;
}

export class PacketMessageCodec implements MessageCodec<ArrayBuffer> {
  private readonly binaryCodec: StatefulMessageBinaryCodec;

  constructor(options: PacketMessageCodecOptions) {
    this.binaryCodec = new StatefulMessageBinaryCodec(
      options.requestIdCodec,
      options.partnerSchema,
      options.localSchema,
    );
  }

  encode(message: Message): ArrayBuffer {
    return writePacket((writer) => {
      this.binaryCodec.write(writer, message);
    });
  }

  decode(message: ArrayBuffer): Message {
    const reader = readPacket(message);
    return this.binaryCodec.read(reader);
  }
}

interface BinaryMessageCodecOptions {
  /**
   * Enabling this allows more than 256 requests to be awaited at the same time.
   * The option is disabled by default because it adds a slight computational overhead.
   *
   * @default false
   */
  enableUnclampedSimultaneousRequests?: boolean;
}

export function codecBinary(
  options?: BinaryMessageCodecOptions,
): MessageCodecFactory<ArrayBuffer> {
  const enableUnclampedSimultaneousRequests =
    options?.enableUnclampedSimultaneousRequests ?? false;

  const requestIdCodec = enableUnclampedSimultaneousRequests
    ? CodecUintVarying
    : CodecUint8;

  return {
    create: ({ partnerSchema, localSchema }) =>
      new PacketMessageCodec({ partnerSchema, localSchema, requestIdCodec }),
  };
}
