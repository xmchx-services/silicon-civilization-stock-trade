import { scoreSymbols, type Signal, type SymbolSnapshot } from "./deepseek";
import { fetchBestEffortFundamental } from "./fundamental-loader";
import { fetchKlines, fetchSpot } from "./pyserver";
import { getSignalsPageSnapshot, saveSignalsPageSnapshot } from "./cache";
import { loadEntries, type UniverseEntry } from "./universe";
import type { SignalsPageRow, SignalsPageSnapshot } from "./signals-types";

interface SignalsPageDeps {
  loadEntries: () => UniverseEntry[];
  fetchKlines: typeof fetchKlines;
  fetchBestEffortFundamental: typeof fetchBestEffortFundamental;
  fetchSpot: typeof fetchSpot;
  scoreSymbols: typeof scoreSymbols;
  saveSignalsPageSnapshot: (snapshot: SignalsPageSnapshot) => void;
  getSignalsPageSnapshot: () => SignalsPageSnapshot | null;
  now: () => Date;
}

export interface SignalsPageData {
  rows: SignalsPageRow[];
  fallbackSnapshotGeneratedAt: string | null;
}

function buildStart90(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function toRow(
  entry: UniverseEntry,
  live: {
    closes: number[];
    spotPrice?: number;
    fundamental?: {
      pe_ttm?: number | null;
      pb?: number | null;
      market_cap?: number | null;
      profit_yoy?: number | null;
    };
  },
  signal?: Signal | null,
): SignalsPageRow {
  return {
    entry,
    snapshot: {
      spotPrice: live.spotPrice,
      lastClose: live.closes.at(-1),
      fundamental: live.fundamental,
    },
    signal: signal ?? null,
  };
}

async function buildLiveRows(deps: SignalsPageDeps): Promise<SignalsPageRow[]> {
  const universe = deps.loadEntries();
  const start = buildStart90(deps.now());

  const snapshots: Array<
    SymbolSnapshot & {
      entry: UniverseEntry;
      spotPrice?: number;
    }
  > = await Promise.all(
    universe.map(async (entry) => {
      const [klines, fund, spot] = await Promise.all([
        deps.fetchKlines(entry.symbol, start).catch(() => []),
        deps.fetchBestEffortFundamental(entry.symbol).catch(() => undefined),
        deps.fetchSpot(entry.symbol).catch(() => undefined),
      ]);
      return {
        entry,
        symbol: entry.symbol,
        name: entry.name,
        theme: entry.theme,
        spotPrice: spot?.price,
        closes: klines.map((k) => k.close),
        fundamental: fund
          ? {
              pe_ttm: fund.pe_ttm,
              pb: fund.pb,
              market_cap: fund.market_cap,
              profit_yoy: fund.profit_yoy,
            }
          : undefined,
      };
    }),
  );

  const usable = snapshots.filter((s) => s.closes.length >= 10);
  const signals = await deps.scoreSymbols(usable);
  const byId = new Map(signals.map((s) => [s.symbol, s]));

  return snapshots.map((snapshot) =>
    toRow(snapshot.entry, snapshot, byId.get(snapshot.symbol)),
  );
}

export async function loadSignalsPageData(
  overrides: Partial<SignalsPageDeps> = {},
): Promise<SignalsPageData> {
  const deps: SignalsPageDeps = {
    loadEntries,
    fetchKlines,
    fetchBestEffortFundamental,
    fetchSpot,
    scoreSymbols,
    saveSignalsPageSnapshot,
    getSignalsPageSnapshot,
    now: () => new Date(),
    ...overrides,
  };

  try {
    const rows = await buildLiveRows(deps);
    const snapshot: SignalsPageSnapshot = {
      generatedAt: deps.now().toISOString(),
      rows,
    };
    try {
      deps.saveSignalsPageSnapshot(snapshot);
    } catch {
      // Snapshot persistence is best-effort; live results still render.
    }
    return { rows, fallbackSnapshotGeneratedAt: null };
  } catch (error) {
    try {
      const snapshot = deps.getSignalsPageSnapshot();
      if (snapshot) {
        return {
          rows: snapshot.rows,
          fallbackSnapshotGeneratedAt: snapshot.generatedAt,
        };
      }
    } catch {
      // Fall through to the original error when snapshot lookup also fails.
    }
    throw error;
  }
}
