import test from "node:test";
import assert from "node:assert/strict";
import { BridgeRegistry } from "./bridgeRegistry.mjs";

test("BridgeRegistry serializes requests per bridge", async () => {
  const sent = [];
  const registry = new BridgeRegistry({ requestTimeoutMs: 1000, logger: console });

  registry.registerConnection({
    bridgeId: "main",
    model: "koboldcpp-local",
    remoteAddress: "127.0.0.1",
    websocket: {
      sendJson(message) {
        sent.push(message);
      },
      close() {}
    }
  });

  const firstPromise = registry.enqueueChatCompletion({
    bridgeId: "main",
    payload: { model: "m1", messages: [{ role: "user", content: "first" }], stream: false }
  });
  const secondPromise = registry.enqueueChatCompletion({
    bridgeId: "main",
    payload: { model: "m1", messages: [{ role: "user", content: "second" }], stream: false }
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.messages[0].content, "first");

  registry.resolveRequest(sent[0].requestId, { id: "1", choices: [] });
  await firstPromise;

  assert.equal(sent.length, 2);
  assert.equal(sent[1].payload.messages[0].content, "second");

  registry.resolveRequest(sent[1].requestId, { id: "2", choices: [] });
  await secondPromise;
});

test("BridgeRegistry rejects requests when bridge is offline", async () => {
  const registry = new BridgeRegistry({ requestTimeoutMs: 1000, logger: console });

  await assert.rejects(
    registry.enqueueChatCompletion({
      bridgeId: "missing",
      payload: { model: "m1", messages: [{ role: "user", content: "hello" }], stream: false }
    }),
    /offline/i
  );
});

