import { loadBridgeConfig } from "./config.mjs";
import { RemoteBridgeClient } from "./remoteBridgeClient.mjs";

const config = loadBridgeConfig();
const client = new RemoteBridgeClient(config, console);

console.log("[bridge] starting local bridge");
console.log(`[bridge] remote HTTP base: ${config.remoteHttpBase}`);
console.log(`[bridge] bridge id: ${config.bridgeId}`);
console.log(`[bridge] kobold endpoint: ${config.koboldBaseUrl}`);
console.log(`[bridge] kobold model: ${config.koboldModel}`);

client.start();

process.on("SIGINT", () => {
  console.log("[bridge] shutting down");
  client.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[bridge] shutting down");
  client.stop();
  process.exit(0);
});
