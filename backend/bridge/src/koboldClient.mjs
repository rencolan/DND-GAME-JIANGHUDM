import {
  ERROR_CODES,
  normalizeOpenAiResponse
} from "../../shared/protocol.mjs";

function createBridgeError(code, message, status, details) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

export async function requestKoboldChatCompletion(config, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.localRequestTimeoutMs);

  try {
    const response = await fetch(config.koboldBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: payload.model || config.koboldModel,
        messages: payload.messages,
        temperature: payload.temperature,
        max_tokens: payload.max_tokens,
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let details = `HTTP ${response.status}`;
      try {
        details = await response.text();
      } catch {}

      throw createBridgeError(
        ERROR_CODES.LOCAL_MODEL_HTTP_ERROR,
        "koboldcpp returned an HTTP error.",
        502,
        details
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw createBridgeError(
        ERROR_CODES.LOCAL_MODEL_BAD_RESPONSE,
        "koboldcpp returned invalid JSON.",
        502,
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      return normalizeOpenAiResponse(data, payload.model || config.koboldModel);
    } catch (error) {
      throw createBridgeError(
        ERROR_CODES.LOCAL_MODEL_BAD_RESPONSE,
        error instanceof Error ? error.message : "koboldcpp returned a malformed response.",
        502
      );
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createBridgeError(
        ERROR_CODES.BRIDGE_REQUEST_TIMEOUT,
        "Local koboldcpp request timed out.",
        504
      );
    }

    if (error.code) {
      throw error;
    }

    throw createBridgeError(
      ERROR_CODES.LOCAL_MODEL_UNREACHABLE,
      "Local koboldcpp endpoint is unreachable.",
      502,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    clearTimeout(timeout);
  }
}

