import { fetchFundamental } from "./pyserver";

export function fetchBestEffortFundamental(symbol: string) {
  return fetchFundamental(symbol, { bestEffort: true });
}
