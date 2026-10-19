import "server-only";
import {
  marketIsStale,
  parseMarketSnapshot,
  type MarketResponse,
  type MarketSnapshot,
} from "./savings";

let memory: MarketSnapshot | null = null;
let requestedAt = 0;
let pending: Promise<MarketResponse> | null = null;
async function fetchPrices(): Promise<MarketResponse> {
  let snapshot = memory;
  let unavailable = false;
  try {
    const response = await fetch("https://finans.truncgil.com/v4/today.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Fiyat servisi yanıt vermedi.");
    const fresh = parseMarketSnapshot(await response.json());
    // A provider response must not replace a more recent quotation with an older one.
    if (!snapshot || fresh.quoted_at >= snapshot.quoted_at) {
      snapshot = fresh;
    }
  } catch {
    unavailable = true;
  }
  memory = snapshot;
  requestedAt = Date.now();
  return {
    snapshot,
    stale: unavailable || marketIsStale(snapshot),
    unavailable,
  };
}
let lastUnavailable = false;
export async function getMarketPrices(): Promise<MarketResponse> {
  if (requestedAt && Date.now() - requestedAt < 60000)
    return {
      snapshot: memory,
      stale: lastUnavailable || marketIsStale(memory),
      unavailable: lastUnavailable,
    };
  if (!pending)
    pending = fetchPrices()
      .then((result) => {
        lastUnavailable = result.unavailable;
        return result;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
