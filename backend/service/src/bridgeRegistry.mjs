import crypto from "node:crypto";
import {
  ERROR_CODES,
  createBridgeTaskMessage
} from "../../shared/protocol.mjs";

function createError(code, message, status, details) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

export class BridgeRegistry {
  constructor({ requestTimeoutMs, logger = console }) {
    this.requestTimeoutMs = requestTimeoutMs;
    this.logger = logger;
    this.connections = new Map();
    this.pendingRequests = new Map();
  }

  registerConnection({ bridgeId, model, remoteAddress, websocket }) {
    const existing = this.connections.get(bridgeId);
    if (existing) {
      this.#dropConnection(existing, createError(
        ERROR_CODES.BRIDGE_DISCONNECTED,
        `Bridge ${bridgeId} was replaced by a new connection.`,
        502
      ));
      existing.websocket.close(1000, "Replaced by a new bridge connection");
    }

    const connection = {
      connectionId: crypto.randomUUID(),
      bridgeId,
      model: model || "",
      remoteAddress,
      websocket,
      lastHeartbeatAt: Date.now(),
      queue: [],
      busy: false
    };

    this.connections.set(bridgeId, connection);
    return connection;
  }

  touchHeartbeat(bridgeId, model) {
    const connection = this.connections.get(bridgeId);
    if (!connection) return;
    connection.lastHeartbeatAt = Date.now();
    if (typeof model === "string" && model.trim()) {
      connection.model = model.trim();
    }
  }

  getStatus(bridgeId) {
    const connection = this.connections.get(bridgeId);
    if (!connection) {
      return {
        bridgeId,
        online: false,
        lastHeartbeatAt: null,
        model: null,
        queueLength: 0,
        busy: false
      };
    }

    return {
      bridgeId,
      online: true,
      lastHeartbeatAt: connection.lastHeartbeatAt,
      model: connection.model || null,
      queueLength: connection.queue.length,
      busy: connection.busy
    };
  }

  enqueueChatCompletion({ bridgeId, payload }) {
    const connection = this.connections.get(bridgeId);
    if (!connection) {
      return Promise.reject(createError(
        ERROR_CODES.BRIDGE_OFFLINE,
        `Bridge ${bridgeId} is offline.`,
        502
      ));
    }

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      connection.queue.push({
        requestId,
        payload,
        resolve,
        reject
      });
      this.logger.log(`[bridge] queued request ${requestId} for ${bridgeId}`);
      this.#dispatchNext(connection);
    });
  }

  resolveRequest(requestId, response) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.connection.busy = false;
    this.logger.log(`[bridge] completed request ${requestId} from ${pending.connection.bridgeId}`);
    pending.resolve(response);
    this.#dispatchNext(pending.connection);
  }

  rejectRequest(requestId, { code, message, status, details }) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.connection.busy = false;
    this.logger.warn?.(`[bridge] rejected request ${requestId} from ${pending.connection.bridgeId}: ${message}`);
    pending.reject(createError(code, message, status || 502, details));
    this.#dispatchNext(pending.connection);
  }

  handleDisconnect(bridgeId) {
    const connection = this.connections.get(bridgeId);
    if (!connection) return;

    this.#dropConnection(connection, createError(
      ERROR_CODES.BRIDGE_DISCONNECTED,
      `Bridge ${bridgeId} disconnected.`,
      502
    ));
  }

  handleDisconnectByConnectionId(bridgeId, connectionId) {
    const connection = this.connections.get(bridgeId);
    if (!connection || connection.connectionId !== connectionId) return;
    this.handleDisconnect(bridgeId);
  }

  #dropConnection(connection, error) {
    this.connections.delete(connection.bridgeId);
    connection.busy = false;

    for (const [requestId, pending] of this.pendingRequests.entries()) {
      if (pending.connection.connectionId !== connection.connectionId) continue;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    }

    while (connection.queue.length > 0) {
      const queued = connection.queue.shift();
      queued.reject(error);
    }
  }

  #dispatchNext(connection) {
    if (connection.busy) return;
    const nextTask = connection.queue.shift();
    if (!nextTask) return;

    connection.busy = true;
    this.logger.log(`[bridge] dispatching request ${nextTask.requestId} to ${connection.bridgeId}`);

    const timeout = setTimeout(() => {
      this.rejectRequest(nextTask.requestId, {
        code: ERROR_CODES.BRIDGE_REQUEST_TIMEOUT,
        message: `Bridge ${connection.bridgeId} timed out while processing the request.`,
        status: 504
      });
    }, this.requestTimeoutMs);

    this.pendingRequests.set(nextTask.requestId, {
      connection,
      resolve: nextTask.resolve,
      reject: nextTask.reject,
      timeout
    });

    try {
      connection.websocket.sendJson(createBridgeTaskMessage({
        requestId: nextTask.requestId,
        payload: nextTask.payload
      }));
    } catch (error) {
      clearTimeout(timeout);
      this.pendingRequests.delete(nextTask.requestId);
      connection.busy = false;
      nextTask.reject(createError(
        ERROR_CODES.BRIDGE_SEND_FAILED,
        `Failed to send request to bridge ${connection.bridgeId}.`,
        502,
        error instanceof Error ? error.message : String(error)
      ));
      this.#dispatchNext(connection);
    }
  }
}
