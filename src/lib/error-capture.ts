let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function shouldIgnoreError(error: unknown): boolean {
  if (!error) return false;
  const message = String(
    typeof error === "object" && error !== null && "message" in error
      ? (error as any).message
      : error,
  );
  const lower = message.toLowerCase();
  return (
    lower.includes("peerjs") ||
    lower.includes("lost connection to server") ||
    lower.includes("permission denied") ||
    lower.includes("notallowederror") ||
    lower.includes("the request is not allowed by the user agent") ||
    lower.includes("the document is sandboxed") ||
    lower.includes("allow-modals")
  );
}

function record(error: unknown) {
  if (shouldIgnoreError(error)) {
    console.warn("[ErrorCapture] Ignored PeerJS error:", error);
    return;
  }
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const error = (event as ErrorEvent).error ?? event;
    if (shouldIgnoreError(error)) {
      event.preventDefault();
      console.warn("[ErrorCapture] Prevented default for PeerJS error:", error);
      return;
    }
    record(error);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    if (shouldIgnoreError(reason)) {
      event.preventDefault();
      console.warn("[ErrorCapture] Prevented default for PeerJS unhandled rejection:", reason);
      return;
    }
    record(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
