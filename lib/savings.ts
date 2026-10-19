import type { Goal, Holding, SavingsAsset } from "./types";

export const SAVINGS_ASSETS: Record<
  SavingsAsset,
  { name: string; unit: string; sourceKey: string; symbol: string }
> = {
  TRY: { name: "Türk lirası", unit: "TL", sourceKey: "", symbol: "₺" },
  USD: { name: "Amerikan doları", unit: "USD", sourceKey: "USD", symbol: "$" },
  EUR: { name: "Euro", unit: "EUR", sourceKey: "EUR", symbol: "€" },
  GBP: { name: "İngiliz sterlini", unit: "GBP", sourceKey: "GBP", symbol: "£" },
  XAU: {
    name: "Gram altın (24 ayar)",
    unit: "gram",
    sourceKey: "GRA",
    symbol: "Au",
  },
  XAG: { name: "Gümüş", unit: "gram", sourceKey: "GUMUS", symbol: "Ag" },
  GOLD_QUARTER: {
    name: "Çeyrek altın",
    unit: "adet",
    sourceKey: "CEYREKALTIN",
    symbol: "¼",
  },
  GOLD_HALF: {
    name: "Yarım altın",
    unit: "adet",
    sourceKey: "YARIMALTIN",
    symbol: "½",
  },
  GOLD_FULL: {
    name: "Tam altın",
    unit: "adet",
    sourceKey: "TAMALTIN",
    symbol: "1",
  },
  GOLD_REPUBLIC: {
    name: "Cumhuriyet altını",
    unit: "adet",
    sourceKey: "CUMHURIYETALTINI",
    symbol: "C",
  },
};
export type MarketQuote = {
  buy: number;
  sell: number | null;
  change: number | null;
};
export type MarketSnapshot = {
  source: "Trunçgil Finans";
  source_url: string;
  quoted_at: string;
  fetched_at: string;
  quotes: Partial<Record<SavingsAsset, MarketQuote>>;
};
export type MarketResponse = {
  snapshot: MarketSnapshot | null;
  stale: boolean;
  unavailable: boolean;
};

const positive = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 1e8
    ? value
    : null;
export function parseMarketSnapshot(
  raw: unknown,
  now = new Date(),
): MarketSnapshot {
  if (!raw || typeof raw !== "object")
    throw new Error("Fiyat yanıtı geçersiz.");
  const data = raw as Record<string, unknown>;
  const timestamp = String(data.Update_Date || "");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp))
    throw new Error("Fiyat zamanı eksik.");
  const quoted = new Date(timestamp.replace(" ", "T") + "+03:00");
  if (
    !Number.isFinite(quoted.getTime()) ||
    new Date(quoted.getTime() + 3 * 3600000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ") !== timestamp ||
    quoted.getTime() > now.getTime() + 5 * 60000
  )
    throw new Error("Fiyat zamanı geçersiz.");
  const quotes: MarketSnapshot["quotes"] = {
    TRY: { buy: 1, sell: 1, change: null },
  };
  for (const [asset, meta] of Object.entries(SAVINGS_ASSETS)) {
    if (asset === "TRY") continue;
    const row = data[meta.sourceKey] as Record<string, unknown> | undefined;
    const buy = row && positive(row.Buying);
    if (!buy) continue;
    quotes[asset as SavingsAsset] = {
      buy,
      sell: positive(row.Selling),
      change:
        typeof row.Change === "number" && Number.isFinite(row.Change)
          ? row.Change
          : null,
    };
  }
  if (
    ["USD", "EUR", "GBP", "XAU", "XAG"].some(
      (asset) => !quotes[asset as SavingsAsset],
    )
  )
    throw new Error("Temel fiyatlar eksik.");
  return {
    source: "Trunçgil Finans",
    source_url: "https://finans.truncgil.com/",
    quoted_at: quoted.toISOString(),
    fetched_at: now.toISOString(),
    quotes,
  };
}
export function marketIsStale(
  snapshot: MarketSnapshot | null,
  now = Date.now(),
) {
  return !snapshot || now - Date.parse(snapshot.quoted_at) > 15 * 60000;
}
export function holdingValue(
  holding: Holding,
  snapshot: MarketSnapshot | null,
) {
  const price =
    holding.asset === "TRY" ? 1 : snapshot?.quotes[holding.asset]?.buy;
  return price
    ? Math.round(Number(holding.quantity) * price * 100) / 100
    : null;
}
export function savingsSummary(
  holdings: Holding[],
  snapshot: MarketSnapshot | null,
) {
  const rows = holdings.map((holding) => ({
    ...holding,
    value: holdingValue(holding, snapshot),
  }));
  return {
    rows,
    total:
      Math.round(rows.reduce((sum, row) => sum + (row.value ?? 0), 0) * 100) /
      100,
    missing: rows.filter((row) => row.value === null).length,
  };
}
export function savingsGoal(
  goal: Goal,
  holdings: Holding[],
  snapshot: MarketSnapshot | null,
) {
  const linked = holdings.filter((holding) => holding.goal_id === goal.id);
  const summary = savingsSummary(linked, snapshot);
  const remaining = Math.max(
    0,
    Math.round((Number(goal.amount) - summary.total) * 100) / 100,
  );
  return {
    ...goal,
    allocated: summary.total,
    remaining,
    missing: summary.missing,
    count: linked.length,
    percent: Math.min(100, (summary.total / Number(goal.amount)) * 100),
  };
}
