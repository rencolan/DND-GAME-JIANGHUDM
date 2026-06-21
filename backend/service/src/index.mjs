import http from "node:http";
import { URL } from "node:url";
import { loadServiceConfig } from "./config.mjs";
import { BridgeRegistry } from "./bridgeRegistry.mjs";
import { acceptWebSocketUpgrade } from "./websocket.mjs";
import { authorizeHttpRequest, readJsonBody, sendError, sendJson, applyCorsHeaders } from "./http.mjs";
import {
  ERROR_CODES,
  MESSAGE_TYPES,
  normalizeOpenAiResponse,
  parseJsonMessage,
  sanitizeChatCompletionRequest
} from "../../shared/protocol.mjs";

const config = loadServiceConfig();
const registry = new BridgeRegistry({ requestTimeoutMs: config.requestTimeoutMs, logger: console });

function bridgeIdFromRequest(request) {
  const header = request.headers["x-bridge-id"];
  return typeof header === "string" && header.trim() ? header.trim() : config.defaultBridgeId;
}

const server = http.createServer(async (request, response) => {
  applyCorsHeaders(response);

  if (!request.url || !request.method) {
    sendError(response, {
      code: ERROR_CODES.BAD_REQUEST,
      message: "Invalid request.",
      status: 400
    });
    return;
  }

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, {
      ok: true,
      service: "jianghu-dm-backend",
      now: Date.now()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/status") {
    const auth = authorizeHttpRequest(request, config.clientApiKey);
    if (!auth.ok) {
      sendError(response, auth.error);
      return;
    }

    sendJson(response, 200, registry.getStatus(bridgeIdFromRequest(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
    const auth = authorizeHttpRequest(request, config.clientApiKey);
    if (!auth.ok) {
      sendError(response, auth.error);
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      sendError(response, {
        code: ERROR_CODES.BAD_REQUEST,
        message: "Request body is not valid JSON.",
        status: 400
      });
      return;
    }

    const parsed = sanitizeChatCompletionRequest(body);
    if (!parsed.ok) {
      sendError(response, parsed.error);
      return;
    }

    try {
      const bridgeResponse = await registry.enqueueChatCompletion({
        bridgeId: bridgeIdFromRequest(request),
        payload: parsed.payload
      });

      sendJson(response, 200, normalizeOpenAiResponse(bridgeResponse, parsed.payload.model));
    } catch (error) {
      sendError(response, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || "Bridge request failed.",
        status: error.status || 500,
        details: error.details
      });
    }
    return;
  }

  sendError(response, {
    code: ERROR_CODES.BAD_REQUEST,
    message: "Route not found.",
    status: 404
  });
});

server.on("upgrade", (request, socket, head) => {
  if (!request.url) {
    socket.destroy();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/ws/bridge") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  let registeredBridgeId = null;
  let registeredConnectionId = null;

  const connection = acceptWebSocketUpgrade(request, socket, head, {
    onMessage(rawMessage, websocket) {
      let message;
      try {
        message = parseJsonMessage(rawMessage);
      } catch (error) {
        websocket.sendJson({
          type: MESSAGE_TYPES.ERROR,
          error: {
            code: ERROR_CODES.BAD_REQUEST,
            message: error instanceof Error ? error.message : "Invalid protocol message."
          }
        });
        websocket.close(1008, "Invalid protocol message");
        return;
      }

      if (!registeredBridgeId) {
        if (message.type !== MESSAGE_TYPES.REGISTER) {
          websocket.sendJson({
            type: MESSAGE_TYPES.ERROR,
            error: {
              code: ERROR_CODES.UNAUTHORIZED,
              message: "Bridge must register before sending any other message."
            }
          });
          websocket.close(1008, "Registration required");
          return;
        }

        if (message.bridgeSecret !== config.bridgeSecret) {
          websocket.sendJson({
            type: MESSAGE_TYPES.ERROR,
            error: {
              code: ERROR_CODES.UNAUTHORIZED,
              message: "Bridge secret is invalid."
            }
          });
          websocket.close(1008, "Unauthorized");
          return;
        }

        registeredBridgeId = typeof message.bridgeId === "string" && message.bridgeId.trim()
          ? message.bridgeId.trim()
          : config.defaultBridgeId;

        const registered = registry.registerConnection({
          bridgeId: registeredBridgeId,
          model: typeof message.model === "string" ? message.model : "",
          remoteAddress: request.socket.remoteAddress || "unknown",
          websocket
        });
        registeredConnectionId = registered.connectionId;

        console.log(`[bridge] registered ${registeredBridgeId} from ${request.socket.remoteAddress || "unknown"}`);
        return;
      }

      if (message.type === MESSAGE_TYPES.HEARTBEAT) {
        registry.touchHeartbeat(registeredBridgeId, typeof message.model === "string" ? message.model : "");
        return;
      }

      if (message.type === MESSAGE_TYPES.RESULT) {
        registry.resolveRequest(message.requestId, message.response);
        return;
      }

      if (message.type === MESSAGE_TYPES.ERROR) {
        registry.rejectRequest(message.requestId, {
          code: message.error?.code || ERROR_CODES.INTERNAL_ERROR,
          message: message.error?.message || "Bridge returned an error.",
          status: message.error?.status || 502,
          details: message.error?.details
        });
        return;
      }

      websocket.sendJson({
        type: MESSAGE_TYPES.ERROR,
        error: {
          code: ERROR_CODES.BAD_REQUEST,
          message: `Unsupported message type: ${message.type}`
        }
      });
    },
    onClose() {
      if (registeredBridgeId && registeredConnectionId) {
        console.log(`[bridge] disconnected ${registeredBridgeId}`);
        registry.handleDisconnectByConnectionId(registeredBridgeId, registeredConnectionId);
      }
    },
    onError(error) {
      console.error("[bridge] websocket error", error);
    }
  });

  if (!connection) {
    socket.destroy();
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`[service] listening on http://0.0.0.0:${config.port}`);
  console.log(`[service] default bridge id: ${config.defaultBridgeId}`);
});
