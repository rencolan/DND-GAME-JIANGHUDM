import { extractBearerToken, makeHttpError } from "../../shared/protocol.mjs";

export function applyCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Bridge-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  applyCorsHeaders(response);
  response.end(JSON.stringify(payload));
}

export function sendError(response, { code, message, status, details }) {
  const error = makeHttpError({ code, message, status, details });
  sendJson(response, status, error);
}

export async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function authorizeHttpRequest(request, expectedToken) {
  const token = extractBearerToken(request.headers.authorization);

  if (!token || token !== expectedToken) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing bearer token.",
        status: 401
      }
    };
  }

  return { ok: true };
}

