export const BRIDGE_PROTOCOL_VERSION = 1;

export const MESSAGE_TYPES = {
  REGISTER: "bridge.register",
  HEARTBEAT: "bridge.heartbeat",
  TASK: "bridge.task",
  RESULT: "bridge.result",
  ERROR: "bridge.error"
};

export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNSUPPORTED_STREAM: "UNSUPPORTED_STREAM",
  BRIDGE_OFFLINE: "BRIDGE_OFFLINE",
  BRIDGE_DISCONNECTED: "BRIDGE_DISCONNECTED",
  BRIDGE_REQUEST_TIMEOUT: "BRIDGE_REQUEST_TIMEOUT",
  BRIDGE_SEND_FAILED: "BRIDGE_SEND_FAILED",
  LOCAL_MODEL_UNREACHABLE: "LOCAL_MODEL_UNREACHABLE",
  LOCAL_MODEL_BAD_RESPONSE: "LOCAL_MODEL_BAD_RESPONSE",
  LOCAL_MODEL_HTTP_ERROR: "LOCAL_MODEL_HTTP_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR"
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseJsonMessage(raw) {
  const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
  const parsed = JSON.parse(text);

  if (!isPlainObject(parsed) || !asTrimmedString(parsed.type)) {
    throw new Error("Protocol message must be an object with a type.");
  }

  return parsed;
}

export function createBridgeRegisterMessage({ bridgeId, bridgeSecret, model }) {
  return {
    type: MESSAGE_TYPES.REGISTER,
    version: BRIDGE_PROTOCOL_VERSION,
    bridgeId,
    bridgeSecret,
    model
  };
}

export function createBridgeHeartbeatMessage({ bridgeId, model }) {
  return {
    type: MESSAGE_TYPES.HEARTBEAT,
    version: BRIDGE_PROTOCOL_VERSION,
    bridgeId,
    model,
    sentAt: Date.now()
  };
}

export function createBridgeTaskMessage({ requestId, payload }) {
  return {
    type: MESSAGE_TYPES.TASK,
    version: BRIDGE_PROTOCOL_VERSION,
    requestId,
    payload
  };
}

export function createBridgeResultMessage({ requestId, response }) {
  return {
    type: MESSAGE_TYPES.RESULT,
    version: BRIDGE_PROTOCOL_VERSION,
    requestId,
    response
  };
}

export function createBridgeErrorMessage({ requestId, code, message, status, details }) {
  return {
    type: MESSAGE_TYPES.ERROR,
    version: BRIDGE_PROTOCOL_VERSION,
    requestId,
    error: {
      code,
      message,
      status,
      details
    }
  };
}

export function extractBearerToken(headerValue) {
  if (typeof headerValue !== "string") return "";
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function sanitizeChatCompletionRequest(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: "Request body must be a JSON object.",
        status: 400
      }
    };
  }

  if (body.stream === true) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.UNSUPPORTED_STREAM,
        message: "stream: true is not supported by this backend yet.",
        status: 400
      }
    };
  }

  const model = asTrimmedString(body.model);
  if (!model) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: "model is required.",
        status: 400
      }
    };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: "messages must be a non-empty array.",
        status: 400
      }
    };
  }

  const messages = [];
  for (const entry of body.messages) {
    if (!isPlainObject(entry)) {
      return {
        ok: false,
        error: {
          code: ERROR_CODES.BAD_REQUEST,
          message: "Each message must be an object.",
          status: 400
        }
      };
    }

    const role = asTrimmedString(entry.role);
    const content = typeof entry.content === "string" ? entry.content : "";

    if (!role || !content) {
      return {
        ok: false,
        error: {
          code: ERROR_CODES.BAD_REQUEST,
          message: "Each message requires string role and content fields.",
          status: 400
        }
      };
    }

    messages.push({ role, content });
  }

  const payload = {
    model,
    messages,
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    max_tokens: Number.isInteger(body.max_tokens) ? body.max_tokens : undefined,
    stream: false
  };

  return { ok: true, payload };
}

export function normalizeOpenAiResponse(raw, fallbackModel) {
  if (!isPlainObject(raw) || !Array.isArray(raw.choices)) {
    throw new Error("Local model did not return a valid OpenAI-compatible response.");
  }

  return {
    id: typeof raw.id === "string" ? raw.id : `chatcmpl-${Date.now()}`,
    object: typeof raw.object === "string" ? raw.object : "chat.completion",
    created: Number.isInteger(raw.created) ? raw.created : Math.floor(Date.now() / 1000),
    model: asTrimmedString(raw.model) || fallbackModel,
    choices: raw.choices,
    usage: isPlainObject(raw.usage) ? raw.usage : undefined
  };
}

export function makeHttpError({ code, message, status, details }) {
  return {
    error: {
      code,
      message,
      type: "backend_error",
      details
    },
    status
  };
}

