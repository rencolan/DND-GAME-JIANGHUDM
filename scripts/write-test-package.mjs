import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync(".tmp-test", { recursive: true });
writeFileSync(".tmp-test/package.json", JSON.stringify({ type: "commonjs" }, null, 2));
