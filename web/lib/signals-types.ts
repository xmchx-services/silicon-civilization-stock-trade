import type { Signal } from "./deepseek";
import type { UniverseEntry } from "./universe";

export interface SignalsPageRow {
  entry: UniverseEntry;
  snapshot?: {
    spotPrice?: number;
    lastClose?: number;
    fundamental?: {
      pe_ttm?: number | null;
      pb?: number | null;
      market_cap?: number | null;
      profit_yoy?: number | null;
    };
  };
  signal?: Signal | null;
}

export interface SignalsPageSnapshot {
  generatedAt: string;
  rows: SignalsPageRow[];
}
