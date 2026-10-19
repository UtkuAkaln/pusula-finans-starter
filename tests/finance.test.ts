import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountBalance,
  activeRecurring,
  budgets,
  dueDate,
  expectedPayments,
  goalEnvelopes,
  monthKey,
  projection,
  shiftMonth,
  todayTR,
} from "../lib/finance";
import { parseNotification, transactionFingerprint } from "../lib/parser";
import { EMPTY_DATA, type FinanceData, type Transaction } from "../lib/types";
const fixture = (): FinanceData => structuredClone(EMPTY_DATA);
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t",
    occurred_on: "2026-10-16",
    direction: "expense",
    amount: 100,
    currency: "TRY",
    merchant: "Migros",
    bucket_id: null,
    account_id: "a",
    note: "",
    method: "manual",
    recurring_item_id: null,
    income_source_id: null,
    ...overrides,
  };
}
test("Türkçe para ve maskeli kart numarası doğru ayrıştırılır", () => {
  const p = parseNotification(
    "Yapı Kredi\n16.10.2026 tarihinde 12XXX345 kartınızla 1.248,90 TL harcama yapılmıştır.\nİşyeri: Migros",
    "2026-10-16",
  );
  assert.deepEqual(p, {
    status: "ok",
    amount: 1248.9,
    merchant: "Migros",
    occurred_on: "2026-10-16",
    direction: "expense",
    bank: "Yapı Kredi",
  });
});
test("Gelen transfer gelir olarak ayrıştırılır", () => {
  const p = parseNotification(
    "İş Bankası\n16.10.2026 tarihinde hesabınıza 12.500,00 TL yatırılmıştır.\nGönderen: Tasarım projeleri",
    "2026-10-16",
  );
  assert.equal(p.status, "ok");
  if (p.status === "ok") {
    assert.equal(p.direction, "income");
    assert.equal(p.amount, 12500);
  }
});
test("Noktalı ondalık ve binlik tutarlar karışmaz", () => {
  for (const [raw, expected] of [
    ["123.45", 123.45],
    ["1.250", 1250],
    ["1.250,50", 1250.5],
  ] as const) {
    const p = parseNotification(
      `16.10.2026 tarihinde ${raw} TL harcama yapıldı.\nİşyeri: Test`,
      "2026-10-16",
    );
    assert.equal(p.status, "ok");
    if (p.status === "ok") assert.equal(p.amount, expected);
  }
});
test("Reklam, ekstre ve içeriksiz ileti atlanır", () => {
  for (const text of [
    "Kampanya! 500 TL harcama yapın, 100 TL kazanın.",
    "16.10.2026 Ekstre dönem borcu 12.000 TL.",
    "Yeni bildiriminiz var, uygulamadan bakın.",
  ])
    assert.equal(parseNotification(text, "2026-10-16").status, "ignored");
});
test("14 günden eski işlem atlanır; tarih ve tutar uydurulmaz", () => {
  assert.equal(
    parseNotification(
      "01.10.2026 tarihinde 12 TL harcama yapılmıştır.\nİşyeri: A",
      "2026-10-16",
    ).status,
    "ignored",
  );
  assert.equal(
    parseNotification(
      "16.10.2026 kartınızla 12XXX345 harcama.\nİşyeri: A",
      "2026-10-16",
    ).status,
    "error",
  );
  assert.equal(
    parseNotification("Kartınızla 15 TL harcama.\nİşyeri: A", "2026-10-16")
      .status,
    "error",
  );
});
test("İleri ve takvimde olmayan tarihler reddedilir", () => {
  for (const date of ["31.02.2026", "17.10.2026"])
    assert.equal(
      parseNotification(
        `${date} tarihinde 15 TL harcama.\nİşyeri: A`,
        "2026-10-16",
      ).status,
      "error",
    );
});
test("Birden fazla tutar ve eksik işyeri manuel kontrole ayrılır", () => {
  assert.equal(
    parseNotification(
      "16.10.2026 harcama 100 TL. Limit 500 TL.\nİşyeri: A",
      "2026-10-16",
    ).status,
    "error",
  );
  assert.equal(
    parseNotification(
      "16.10.2026 tarihinde 100 TL harcama yapıldı.",
      "2026-10-16",
    ).status,
    "error",
  );
});
test("Mükerrer anahtarı gün, yön, tutar ve normalize işyerinden oluşur", () => {
  assert.equal(
    transactionFingerprint(tx()),
    transactionFingerprint(tx({ merchant: " MIGROS " })),
  );
  assert.notEqual(
    transactionFingerprint(tx()),
    transactionFingerprint(tx({ direction: "income" })),
  );
});
test("Açılış tarihi dahil eski işlemler ikinci kez düşülmez", () => {
  const d = fixture();
  d.accounts = [
    {
      id: "a",
      name: "Banka",
      bank: "İş Bankası",
      opening_balance: 1000,
      balance_date: "2026-10-10",
      color: "#ffffff",
    },
  ];
  d.transactions = [
    tx({ occurred_on: "2026-10-09" }),
    tx({ occurred_on: "2026-10-10" }),
    tx({ occurred_on: "2026-10-11", amount: 150 }),
    tx({ occurred_on: "2026-10-12", direction: "income", amount: 200 }),
    tx({ occurred_on: "2026-11-01", amount: 999 }),
  ];
  assert.equal(accountBalance(d, "a", "2026-10-16"), 1050);
  assert.ok(Number.isNaN(accountBalance(d, "a", "2026-10-01")));
});
test("Ayın 31indeki sabit gider kısa ayın son gününe gelir", () => {
  assert.equal(dueDate("2026-02", 31), "2026-02-28");
  assert.equal(dueDate("2028-02", 31), "2028-02-29");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});
