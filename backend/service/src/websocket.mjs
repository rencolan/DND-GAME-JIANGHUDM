import crypto from "node:crypto";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function encodeFrame(opcode, payloadBuffer = Buffer.alloc(0)) {
  const payloadLength = payloadBuffer.length;
  let header;

  if (payloadLength < 126) {
    header = Buffer.from([0x80 | opcode, payloadLength]);
  } else if (payloadLength < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  return Buffer.concat([header, payloadBuffer]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const fin = Boolean(firstByte & 0x80);
  const opcode = firstByte & 0x0f;
  const masked = Boolean(secondByte & 0x80);
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (!fin) {
    throw new Error("Fragmented WebSocket frames are not supported.");
  }

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + payloadLength) return null;

  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  offset += maskLength;

  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return {
    opcode,
    payload,
    bytesConsumed: offset + payloadLength,
    masked
  };
}

export function acceptWebSocketUpgrade(request, socket, head, handlers) {
  const key = request.headers["sec-websocket-key"];

  if (typeof key !== "string" || !key) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return null;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(key + WS_MAGIC)
    .digest("base64");

  const responseHeaders = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n"
  ];

  socket.write(responseHeaders.join("\r\n"));

  let buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
  let closed = false;
  let closeNotified = false;

  function notifyClose() {
    if (closeNotified) return;
    closeNotified = true;
    handlers.onClose?.();
  }

  const connection = {
    request,
    sendText(text) {
      if (closed) return;
      socket.write(encodeFrame(0x1, Buffer.from(text, "utf8")));
    },
    sendJson(payload) {
      connection.sendText(JSON.stringify(payload));
    },
    close(code = 1000, reason = "") {
      if (closed) return;
      const reasonBuffer = Buffer.from(reason, "utf8");
      const payload = Buffer.alloc(2 + reasonBuffer.length);
      payload.writeUInt16BE(code, 0);
      reasonBuffer.copy(payload, 2);
      socket.write(encodeFrame(0x8, payload));
      socket.end();
      closed = true;
      notifyClose();
    },
    destroy() {
      closed = true;
      socket.destroy();
      notifyClose();
    }
  };

  function processBuffer() {
    while (buffer.length > 0) {
      const frame = decodeFrame(buffer);
      if (!frame) return;
      buffer = buffer.subarray(frame.bytesConsumed);

      if (!frame.masked && frame.opcode !== 0x8 && frame.opcode !== 0xA) {
        connection.close(1002, "Client frames must be masked.");
        return;
      }

      if (frame.opcode === 0x8) {
        closed = true;
        socket.end();
        notifyClose();
        return;
      }

      if (frame.opcode === 0x9) {
        socket.write(encodeFrame(0xA, frame.payload));
        continue;
      }

      if (frame.opcode === 0xA) {
        continue;
      }

      if (frame.opcode !== 0x1) {
        connection.close(1003, "Only text frames are supported.");
        return;
      }

      handlers.onMessage?.(frame.payload.toString("utf8"), connection);
    }
  }

  socket.on("data", (chunk) => {
    if (closed) return;
    buffer = Buffer.concat([buffer, chunk]);

    try {
      processBuffer();
    } catch (error) {
      handlers.onError?.(error, connection);
      connection.close(1011, "WebSocket frame error");
    }
  });

  socket.on("error", (error) => {
    if (closed) return;
    handlers.onError?.(error, connection);
  });

  socket.on("close", () => {
    closed = true;
    notifyClose();
  });

  return connection;
}
