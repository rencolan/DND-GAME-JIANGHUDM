export type DiagnosticEntry = {
  id: string;
  kind: "error" | "rejection" | "storage" | "render";
  message: string;
  detail?: string;
  at: number;
};

const DIAGNOSTICS_KEY = "jianghu-dm-diagnostics-v1";
const DIAGNOSTICS_LIMIT = 24;

function uid() {
  return `diag-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function safeRead(): DiagnosticEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIAGNOSTICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiagnosticEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: DiagnosticEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(entries.slice(-DIAGNOSTICS_LIMIT)));
  } catch {
    return;
  }
}

export function recordDiagnostic(kind: DiagnosticEntry["kind"], message: string, detail?: string) {
  const next = [
    ...safeRead(),
    {
      id: uid(),
      kind,
      message,
      detail,
      at: Date.now()
    }
  ];
  safeWrite(next);
}

export function readDiagnostics() {
  return safeRead();
}

export function clearDiagnostics() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DIAGNOSTICS_KEY);
  } catch {
    return;
  }
}

export function safeLocalStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    recordDiagnostic("storage", `写入 ${key} 失败`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function safeLocalStorageRemove(key: string) {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    recordDiagnostic("storage", `移除 ${key} 失败`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
