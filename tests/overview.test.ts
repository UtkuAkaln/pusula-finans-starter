import test from "node:test";
import assert from "node:assert/strict";
import { overviewSummary, recentTransactions } from "../lib/overview";
import { EMPTY_DATA, type FinanceData, type Transaction } from "../lib/types";
import { validateRecord } from "../lib/validation";
function transaction(p: Partial<Transaction> = {}): Transaction {
  return {
    id: "t",
    occurred_on: "2026-10-16",
    direction: "expense",
    amount: 100,
    currency: "TRY",
    merchant: "Market",
    account_id: "card",
    bucket_id: null,
    note: "",
    method: "manual",
    recurring_item_id: null,
    income_source_id: null,
    ...p,
  };
}
function fixture(): FinanceData {
  const data = structuredClone(EMPTY_DATA);
  data.accounts = [
    {
      id: "bank",
      name: "Banka",
      bank: "Yapı Kredi",
      account_type: "bank",
      opening_balance: 2500,
      balance_date: "2026-10-16",
      color: "#fff",
    },
    {
      id: "card",
      name: "Kart",
      bank: "İş Bankası",
      account_type: "credit_card",
      opening_balance: 0,
      balance_date: "2026-10-07",
      color: "#fff",
    },
  ];
  return data;
}
test("Elimdeki para kredi kartı borcunu içermez; toplam varlık istenen farktır", () => {
  const data = fixture();
  data.transactions = [transaction({ amount: 3750.25 })];
  const result = overviewSummary(data, "2026-10", "2026-10-17");
  assert.equal(result.cash, 2500);
  assert.equal(result.spending, 3750.25);
  assert.equal(result.assets, 2500 - 3750.25);
  assert.equal(result.cashAccountCount, 1);
});
test("Kredi kartındaki artı bakiye de nakit gibi gösterilmez", () => {
  const data = fixture();
  data.accounts[1].opening_balance = 10000;
  assert.equal(overviewSummary(data, "2026-10", "2026-10-17").cash, 2500);
});
test("Nakit ve banka birlikte sayılır, eksi hesap eldeki parayı azaltmaz", () => {
  const data = fixture();
  data.accounts.push(
    {
      id: "cash",
      name: "Cüzdan",
      bank: "Nakit",
      account_type: "cash",
      opening_balance: 500,
      balance_date: "2026-10-16",
      color: "#fff",
    },
    {
      id: "overdraft",
      name: "Eksi hesap",
      bank: "Diğer",
      account_type: "bank",
      opening_balance: -100,
      balance_date: "2026-10-16",
      color: "#fff",
    },
  );
  assert.equal(overviewSummary(data, "2026-10", "2026-10-17").cash, 3000);
});
test("Fark seçili ayın harcamasını kullanır, son hareket kartı tüm kayıtları izler", () => {
  const data = fixture();
  data.transactions = [
    transaction({ id: "oct", amount: 50 }),
    transaction({
      id: "sep",
      occurred_on: "2026-09-30",
      amount: 100,
      created_at: "2026-10-17T12:00:00Z",
    }),
  ];
  const result = overviewSummary(data, "2026-10", "2026-10-17");
  assert.equal(result.spending, 50);
  assert.equal(result.assets, 2450);
  assert.equal(result.recent[0].id, "sep");
});
test("Son işleme alınan kayıt, geçmiş tarihli olsa da ilk sıradadır", () => {
  const older = transaction({
    id: "old",
    occurred_on: "2026-10-16",
    created_at: "2026-10-16T14:00:00Z",
  });
  const last = transaction({
    id: "last",
    occurred_on: "2026-10-08",
    direction: "income",
    created_at: "2026-10-17T12:00:00Z",
  });
  assert.deepEqual(
    recentTransactions([older, last]).map((t) => t.id),
    ["last", "old"],
  );
});
test("Aynı anda içe alınmış kayıtlarda gün ve ekrandaki saat sıralanır", () => {
  const created_at = "2026-10-16T20:00:00Z";
  const rows = [
    transaction({ id: "morning", created_at, note: "Saat: 08:10." }),
    transaction({ id: "previous", created_at, note: "Saat: 14:20." }),
    transaction({ id: "latest", created_at, note: "Saat: 17:45." }),
  ];
  assert.deepEqual(
    recentTransactions(rows).map((t) => t.id),
    ["latest", "previous"],
  );
  assert.equal(rows[0].id, "morning");
});
test("Kayıt yokken son hareket listesi boş olur", () =>
  assert.deepEqual(recentTransactions([]), []));
test("Eski hesap güncellemesi türü sıfırlamaz; açık hesap türü doğrulanır", () => {
  const record = {
    name: "Kart",
    bank: "İş Bankası",
    opening_balance: 0,
    balance_date: "2026-10-07",
  };
  assert.ok(!("account_type" in validateRecord("accounts", record)));
  assert.equal(
    validateRecord("accounts", { ...record, account_type: "credit_card" })
      .account_type,
    "credit_card",
  );
  assert.throws(() =>
    validateRecord("accounts", { ...record, account_type: "invalid" }),
  );
});
