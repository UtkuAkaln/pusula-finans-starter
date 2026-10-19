import { test } from "node:test";
import assert from "node:assert/strict";
import {
  holdingValue,
  marketIsStale,
  parseMarketSnapshot,
  savingsGoal,
  savingsSummary,
} from "../lib/savings";
import { validateRecord } from "../lib/validation";
import type { Holding } from "../lib/types";
const now = new Date("2026-10-19T06:00:00Z");
const raw = () => ({
  Update_Date: "2026-10-19 09:00:00",
  USD: { Buying: 40.1234, Selling: 41, Change: 0.2 },
  EUR: { Buying: 45, Selling: 46 },
  GBP: { Buying: 55, Selling: 56 },
  GRA: { Buying: 6000, Selling: 6100 },
  GUMUS: { Buying: 80, Selling: 81 },
  CEYREKALTIN: { Buying: 10000, Selling: 10100 },
});
const holding = (patch: Partial<Holding> = {}): Holding => ({
  id: "h",
  name: "Döviz",
  asset: "USD",
  quantity: 100,
  cost_basis: null,
  goal_id: null,
  note: "",
  ...patch,
});
test("Fiyatlar doğru kaynak anahtarlarından okunur, Türkiye zamanı UTC'ye çevrilir", () => {
  const snapshot = parseMarketSnapshot(raw(), now);
  assert.equal(snapshot.quoted_at, "2026-10-19T06:00:00.000Z");
  assert.equal(snapshot.quotes.XAU?.buy, 6000);
  assert.equal(snapshot.quotes.XAG?.buy, 80);
  assert.equal(snapshot.quotes.GOLD_QUARTER?.buy, 10000);
  assert.equal(snapshot.quotes.TRY?.buy, 1);
});
test("Birikim değeri satış değil alış fiyatını ve gram/adet miktarını kullanır", () => {
  const snapshot = parseMarketSnapshot(raw(), now);
  assert.equal(holdingValue(holding(), snapshot), 4012.34);
  assert.equal(
    holdingValue(holding({ asset: "XAU", quantity: 2.5 }), snapshot),
    15000,
  );
  assert.equal(
    holdingValue(holding({ asset: "GOLD_QUARTER", quantity: 2 }), snapshot),
    20000,
  );
  assert.equal(
    holdingValue(holding({ asset: "XAG", quantity: 0.123456 }), snapshot),
    9.88,
  );
});
test("Fiyat gelmediğinde döviz sıfır sayılmaz, TL çevrim gerektirmez", () => {
  assert.equal(holdingValue(holding(), null), null);
  assert.equal(
    holdingValue(holding({ asset: "TRY", quantity: 1234.56 }), null),
    1234.56,
  );
  const summary = savingsSummary(
    [holding(), holding({ asset: "TRY", quantity: 100 })],
    null,
  );
  assert.equal(summary.total, 100);
  assert.equal(summary.missing, 1);
});
test("Bozuk, sıfır, negatif, gelecekte veya takvim dışı kotasyon reddedilir", () => {
  for (const value of [0, -1, Infinity, NaN])
    assert.throws(() =>
      parseMarketSnapshot({ ...raw(), USD: { Buying: value } }, now),
    );
  assert.throws(() =>
    parseMarketSnapshot({ ...raw(), Update_Date: "2026-10-19 12:00:00" }, now),
  );
  assert.throws(() =>
    parseMarketSnapshot({ ...raw(), Update_Date: "2026-02-31 12:00:00" }, now),
  );
  assert.throws(() =>
    parseMarketSnapshot({ ...raw(), Update_Date: null }, now),
  );
});
test("Eski kotasyonun zamanı korunur; 15 dakika sonrası bayat sayılır", () => {
  const snapshot = parseMarketSnapshot(raw(), now);
  assert.equal(marketIsStale(snapshot, now.getTime()), false);
  assert.equal(marketIsStale(snapshot, now.getTime() + 16 * 60000), true);
  assert.equal(marketIsStale(null, now.getTime()), true);
});
test("Hedef ilerlemesi yalnız o hedefe bağlı birikimleri sayar", () => {
  const goal = {
    id: "g",
    name: "Bilgisayar",
    amount: 10000,
    target_date: null,
    icon: "target",
  };
  const rows = [
    holding({ goal_id: "g" }),
    holding({ id: "other", goal_id: "other", asset: "TRY", quantity: 2000 }),
  ];
  const result = savingsGoal(goal, rows, parseMarketSnapshot(raw(), now));
  assert.equal(result.allocated, 4012.34);
  assert.equal(result.remaining, 5987.66);
  assert.equal(result.count, 1);
  assert.equal(result.missing, 0);
  assert.equal(savingsGoal(goal, rows, null).missing, 1);
});
test("Hedef aşılınca kalan sıfır, ilerleme en fazla yüzde yüz olur", () => {
  const result = savingsGoal(
    { id: "g", name: "Hedef", amount: 100, target_date: null, icon: "target" },
    [holding({ goal_id: "g", asset: "TRY", quantity: 200 })],
    null,
  );
  assert.equal(result.remaining, 0);
  assert.equal(result.percent, 100);
  assert.equal(result.allocated, 200);
});
test("Birikim doğrulaması küçük miktarı korur ve desteklenmeyen türü reddeder", () => {
  assert.equal(
    validateRecord("holdings", holding({ quantity: 0.123456 })).quantity,
    0.123456,
  );
  assert.equal(validateRecord("holdings", holding()).cost_basis, null);
  assert.equal(
    validateRecord("holdings", holding({ cost_basis: 0 })).cost_basis,
    0,
  );
  for (const q of [0, -1, Infinity, 1e9, 0.00000001])
    assert.throws(() => validateRecord("holdings", holding({ quantity: q })));
  assert.throws(() =>
    validateRecord("holdings", { ...holding(), asset: "UNKNOWN" }),
  );
});
