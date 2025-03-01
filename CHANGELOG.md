### Preview 0.4.2 (2025-03-01)

- Added `tsocket/binary` as an exported module.
- Added `Value` type export.

### Preview 0.4.1 (2025-03-01)

- Added `"buffer"` data type for sending and receiving raw `ArrayBuffer` objects.

### Preview 0.4.0 (2025-03-01)

- Changed schemas to use custom data types instead of `zod` types.
- Dropped `zod` and `cbor2` dependencies in favor of _schema optimized_ binary transport.

### Preview 0.3.0 (2025-02-18)

- Added `codecBinary()` as a channel transport codec (using `cbor2` to encode/decode JSON objects).
- Changed endpoint syntax in schema definitions to use chained function calls, e.g. `endpoint().accepts(...).returns(...)`.

### Preview 0.2.0 (2025-02-15)

- Added `createSocket(...)` factory function.
- Added client-side WebSocket transport implementation with `transportWebSocket()`.
- Implemented bidirectional channel transport using dispatch, request and response messages.

### Preview 0.1.0 (2025-02-09)

- Initial preview release.
