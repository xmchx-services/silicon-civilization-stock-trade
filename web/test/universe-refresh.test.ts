import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scc-universe-refresh-"));
fs.mkdirSync(path.join(tmp, "data"));
fs.writeFileSync(
  path.join(tmp, "data", "universe.json"),
  JSON.stringify({
    updated_at: "2026-01-01",
    updated_by: "test",
    entries: [{ symbol: "688256", name: "寒武纪", theme: "算力", global_supply: false }],
  }, null, 2),
);

const origCwd = process.cwd();
process.chdir(tmp);

let applyRefresh: typeof import("../lib/universe-refresh").applyRefresh;
let readUniverse: typeof import("../lib/universe").readUniverse;

before(async () => {
  const refreshMod = await import("../lib/universe-refresh");
  const universeMod = await import("../lib/universe");
  applyRefresh = refreshMod.applyRefresh;
  readUniverse = universeMod.readUniverse;
});

after(() => {
  process.chdir(origCwd);
});

test("applyRefresh validates added symbols via /spot instead of /fundamental", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      symbol: "300476",
      name: "胜宏科技",
      price: 123,
      change_pct: 1.2,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const current = readUniverse();
    const result = await applyRefresh(current, {
      adds: [{ symbol: "300476", name: "胜宏科技", theme: "AI-PCB", global_supply: true }],
      removes: [],
      reclassifies: [],
      rationale: "",
    });

    assert.equal(result.applied.added.length, 1);
    assert.equal(result.applied.rejected.length, 0);
    assert.equal(calls.length, 1);

    const url = new URL(calls[0]);
    assert.equal(url.pathname, "/spot");
    assert.equal(url.searchParams.get("symbol"), "300476");

    const updated = readUniverse();
    assert.equal(updated.entries.some((entry) => entry.symbol === "300476"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("applyRefresh reports Hong Kong symbols as rejected progress items", async () => {
  const current = readUniverse();
  const validated: Array<{ symbol: string; ok: boolean }> = [];

  const result = await applyRefresh(current, {
    adds: [{ symbol: "hk00700", name: "腾讯控股", theme: "云", global_supply: true }],
    removes: [],
    reclassifies: [],
    rationale: "",
  }, {
    onValidate: (symbol, ok) => {
      validated.push({ symbol, ok });
    },
  });

  assert.deepEqual(validated, [{ symbol: "hk00700", ok: false }]);
  assert.deepEqual(result.applied.rejected, [{
    symbol: "hk00700",
    reason: "Hong Kong stocks are excluded from the universe",
  }]);
});
