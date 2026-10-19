import { test } from "node:test";
import assert from "node:assert/strict";
import {
  budgets,
  expectedPayments,
  expectedSource,
  recurringDates,
  recurringOccurrences,
  recurringPeriodStart,
  recurringSuggestions,
  weeklyDates,
} from "../lib/finance";
import { validateRecord } from "../lib/validation";
import { subscriptionInsights } from "../lib/insights";
import {
  EMPTY_DATA,
  type IncomeSource,
  type Recurring,
  type Transaction,
} from "../lib/types";

const ID = "11111111-1111-4111-8111-111111111111";
const recurring: Recurring = {
  id: ID,
  name: "Ders",
  amount: 100,
  period: "weekly",
  day: 4,
  start_date: "2026-10-01",
  end_date: null,
  account_id: ID,
  bucket_id: ID,
};
const income: IncomeSource = {
  id: ID,
  name: "Haftalık gelir",
  type: "other",
  expected_amount: 200,
  period: "weekly",
  expected_day: 4,
  expected_date: "2026-10-01",
  note: "",
  active: true,
};
const tx = (patch: Partial<Transaction> = {}): Transaction => ({
  id: ID,
  merchant: "Ders",
  amount: 100,
  occurred_on: "2026-10-01",
  direction: "expense",
  currency: "TRY",
  account_id: ID,
  bucket_id: ID,
  recurring_item_id: ID,
  income_source_id: null,
  note: "",
  method: "manual",
  ...patch,
});

test("Haftalık takvim dört/beş tekrar, pazar ve artık yıl sınırlarını korur", () => {
  assert.deepEqual(weeklyDates("2026-10", 4, "2026-10-01"), [
    "2026-10-01",
    "2026-10-08",
    "2026-10-15",
    "2026-10-22",
    "2026-10-29",
  ]);
  assert.equal(weeklyDates("2026-11", 4, "2026-10-01").length, 4);
  assert.deepEqual(weeklyDates("2026-11", 7, "2026-11-01", "2026-11-08"), [
    "2026-11-01",
    "2026-11-08",
  ]);
  assert.deepEqual(weeklyDates("2028-02", 2, "2028-02-28"), ["2028-02-29"]);
  assert.deepEqual(
    recurringDates(
      { ...recurring, start_date: "2026-10-09", end_date: "2026-10-23" },
      "2026-10",
    ),
    ["2026-10-15", "2026-10-22"],
  );
});
test("Gelir ve sabit gider bütçeleri gerçek tekrar sayısını kullanır", () => {
  const data = {
    ...structuredClone(EMPTY_DATA),
    income_sources: [income],
    recurring_items: [recurring],
    buckets: [
      {
        id: ID,
        name: "Sabit",
        kind: "fixed",
        ratio: 25,
        color: "#abd698",
        sort_order: 0,
      },
    ],
  };
  assert.equal(expectedSource(income, "2026-10"), 1000);
  assert.equal(expectedSource(income, "2026-11"), 800);
  assert.equal(expectedSource({ ...income, active: false }, "2026-10"), 0);
  assert.equal(
    expectedSource({ ...income, expected_date: "2026-11-05" }, "2026-10"),
    0,
  );
  assert.equal(budgets(data, "2026-10")[0].budget, 500);
  assert.equal(budgets(data, "2026-11")[0].budget, 400);
});
test("Haftalık gelir tahsilatı eski vadeden başlar ve kısmi tutarı korur", () => {
  const data = {
    ...structuredClone(EMPTY_DATA),
    income_sources: [income],
    transactions: [
      tx({
        direction: "income",
        income_source_id: ID,
        recurring_item_id: null,
        amount: 250,
      }),
    ],
  };
  const payments = expectedPayments(data, "2026-10");
  assert.deepEqual(
    payments.map((p) => [p.due, p.remaining]),
    [
      ["2026-10-08", 150],
      ["2026-10-15", 200],
      ["2026-10-22", 200],
      ["2026-10-29", 200],
    ],
  );
  assert.equal(expectedPayments(data, "2026-11").length, 4);
});
test("Haftalık ödeme eşleşmesi yalnız kendi haftasını kapatır, erken ödeme de korunur", () => {
  const data = {
    ...structuredClone(EMPTY_DATA),
    recurring_items: [recurring],
    transactions: [
      tx({ occurred_on: "2026-09-29", recurring_period_start: "2026-10-05" }),
    ],
  };
  const occurrences = recurringOccurrences(data, "2026-10");
  assert.deepEqual(
    occurrences.filter((p) => p.matched).map((p) => p.due),
    ["2026-10-08"],
  );
  assert.equal(
    recurringSuggestions(data, tx({ occurred_on: "2026-10-08" })).length,
    0,
  );
  assert.equal(
    recurringSuggestions(data, tx({ occurred_on: "2026-10-15" })).length,
    1,
  );
  assert.equal(recurringPeriodStart(recurring, "2026-11-01"), "2026-10-26");
  assert.equal(
    recurringPeriodStart({ ...recurring, period: "monthly" }, "2026-11-01"),
    "2026-11-01",
  );
  assert.equal(
    recurringSuggestions(
      {
        ...data,
        recurring_items: [{ ...recurring, day: 7 }],
        transactions: [],
      },
      tx({ occurred_on: "2026-10-30" }),
    )[0]?.id,
    ID,
  );
});
test("Haftalık seçenekler doğrulanır, eski aylık kayıtlara aylık varsayılır", () => {
  assert.equal(validateRecord("income_sources", income).period, "weekly");
  assert.equal(validateRecord("recurring_items", recurring).period, "weekly");
  assert.equal(
    validateRecord("recurring_items", { ...recurring, period: undefined })
      .period,
    "monthly",
  );
  assert.throws(() =>
    validateRecord("recurring_items", { ...recurring, day: 8 }),
  );
  assert.throws(() =>
    validateRecord("income_sources", { ...income, expected_day: 8 }),
  );
  assert.throws(() =>
    validateRecord("income_sources", { ...income, expected_date: null }),
  );
});
test("Haftalık aboneliğin farklı haftalardaki ödemeleri mükerrer sayılmaz", () => {
  const result = subscriptionInsights({
    ...structuredClone(EMPTY_DATA),
    recurring_items: [{ ...recurring, kind: "subscription" }],
    transactions: [tx(), tx({ occurred_on: "2026-10-08" })],
  });
  assert.equal(result[0].duplicates, false);
});
