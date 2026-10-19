import test from "node:test";
import assert from "node:assert/strict";
import {
  blankData,
  applyLocalAction,
  readLocalData,
  writeLocalData,
} from "../lib/local-data";
import { todayTR, expectedPayments } from "../lib/finance";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  configurable: true,
});
const save = (
  data: ReturnType<typeof blankData>,
  table: string,
  record: object,
  id?: string,
) => applyLocalAction(data, { action: "save", table, record, id });
function accountData() {
  return save(blankData(), "accounts", {
    name: "Nakit",
    bank: "Nakit",
    account_type: "cash",
    opening_balance: 0,
    balance_date: todayTR(),
  });
}
test("İlk açılış boştur, kişisel kayıt ve giriş ayarı yoktur", () => {
  storage.clear();
  const data = readLocalData();
  assert.equal(data.accounts.length, 0);
  assert.equal(data.transactions.length, 0);
  assert.equal(data.goals.length, 0);
  assert.equal(data.holdings?.length, 0);
  assert.equal(data.buckets.length, 6);
  assert.equal(data.telegram, undefined);
  assert.equal(data.gmail, undefined);
  assert.equal(readLocalData().buckets[0].id, data.buckets[0].id);
});
test("Kaydetme ve yeniden okuma, işyeri kuralı ile 6 basamaklı birikimi korur", () => {
  let data = accountData();
  data = save(data, "transactions", {
    merchant: "Test alışveriş",
    amount: 25,
    direction: "expense",
    occurred_on: todayTR(),
    account_id: data.accounts[0].id,
  });
  data = applyLocalAction(data, {
    action: "assign",
    id: data.transactions[0].id,
    bucket_id: data.buckets[0].id,
    remember: true,
  });
  data = save(data, "holdings", {
    name: "Metal",
    asset: "XAG",
    quantity: 0.123456,
  });
  writeLocalData(data);
  const restored = readLocalData();
  assert.equal(restored.merchant_rules.length, 1);
  assert.equal(restored.holdings?.[0].quantity, 0.123456);
  assert.equal(restored.transactions[0].bucket_id, data.buckets[0].id);
});
test("Geçersiz kayıt eski veriyi değiştirmez", () => {
  const data = accountData(),
    before = structuredClone(data);
  assert.throws(() =>
    save(data, "transactions", {
      merchant: "Test",
      amount: -5,
      direction: "expense",
      occurred_on: todayTR(),
      account_id: data.accounts[0].id,
    }),
  );
  assert.deepEqual(data, before);
});
test("Hedef silinince birikim korunur, yalnız bağlantısı kaldırılır", () => {
  let data = save(blankData(), "goals", { name: "Hedef", amount: 1000 });
  data = save(data, "holdings", {
    name: "Birikim",
    asset: "TRY",
    quantity: 100,
    goal_id: data.goals[0].id,
  });
  data = applyLocalAction(data, {
    action: "delete",
    table: "goals",
    id: data.goals[0].id,
  });
  assert.equal(data.holdings?.[0].quantity, 100);
  assert.equal(data.holdings?.[0].goal_id, null);
});
test("Tahsilat aynı dönem için iki kez eklenmez; kaynak silinse geçmiş kalır", () => {
  let data = accountData();
  data = save(data, "income_sources", {
    name: "Gelir",
    type: "other",
    period: "monthly",
    expected_amount: 100,
    expected_day: 1,
    active: true,
  });
  const source = data.income_sources[0].id;
  data = applyLocalAction(data, {
    action: "receive",
    id: source,
    account_id: data.accounts[0].id,
  });
  assert.equal(data.transactions.length, 1);
  assert.equal(expectedPayments(data, todayTR().slice(0, 7)).length, 0);
  assert.throws(() =>
    applyLocalAction(data, {
      action: "receive",
      id: source,
      account_id: data.accounts[0].id,
    }),
  );
  data = applyLocalAction(data, {
    action: "delete",
    table: "income_sources",
    id: source,
  });
  assert.equal(data.transactions[0].amount, 100);
  assert.equal(data.transactions[0].income_source_id, null);
});
