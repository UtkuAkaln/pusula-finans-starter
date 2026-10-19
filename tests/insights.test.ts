import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DATA, type FinanceData, type Transaction } from "../lib/types";
import {
  installmentSchedule,
  classificationSuggestion,
  weeklySummary,
  subscriptionInsights,
  cardSummary,
  expenseDistribution,
} from "../lib/insights";
import { editCandidates } from "../lib/telegram-edit-plan";
import { fixture, plan, A, K } from "./telegram-fixture";
const tx = (r: Partial<Transaction> = {}): Transaction => ({
  id: "tx",
  occurred_on: "2026-10-16",
  direction: "expense",
  amount: 100,
  currency: "TRY",
  merchant: "Market",
  bucket_id: null,
  account_id: A,
  note: "",
  method: "manual",
  recurring_item_id: null,
  income_source_id: null,
  ...r,
});
const data = (r: Partial<FinanceData> = {}): FinanceData => ({
  ...structuredClone(EMPTY_DATA),
  ...r,
});
test("Taksit planı son taksitte kuruş farkını korur; kısa ayda son güne iner", () => {
  const s = installmentSchedule({
    id: A,
    name: "Telefon",
    account_id: A,
    bucket_id: null,
    total_amount: 1000,
    installment_amount: 333.33,
    installment_count: 3,
    recorded_count: 1,
    first_due_on: "2026-01-31",
  });
  assert.deepEqual(
    s.map((r) => r.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.equal(s[2].amount, 333.34);
  assert.equal(
    s.filter((r) => !r.recorded).reduce((a, r) => a + r.amount, 0),
    666.67,
  );
});
test("Market varyantı tanınır; bilinmeyen işyeri tahminle atanmaz", () => {
  const d = data({
    buckets: [
      {
        id: K,
        name: "Zorunlu yaşam",
        kind: "living",
        ratio: 25,
        sort_order: 0,
        color: "#abd698",
      },
    ],
  });
  assert.equal(classificationSuggestion(d, "BİM T258 Yenişehir")?.bucket_id, K);
  assert.equal(classificationSuggestion(d, "Belirsiz satış noktası"), null);
});
test("Öğrenme en az üç elle seçilmiş ve tutarlı kayıt ister; otomatik seçim kendini eğitmez", () => {
  const d = data({
    transactions: [1, 2, 3].map((i) =>
      tx({ id: String(i), merchant: "Terzi", bucket_id: K }),
    ),
  });
  assert.equal(classificationSuggestion(d, "Terzi")?.bucket_id, K);
  d.transactions[2].classification_source = "history";
  assert.equal(classificationSuggestion(d, "Terzi"), null);
});
test("Haftalık karşılaştırma sınırları yedi gündür; silinen kayıtlar dışarıda kalır", () => {
  const w = weeklySummary(
    data({
      transactions: [
        tx({ amount: 200, occurred_on: "2026-10-10" }),
        tx({ amount: 100, occurred_on: "2026-10-03" }),
        tx({ amount: 900, deleted_at: "2026-10-16" }),
        tx({ amount: 50, direction: "income" }),
      ],
    }),
    "2026-10-16",
  );
  assert.equal(w.start, "2026-10-10");
  assert.equal(w.spending, 200);
  assert.equal(w.previousSpending, 100);
  assert.equal(w.change, 100);
  assert.equal(w.income, 50);
});
test("Abonelik tespiti farklı aylarda tekrarı ister; fiyat artışını ve çift ödemeyi bildirir", () => {
  const d = data({
    transactions: [
      tx({
        id: "1",
        merchant: "Netflix",
        occurred_on: "2026-09-15",
        amount: 200,
      }),
      tx({
        id: "2",
        merchant: "Netflix",
        occurred_on: "2026-10-15",
        amount: 250,
      }),
      tx({
        id: "3",
        merchant: "Netflix",
        occurred_on: "2026-10-16",
        amount: 250,
      }),
    ],
  });
  const s = subscriptionInsights(d)[0];
  assert.ok(s.detected);
  assert.equal(s.increase, 50);
  assert.ok(s.duplicates);
  assert.equal(
    subscriptionInsights(data({ transactions: [tx({ merchant: "Netflix" })] }))
      .length,
    0,
  );
});
test("Sık market alışverişleri aboneliğe dönüşmez", () => {
  assert.equal(
    subscriptionInsights(
      data({
        transactions: [
          tx({ occurred_on: "2026-08-01", amount: 90 }),
          tx({ occurred_on: "2026-09-03", amount: 200 }),
          tx({ occurred_on: "2026-10-01", amount: 400 }),
        ],
      }),
    ).length,
    0,
  );
});
test("Abonelik eşleştirmesi farklı ödeme kuruluşu adıyla gelen işlemleri birleştirir", () => {
  const item = {
    id: K,
    name: "Film üyeliği",
    amount: 100,
    day: 15,
    start_date: "2026-01-01",
    end_date: null,
    bucket_id: null,
    account_id: A,
    kind: "subscription" as const,
  };
  const result = subscriptionInsights(
    data({
      recurring_items: [item],
      transactions: [
        tx({
          id: "old",
          merchant: "Ödeme Kuruluşu",
          amount: 100,
          occurred_on: "2026-09-15",
          recurring_item_id: K,
        }),
        tx({
          id: "new",
          merchant: "Diğer Ödeme Kuruluşu",
          amount: 130,
          occurred_on: "2026-10-15",
          recurring_item_id: K,
        }),
      ],
    }),
  );
  assert.equal(result[0].name, "Film üyeliği");
  assert.equal(result[0].increase, 30);
  assert.equal(result[0].detected, false);
});
test("Kart kesiminden önce önceki ekstreyi seçer, ödeme ayı ileri taşınır", () => {
  const d = data({
    accounts: [
      {
        id: A,
        name: "Kart",
        bank: "İş Bankası",
        account_type: "credit_card",
        opening_balance: 0,
        balance_date: "2026-08-01",
        color: "#abd698",
        statement_day: 20,
        payment_day: 1,
      },
    ],
    transactions: [
      tx({ occurred_on: "2026-09-10", amount: 100 }),
      tx({ occurred_on: "2026-10-10", amount: 50 }),
    ],
  });
  const s = cardSummary(d, A, "2026-10-17");
  assert.equal(s.statement, "2026-09-20");
  assert.equal(s.payment, "2026-10-01");
  assert.equal(s.statementDebt, 100);
  assert.equal(s.debt, 150);
});
test("Donut toplamı sınıflandırılmamış giderleri içerir, gelirleri içermez", () => {
  const rows = expenseDistribution(
    data({
      transactions: [
        tx(),
        tx({ id: "income", direction: "income", amount: 500 }),
      ],
    }),
    "2026-10",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Sınıflandırılmamış");
  assert.equal(rows[0].value, 100);
});
test("İşlem hedefi belirsizse seçim ister; hedef tutarı yeni tutarla karıştırmaz", () => {
  const rows = [
    tx({ id: "1", merchant: "BİM T258", amount: 250 }),
    tx({ id: "2", merchant: "BİM T258", amount: 300 }),
  ];
  assert.equal(
    editCandidates(rows, plan({ intent: "edit", amount: 999 })).length,
    0,
  );
  assert.equal(
    editCandidates(
      rows,
      plan({
        intent: "edit",
        target_merchant: "BİM",
        target_amount: 250,
        amount: 999,
      }),
    )[0].id,
    "1",
  );
});
test("Telegram değişiklik ve onay akışı yeni harcama eklemez", async () => {
  const f = fixture([plan({ intent: "edit", target_last: true, amount: 300 })]);
  let applied = 0;
  f.ports.change = async (p) =>
    p.intent === "confirm"
      ? { reply: { text: "Güncellendi" }, state: { pending_mutation_id: null } }
      : {
          reply: { text: "/onay bekliyor" },
          state: { pending_mutation_id: A },
        };
  assert.match((await f.turn(1, "son işlemi 300 yap")).text, /onay/);
  const change = f.ports.change;
  f.ports.change = async (...args) => {
    applied++;
    return change(...args);
  };
  assert.match((await f.turn(2, "/onay")).text, /Güncellendi/);
  assert.equal(applied, 1);
  assert.equal(f.commits, 0);
  await f.turn(2, "/onay");
  assert.equal(applied, 1);
});