test("Sabit giderler başlangıç/bitiş tarihine göre bütçelenir", () => {
  const r = {
    id: "r",
    name: "Taksit",
    amount: 500,
    day: 15,
    start_date: "2026-10-16",
    end_date: "2026-12-14",
    bucket_id: null,
    account_id: null,
  };
  assert.equal(activeRecurring(r, "2026-10"), false);
  assert.equal(activeRecurring(r, "2026-11"), true);
  assert.equal(activeRecurring(r, "2026-12"), false);
});
test("Gelir yoksa bütçe sabit gider oranından çıkarılır", () => {
  const d = fixture();
  d.buckets = [
    {
      id: "f",
      name: "Sabit",
      ratio: 25,
      kind: "fixed",
      sort_order: 0,
      color: "#fff",
    },
    {
      id: "l",
      name: "Yaşam",
      ratio: 25,
      kind: "living",
      sort_order: 1,
      color: "#fff",
    },
  ];
  d.recurring_items = [
    {
      id: "r",
      name: "Kira",
      amount: 20000,
      day: 1,
      start_date: "2026-01-01",
      end_date: null,
      bucket_id: "f",
      account_id: null,
    },
  ];
  const b = budgets(d, "2026-10");
  assert.equal(b[0].budget, 20000);
  assert.equal(b[1].budget, 20000);
});
test("Kısmi gelir yalnızca kalan tutar kadar beklenir", () => {
  const d = fixture();
  d.income_sources = [
    {
      id: "s",
      name: "Maaş",
      type: "salary",
      expected_amount: 60000,
      period: "monthly",
      expected_day: 5,
      expected_date: null,
      note: "",
      active: true,
    },
  ];
  d.transactions = [
    tx({ direction: "income", amount: 25000, income_source_id: "s" }),
  ];
  assert.equal(expectedPayments(d, "2026-10")[0].remaining, 35000);
});
test("Tek seferlik erken gelen ödeme tekrar beklenmez", () => {
  const d = fixture();
  d.income_sources = [
    {
      id: "s",
      name: "Proje",
      type: "client",
      expected_amount: 1000,
      period: "once",
      expected_day: null,
      expected_date: "2026-10-20",
      note: "",
      active: true,
    },
  ];
  d.transactions = [
    tx({
      occurred_on: "2026-09-25",
      direction: "income",
      amount: 1000,
      income_source_id: "s",
    }),
  ];
  assert.equal(expectedPayments(d, "2026-10").length, 0);
});
test("Zarf yöntemi yakın hedefi önce doldurur, borcu varlık saymaz", () => {
  const d = fixture();
  d.accounts = [
    {
      id: "a",
      name: "Banka",
      bank: "Diğer",
      opening_balance: 5000,
      balance_date: todayTR(),
      color: "#fff",
    },
    {
      id: "b",
      name: "Borç",
      bank: "Diğer",
      opening_balance: -2000,
      balance_date: todayTR(),
      color: "#fff",
    },
  ];
  d.goals = [
    { id: "g2", name: "Fon", amount: 5000, target_date: null, icon: "shield" },
    {
      id: "g1",
      name: "Yakın",
      amount: 2000,
      target_date: shiftMonth(monthKey(), 1) + "-01",
      icon: "plane",
    },
  ];
  const goals = goalEnvelopes(d, monthKey());
  assert.equal(goals[0].id, "g1");
  assert.equal(goals[0].allocated, 2000);
  assert.equal(goals[1].allocated, 1000);
});
test("Projeksiyon bu ay gerçekleşeni ikinci kez düşmez ve birikimi gider saymaz", () => {
  const d = fixture(),
    m = monthKey();
  d.accounts = [
    {
      id: "a",
      name: "Banka",
      bank: "Diğer",
      opening_balance: 10000,
      balance_date: m + "-01",
      color: "#fff",
    },
  ];
  d.buckets = [
    {
      id: "l",
      name: "Yaşam",
      ratio: 80,
      kind: "living",
      sort_order: 0,
      color: "#fff",
    },
    {
      id: "s",
      name: "Birikim",
      ratio: 20,
      kind: "savings",
      sort_order: 1,
      color: "#fff",
    },
  ];
  d.income_sources = [
    {
      id: "source",
      name: "Maaş",
      type: "salary",
      expected_amount: 10000,
      period: "monthly",
      expected_day: 5,
      expected_date: null,
      note: "",
      active: true,
    },
  ];
  d.transactions = [
    tx({
      occurred_on: todayTR(),
      direction: "income",
      amount: 10000,
      income_source_id: "source",
    }),
    tx({ occurred_on: todayTR(), bucket_id: "l", amount: 3000 }),
  ];
  const start = accountBalance(d, "a");
  const p = projection(d, m);
  assert.equal(p[0].balance, start - 5000);
  assert.equal(p[1].balance, p[0].balance + 2000);
});
test("İlgisiz gelir, henüz gelmemiş kaynak ödemesini iptal etmez", () => {
  const d = fixture(),
    m = monthKey();
  d.accounts = [
    {
      id: "a",
      name: "A",
      bank: "Diğer",
      opening_balance: 1000,
      balance_date: todayTR(),
      color: "#fff",
    },
  ];
  d.income_sources = [
    {
      id: "s",
      name: "Proje",
      type: "client",
      expected_amount: 5000,
      period: "monthly",
      expected_day: 25,
      expected_date: null,
      note: "",
      active: true,
    },
  ];
  d.transactions = [
    tx({
      occurred_on: todayTR(),
      direction: "income",
      amount: 10000,
      income_source_id: null,
    }),
  ];
  assert.equal(projection(d, m)[0].balance, 6000);
});

