import { test } from "node:test";
import assert from "node:assert/strict";

test("fetchFundamental rewrites abort errors into a timeout message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const error = new Error("This operation was aborted");
    error.name = "AbortError";
    throw error;
  }) as typeof fetch;

  try {
    const { fetchFundamental } = await import("../lib/pyserver");
    await assert.rejects(
      () => fetchFundamental("300476"),
      /pyserver \/fundamental timed out after 180s/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
