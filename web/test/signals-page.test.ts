import { test } from "node:test";
import assert from "node:assert/strict";

test("loadSignalsPageData saves a snapshot after a successful live load", async () => {
  const { loadSignalsPageData } = await import("../lib/signals-page");
  const writes: import("../lib/signals-types").SignalsPageSnapshot[] = [];

  const data = await loadSignalsPageData({
    loadEntries: () => [{ symbol: "688256", name: "寒武纪", theme: "算力/AI芯片" }],
    fetchKlines: async () => Array.from({ length: 12 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      open: 100 + i,
      high: 100 + i,
      low: 100 + i,
      close: 100 + i,
      volume: 1_000,
    })),
    fetchBestEffortFundamental: async () => ({
      symbol: "688256",
      pe_ttm: 88,
      pb: 12,
      market_cap: 999,
      profit_yoy: 44,
    }),
    fetchSpot: async () => ({ symbol: "688256", name: "寒武纪", price: 123, change_pct: 1 }),
    scoreSymbols: async () => [{
      symbol: "688256",
      action: "buy",
      confidence: 0.9,
      size: 0.5,
      rationale: "test",
    }],
    saveSignalsPageSnapshot: (snapshot) => {
      writes.push(snapshot);
    },
    getSignalsPageSnapshot: () => null,
    now: () => new Date("2026-06-03T12:34:56.000Z"),
  });

  assert.equal(data.fallbackSnapshotGeneratedAt, null);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].signal?.action, "buy");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].generatedAt, "2026-06-03T12:34:56.000Z");
  assert.equal(writes[0].rows[0].snapshot?.lastClose, 111);
});

test("loadSignalsPageData falls back to the latest snapshot when live scoring fails", async () => {
  const { loadSignalsPageData } = await import("../lib/signals-page");
  const snapshot: import("../lib/signals-types").SignalsPageSnapshot = {
    generatedAt: "2026-06-03T09:00:00.000Z",
    rows: [
      {
        entry: { symbol: "300308", name: "中际旭创", theme: "光模块" },
        snapshot: { spotPrice: 88.8, lastClose: 87.6 },
        signal: {
          symbol: "300308",
          action: "hold",
          confidence: 0.6,
          size: 0.2,
          rationale: "cached",
        },
      },
    ],
  };

  const data = await loadSignalsPageData({
    loadEntries: () => [{ symbol: "300308", name: "中际旭创", theme: "光模块" }],
    fetchKlines: async () => Array.from({ length: 12 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
    })),
    fetchBestEffortFundamental: async () => ({ symbol: "300308", pe_ttm: 10 }),
    fetchSpot: async () => ({ symbol: "300308", name: "中际旭创", price: 88, change_pct: 1 }),
    scoreSymbols: async () => {
      throw new Error("deepseek down");
    },
    saveSignalsPageSnapshot: () => {
      throw new Error("should not write on fallback");
    },
    getSignalsPageSnapshot: () => snapshot,
    now: () => new Date("2026-06-03T12:34:56.000Z"),
  });

  assert.equal(data.fallbackSnapshotGeneratedAt, snapshot.generatedAt);
  assert.deepEqual(data.rows, snapshot.rows);
});

test("loadSignalsPageData rethrows when live scoring fails and no snapshot exists", async () => {
  const { loadSignalsPageData } = await import("../lib/signals-page");

  await assert.rejects(
    () => loadSignalsPageData({
      loadEntries: () => [{ symbol: "300308", name: "中际旭创", theme: "光模块" }],
      fetchKlines: async () => [],
      fetchBestEffortFundamental: async () => {
        throw new Error("fund unavailable");
      },
      fetchSpot: async () => {
        throw new Error("spot unavailable");
      },
      scoreSymbols: async () => {
        throw new Error("deepseek down");
      },
      saveSignalsPageSnapshot: () => undefined,
      getSignalsPageSnapshot: () => null,
      now: () => new Date("2026-06-03T12:34:56.000Z"),
    }),
    /deepseek down/,
  );
});
