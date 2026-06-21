import test from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_CODES,
  extractBearerToken,
  normalizeOpenAiResponse,
  sanitizeChatCompletionRequest
} from "./protocol.mjs";

test("extractBearerToken returns token from bearer header", () => {
  assert.equal(extractBearerToken("Bearer abc123"), "abc123");
  assert.equal(extractBearerToken("bearer xyz"), "xyz");
  assert.equal(extractBearerToken("Token abc123"), "");
});

test("sanitizeChatCompletionRequest accepts basic non-stream payload", () => {
  const result = sanitizeChatCompletionRequest({
    model: "koboldcpp-local",
    messages: [
      { role: "system", content: "A" },
      { role: "user", content: "B" }
    ],
    temperature: 0.8,
    max_tokens: 256
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.stream, false);
  assert.equal(result.payload.model, "koboldcpp-local");
  assert.equal(result.payload.messages.length, 2);
});

test("sanitizeChatCompletionRequest rejects stream mode", () => {
  const result = sanitizeChatCompletionRequest({
    model: "koboldcpp-local",
    stream: true,
    messages: [{ role: "user", content: "hi" }]
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.UNSUPPORTED_STREAM);
});

test("normalizeOpenAiResponse fills missing top-level fields", () => {
  const normalized = normalizeOpenAiResponse(
    {
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }]
    },
    "fallback-model"
  );

  assert.equal(normalized.model, "fallback-model");
  assert.equal(normalized.object, "chat.completion");
  assert.equal(normalized.choices[0].message.content, "ok");
});

