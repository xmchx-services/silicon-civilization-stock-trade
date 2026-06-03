import { test } from "node:test";
import assert from "node:assert/strict";

test("fetchBestEffortFundamental always requests best-effort mode", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ symbol: "688256", pe_ttm: 88 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const { fetchBestEffortFundamental } = await import("../lib/fundamental-loader");
    const out = await fetchBestEffortFundamental("688256");
    assert.deepEqual(out, { symbol: "688256", pe_ttm: 88 });
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]);
    assert.equal(url.pathname, "/fundamental");
    assert.equal(url.searchParams.get("symbol"), "688256");
    assert.equal(url.searchParams.get("best_effort"), "1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
