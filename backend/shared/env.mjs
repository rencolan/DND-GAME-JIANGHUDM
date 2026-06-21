import fs from "node:fs";

function stripWrappingQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function loadEnvFile(envFileUrl) {
  const path = envFileUrl instanceof URL ? envFileUrl : new URL(envFileUrl, import.meta.url);

  if (!fs.existsSync(path)) {
    return;
  }

  const source = fs.readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