test("Önceki aydan kalmış tek seferlik ödeme vade uyarısıyla listelenir", () => {
  const d = fixture();
  d.income_sources = [
    {
      id: "s",
      name: "Proje",
      type: "client",
      expected_amount: 500,
      period: "once",
      expected_day: null,
      expected_date: "2026-09-15",
      note: "",
      active: true,
    },
  ];
  const payments = expectedPayments(d, "2026-10");
  assert.equal(payments.length, 1);
  assert.equal(payments[0].remaining, 500);
  assert.equal(payments[0].due, "2026-09-15");
});
test("Hedef süresi önceki zarfların eksik tutarını da kapsar", () => {
  const d = fixture(),
    m = monthKey();
  d.accounts = [
    {
      id: "a",
      name: "Banka",
      bank: "Diğer",
      opening_balance: 0,
      balance_date: todayTR(),
      color: "#fff",
    },
  ];
  d.transactions = [
    tx({
      occurred_on: shiftMonth(m, -1) + "-15",
      direction: "income",
      amount: 1000,
    }),
  ];
  d.goals = [
    {
      id: "g1",
      name: "Önce",
      amount: 2000,
      target_date: shiftMonth(m, 1) + "-01",
      icon: "plane",
    },
    {
      id: "g2",
      name: "Sonra",
      amount: 3000,
      target_date: null,
      icon: "shield",
    },
  ];
  const goals = goalEnvelopes(d, m);
  assert.equal(goals[0].eta, 2);
  assert.equal(goals[1].eta, 5);
});
