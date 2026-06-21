import {
  MESSAGE_TYPES,
  createBridgeErrorMessage,
  createBridgeHeartbeatMessage,
  createBridgeRegisterMessage,
  createBridgeResultMessage,
  parseJsonMessage
} from "../../shared/protocol.mjs";
import { requestKoboldChatCompletion } from "./koboldClient.mjs";

async function readMessageData(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  if (data && typeof data.text === "function") return data.text();
  return String(data);
}

export class RemoteBridgeClient {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
    this.websocket = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.stopped = false;
    this.taskChain = Promise.resolve();
  }

  start() {
    this.#connect();
  }

  stop() {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.websocket) this.websocket.close();
  }

  #connect() {
    this.logger.log(`[bridge] connecting to ${this.config.remoteWsUrl}`);

    const websocket = new WebSocket(this.config.remoteWsUrl);
    this.websocket = websocket;

    websocket.addEventListener("open", () => {
      this.logger.log("[bridge] websocket connected");
      this.#sendJson(createBridgeRegisterMessage({
        bridgeId: this.config.bridgeId,
        bridgeSecret: this.config.bridgeSecret,
        model: this.config.koboldModel
      }));

      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        this.#sendJson(createBridgeHeartbeatMessage({
          bridgeId: this.config.bridgeId,
          model: this.config.koboldModel
        }));
      }, this.config.heartbeatIntervalMs);
    });

    websocket.addEventListener("message", async (event) => {
      let message;
      try {
        message = parseJsonMessage(await readMessageData(event.data));
      } catch (error) {
        this.logger.error("[bridge] invalid message from service", error);
        return;
      }

      if (message.type === MESSAGE_TYPES.ERROR) {
        this.logger.error("[bridge] remote service reported an error", message.error);
        return;
      }

      if (message.type !== MESSAGE_TYPES.TASK) {
        this.logger.warn(`[bridge] ignoring unsupported message type ${message.type}`);
        return;
      }

      this.logger.log(`[bridge] received task ${message.requestId}`);
      this.taskChain = this.taskChain
        .then(() => this.#handleTask(message))
        .catch((error) => {
          this.logger.error("[bridge] task handling failed", error);
        });
    });

    websocket.addEventListener("close", () => {
      this.logger.warn("[bridge] websocket closed");
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => {
          this.#connect();
        }, this.config.reconnectDelayMs);
      }
    });

    websocket.addEventListener("error", (error) => {
      this.logger.error("[bridge] websocket error", error);
    });
  }

  async #handleTask(message) {
    try {
      const response = await requestKoboldChatCompletion(this.config, message.payload);
      this.logger.log(`[bridge] completed task ${message.requestId}`);
      this.#sendJson(createBridgeResultMessage({
        requestId: message.requestId,
        response
      }));
    } catch (error) {
      this.logger.error(`[bridge] task ${message.requestId} failed`, error);
      this.#sendJson(createBridgeErrorMessage({
        requestId: message.requestId,
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unknown bridge error.",
        status: error.status || 500,
        details: error.details
      }));
    }
  }

  #sendJson(payload) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify(payload));
  }
}
