import { BinaryCodec, createCodecFor, oneOf } from "../binary/data-type.ts";
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
import { Message, RequestMessage, ResponseMessage } from "./message.ts";

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
}

const CodecMessageType = createCodecFor(oneOf(MessageType));

class StatefulMessageBinaryCodec implements BinaryCodec<Message> {
  private readonly endpointPayloadCodec: EndpointPayloadCodec;
  private readonly outgoingRequestResultCodecs = new Map<number, BinaryCodec>();
  private readonly incomingRequestResultCodecs = new Map<number, BinaryCodec>();

  constructor(readonly indexedSchema: IndexedSchema) {
    this.endpointPayloadCodec = new EndpointPayloadCodec(indexedSchema);
  }

  private getEndpointResultCodec(endpointIndex: number) {
    const indexedEndpoint = this.indexedSchema.indexedEndpoints[endpointIndex];

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

    // TODO: Instead of every increasing request IDs, resolved/rejected requests
    // could free up their ID so that it can be used again in a different request.
    // This would allow using a smaller data type here.
    //
    // A uint8 would still allow up to 256 simultaneous requests, which should be enough?
    // Alternatively, a varying uint would allow 2^32 parallel requests, but comes with a
    // small additional computing cost.
    writer.uint32(requestId);

    const resultCodec = this.getEndpointResultCodec(payload.endpointIndex);

    // Register the endpoint result's codec for use in `readResponseBody(...)`
    this.outgoingRequestResultCodecs.set(requestId, resultCodec);
    this.endpointPayloadCodec.write(writer, payload);
  }

  private readResponseBody(reader: PacketReader): ResponseMessage {
    const requestId = reader.uint32();

    const resultCodec = this.useStoredRequestResultCodec(
      requestId,
      this.outgoingRequestResultCodecs,
    );

    return { id: requestId, result: resultCodec.read(reader) };
  }

  private readRequestBody(reader: PacketReader): RequestMessage {
    const requestId = reader.uint32();
    const payload = this.endpointPayloadCodec.read(reader);

    const resultCodec = this.getEndpointResultCodec(payload.endpointIndex);

    // Register the endpoint result's codec for use in `writeResponseBody(...)`
    this.incomingRequestResultCodecs.set(requestId, resultCodec);

    return { id: requestId, payload };
  }

  private writeResponseBody(writer: PacketWriter, message: ResponseMessage) {
    const { id: requestId, result } = message;

    writer.uint32(requestId);

    const resultCodec = this.useStoredRequestResultCodec(
      requestId,
      this.incomingRequestResultCodecs,
    );
    resultCodec.write(writer, result);
  }

  write(writer: PacketWriter, message: Message) {
    if ("payload" in message) {
      if ("id" in message) {
        CodecMessageType.write(writer, MessageType.Request);

        this.writeRequestBody(writer, message);
      } else {
        CodecMessageType.write(writer, MessageType.Dispatch);

        this.endpointPayloadCodec.write(writer, message.payload);
      }
    } else {
      CodecMessageType.write(writer, MessageType.Response);

      this.writeResponseBody(writer, message);
    }
  }

  read(reader: PacketReader): Message {
    const messageType = CodecMessageType.read(reader);
    switch (messageType) {
      case MessageType.Dispatch:
        return { payload: this.endpointPayloadCodec.read(reader) };
      case MessageType.Request:
        return this.readRequestBody(reader);
      case MessageType.Response:
        return this.readResponseBody(reader);
    }
  }
}

export class PacketMessageCodec implements MessageCodec<ArrayBuffer> {
  private readonly binaryCodec!: StatefulMessageBinaryCodec;

  constructor(indexedSchema: IndexedSchema) {
    this.binaryCodec = new StatefulMessageBinaryCodec(indexedSchema);
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

export function codecBinary(): MessageCodecFactory<ArrayBuffer> {
  return {
    create: (indexedSchema) => new PacketMessageCodec(indexedSchema),
  };
}
