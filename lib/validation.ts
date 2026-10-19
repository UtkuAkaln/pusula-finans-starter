import { todayTR } from "./finance";
import { SAVINGS_ASSETS } from "./savings";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validId(v: unknown) {
  if (typeof v !== "string" || !uuid.test(v))
    throw new Error("Kayıt kimliği geçersiz.");
  return v;
}
const text = (v: unknown, max = 100) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new Error("Ad alanını kontrol edin.");
  return v.trim();
};
const num = (v: unknown, min = 0, max = 1e11) => {
  if (v === null || v === undefined || v === "")
    throw new Error("Tutar gerekli.");
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error("Sayısal değer geçersiz.");
  return Math.round(n * 100) / 100;
};
const date = (v: unknown) => {
  const s = String(v);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error("Tarih geçersiz.");
  return s;
};
const id = (v: unknown) => (v ? validId(v) : null);
const choice = (v: unknown, allowed: string[]) => {
  if (!allowed.includes(String(v))) throw new Error("Seçim geçersiz.");
  return String(v);
};
export const TABLES = [
  "accounts",
  "buckets",
  "income_sources",
  "recurring_items",
  "goals",
  "holdings",
  "transactions",
  "merchant_rules",
  "installment_plans",
] as const;
export type EditableTable = (typeof TABLES)[number];
export function validateRecord(
  table: string,
  r: Record<string, unknown>,
): Record<string, unknown> {
  switch (table) {
    case "accounts": {
      const day = date(r.balance_date);
      if (day > todayTR()) throw new Error("Bakiye tarihi gelecekte olamaz.");
      return {
        name: text(r.name),
        bank: text(r.bank),
        ...(r.account_type !== undefined
          ? {
              account_type: choice(r.account_type, [
                "bank",
                "cash",
                "credit_card",
              ]),
            }
          : {}),
        opening_balance: num(r.opening_balance, -1e11),
        balance_date: day,
        statement_day: r.statement_day
          ? Math.round(num(r.statement_day, 1, 31))
          : null,
        payment_day: r.payment_day
          ? Math.round(num(r.payment_day, 1, 31))
          : null,
      };
    }
    case "buckets":
      return {
        name: text(r.name),
        ratio: num(r.ratio, 0, 100),
        sort_order: num(r.sort_order ?? 0, 0, 100),
        kind: choice(r.kind || "custom", [
          "living",
          "fixed",
          "leisure",
          "flexible",
          "savings",
          "custom",
        ]),
        color:
          typeof r.color === "string" && /^#[0-9a-f]{6}$/i.test(r.color)
            ? r.color
            : "#abd698",
      };
    case "income_sources": {
      const period = choice(r.period, ["monthly", "weekly", "once"]);
      if (period === "once" && !r.expected_date)
        throw new Error("Tek seferlik ödeme için beklenen tarih gerekli.");
      if (period === "weekly" && !r.expected_date)
        throw new Error("Haftalık gelir için başlangıç tarihi gerekli.");
      return {
        name: text(r.name),
        type: choice(r.type, [
          "salary",
          "client",
          "sponsor",
          "rent",
          "sales",
          "other",
        ]),
        expected_amount: r.expected_amount
          ? num(r.expected_amount, 0.01)
          : null,
        period,
        expected_day:
          period !== "once"
            ? Math.round(
                num(r.expected_day || 1, 1, period === "weekly" ? 7 : 31),
              )
            : null,
        expected_date: r.expected_date ? date(r.expected_date) : null,
        note: String(r.note || "").slice(0, 2000),
        active: r.active !== false && r.active !== "false",
      };
    }
    case "recurring_items": {
      const period = choice(r.period || "monthly", ["monthly", "weekly"]);
      const start = date(r.start_date),
        end = r.end_date ? date(r.end_date) : null;
      if (end && end < start)
        throw new Error("Bitiş tarihi başlangıçtan önce olamaz.");
      return {
        name: text(r.name),
        amount: num(r.amount, 0.01),
        kind: choice(r.kind || "bill", ["bill", "subscription"]),
        period,
        day: Math.round(num(r.day, 1, period === "weekly" ? 7 : 31)),
        start_date: start,
        end_date: end,
        bucket_id: id(r.bucket_id),
        account_id: id(r.account_id),
      };
    }
    case "installment_plans": {
      const count = Math.round(num(r.installment_count, 2, 120));
      const recorded = Math.round(num(r.recorded_count ?? 0, 0, count));
      const total = num(r.total_amount, 0.01);
      const regular = num(r.installment_amount, 0.01);
      if (total <= regular * (count - 1))
        throw new Error(
          "Toplam tutar, önceki taksitlerin toplamından büyük olmalı.",
        );
      return {
        name: text(r.name),
        account_id: validId(r.account_id),
        bucket_id: id(r.bucket_id),
        total_amount: total,
        installment_amount: regular,
        installment_count: count,
        recorded_count: recorded,
        first_due_on: date(r.first_due_on),
      };
    }
    case "holdings": {
      const quantity = Number(r.quantity);
      if (
        r.quantity === "" ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 1e8 ||
        Math.round(quantity * 1e6) === 0
      )
        throw new Error(
          "Birikim miktarı sıfırdan büyük olmalı; en fazla 6 ondalık basamak kullanabilirsin.",
        );
      return {
        name: text(r.name),
        asset: choice(r.asset, Object.keys(SAVINGS_ASSETS)),
        quantity: Math.round(quantity * 1e6) / 1e6,
        cost_basis:
          r.cost_basis !== "" &&
          r.cost_basis !== null &&
          r.cost_basis !== undefined
            ? num(r.cost_basis)
            : null,
        goal_id: id(r.goal_id),
        note: String(r.note || "").slice(0, 2000),
      };
    }
    case "goals":
      return {
        name: text(r.name),
        amount: num(r.amount, 0.01),
        target_date: r.target_date ? date(r.target_date) : null,
      };
    case "transactions": {
      const day = date(r.occurred_on);
      if (day > todayTR())
        throw new Error(
          "Gelecekteki işlem için gelir kaynağı veya sabit kalem ekleyin.",
        );
      const direction = choice(r.direction, ["income", "expense"]);
      return {
        merchant: text(r.merchant, 200),
        amount: num(r.amount, 0.01),
        occurred_on: day,
        direction,
        currency: "TRY",
        account_id: validId(r.account_id),
        bucket_id: direction === "expense" ? id(r.bucket_id) : null,
        income_source_id:
          direction === "income" ? id(r.income_source_id) : null,
        note: String(r.note || "").slice(0, 2000),
        recurring_item_id:
          direction === "expense" ? id(r.recurring_item_id) : null,
        ...(r.recurring_period_start &&
        direction === "expense" &&
        r.recurring_item_id
          ? { recurring_period_start: date(r.recurring_period_start) }
          : {}),
      };
    }
    default:
      throw new Error("Bu kayıt türü düzenlenemez.");
  }
}
