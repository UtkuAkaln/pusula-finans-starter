import { EMPTY_DATA, type FinanceData } from "./types";
import { TABLES, validId, validateRecord } from "./validation";
import {
  expectedPayments,
  normalizeMerchant,
  recurringDates,
  recurringDueDate,
  recurringPayment,
  recurringPeriodStart,
  todayTR,
  monthKey,
} from "./finance";
import { classificationSuggestion, installmentSchedule } from "./insights";

const STORAGE_KEY = "pusula-starter-v1";
const defaultBuckets = [
  ["Yaşam", "living", 25, "#abd698"],
  ["Faturalar", "fixed", 25, "#9cbbf9"],
  ["Keyif", "leisure", 15, "#c6adf3"],
  ["Esnek", "flexible", 15, "#edc88d"],
  ["Birikim", "savings", 20, "#7acbb8"],
  ["Yemek", "custom", 0, "#e7aa8f"],
] as const;
export function blankData(): FinanceData {
  return {
    ...structuredClone(EMPTY_DATA),
    installment_plans: [],
    preferences: { auto_classify: true, weekly_digest: false },
    buckets: defaultBuckets.map(([name, kind, ratio, color], sort_order) => ({
      id: crypto.randomUUID(),
      name,
      kind,
      ratio,
      color,
      sort_order,
    })),
  };
}
export function readLocalData(): FinanceData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const data = blankData();
    writeLocalData(data);
    return data;
  }
  try {
    const data = JSON.parse(saved) as FinanceData;
    for (const table of TABLES) {
      const rows = data[table as keyof FinanceData];
      if (!Array.isArray(rows)) throw new Error("Eksik tablo");
      for (const row of rows as Row[]) {
        validId(row.id);
        if (table === "merchant_rules") {
          validId(row.bucket_id);
          if (typeof row.merchant !== "string" || !row.merchant.trim())
            throw new Error("İşyeri kuralı geçersiz.");
        } else validateRecord(table, row);
      }
    }
    if (!Array.isArray(data.raw_notifications)) throw new Error("Eksik veri");
    data.buckets.sort((a, b) => a.sort_order - b.sort_order);
    data.transactions.sort(
      (a, b) =>
        b.occurred_on.localeCompare(a.occurred_on) ||
        (b.created_at || "").localeCompare(a.created_at || ""),
    );
    return data;
  } catch {
    throw new Error(
      "Yerel kayıt okunamadı. Tarayıcı verilerini silmeden önce yedeğini kontrol et.",
    );
  }
}
export function writeLocalData(data: FinanceData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new Error(
      "Kayıt saklanamadı. Tarayıcı depolama alanını veya gizlilik ayarlarını kontrol et.",
    );
  }
}
export const isLocalDataEvent = (event: StorageEvent) =>
  event.key === STORAGE_KEY;

type Row = Record<string, any>;
export function applyLocalAction(
  original: FinanceData,
  body: Row,
): FinanceData {
  const data = structuredClone(original);
  const rows = (table: string): Row[] => {
    if (!TABLES.includes(table as any)) throw new Error("Kayıt türü geçersiz.");
    return (data as any)[table];
  };
  const find = (table: string, id: unknown) => {
    const row = rows(table).find((r) => r.id === validId(id));
    if (!row) throw new Error("Kayıt bulunamadı.");
    return row;
  };
  const exists = (table: string, id: unknown) => {
    if (id) find(table, id);
  };
  if (body.action === "process") return data;
  if (body.action === "preferences") {
    if (body.weekly_digest)
      throw new Error("Şifresiz sürümde Telegram bağlantısı bulunmuyor.");
    data.preferences = {
      auto_classify:
        typeof body.auto_classify === "boolean"
          ? body.auto_classify
          : (data.preferences?.auto_classify ?? true),
      weekly_digest: false,
    };
    return data;
  }
  if (body.action === "clear_demo") return data;
  if (body.action === "classify_pending") {
    for (const t of data.transactions.filter(
      (t) => t.direction === "expense" && !t.bucket_id,
    )) {
      const suggestion = classificationSuggestion(data, t.merchant);
      if (suggestion) {
        t.bucket_id = suggestion.bucket_id;
        t.classification_source = "suggestion";
      }
    }
    return data;
  }
  if (body.action === "assign") {
    const t = find("transactions", body.id);
    find("buckets", body.bucket_id);
    if (t.direction !== "expense")
      throw new Error("Yalnızca harcamaya kova atanır.");
    t.bucket_id = body.bucket_id;
    t.classification_source = null;
    if (body.remember) {
      const merchant = normalizeMerchant(t.merchant),
        rule = data.merchant_rules.find((r) => r.merchant === merchant);
      if (rule) rule.bucket_id = body.bucket_id;
      else
        data.merchant_rules.push({
          id: crypto.randomUUID(),
          merchant,
          bucket_id: body.bucket_id,
        });
    }
    return data;
  }
  if (body.action === "match") {
    const item = find("recurring_items", body.recurring_id),
      t = find("transactions", body.id);
    const due = body.due_on || recurringDueDate(item as any, t.occurred_on);
    if (
      t.direction !== "expense" ||
      !recurringDates(item as any, due.slice(0, 7)).includes(due)
    )
      throw new Error("Ödeme dönemi geçersiz.");
    const matched = recurringPayment(data, item as any, due);
    if (matched && matched.id !== t.id)
      throw new Error("Bu dönemki ödeme zaten kaydedilmiş.");
    t.recurring_item_id = item.id;
    t.recurring_period_start = recurringPeriodStart(item as any, due);
    t.bucket_id = item.bucket_id;
    return data;
  }
  if (body.action === "receive") {
    const source = find("income_sources", body.id);
    const month = String(body.month || monthKey());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > monthKey())
      throw new Error("Gelir ayı geçersiz.");
    const payment = expectedPayments(data, month).find(
      (p) => p.id === source.id && (!body.due_on || p.due === body.due_on),
    );
    if (!payment) throw new Error("Bekleyen ödeme bulunamadı.");
    if (
      source.period === "weekly" &&
      expectedPayments(data, month).some(
        (p) => p.id === source.id && p.due < payment.due,
      )
    )
      throw new Error("Önce eski haftanın ödemesini kaydet.");
    return applyLocalAction(data, {
      action: "save",
      table: "transactions",
      record: {
        merchant: source.name,
        amount: payment.remaining,
        direction: "income",
        occurred_on: month === monthKey() ? todayTR() : month + "-28",
        account_id: body.account_id,
        income_source_id: source.id,
      },
    });
  }
  if (body.action === "record_installment") {
    const plan = find("installment_plans", body.id);
    if (
      !Number.isInteger(body.number) ||
      body.number !== plan.recorded_count + 1
    )
      throw new Error("Taksit sırası geçersiz veya ödeme zaten kaydedilmiş.");
    const due = installmentSchedule(plan as any).find(
      (p) => p.number === body.number,
    );
    if (!due || due.date > todayTR()) throw new Error("Taksit henüz gelmedi.");
    const next = applyLocalAction(data, {
      action: "save",
      table: "transactions",
      record: {
        merchant: plan.name,
        amount: due.amount,
        direction: "expense",
        occurred_on: due.date,
        account_id: plan.account_id,
        bucket_id: plan.bucket_id,
      },
    });
    next.transactions.at(-1)!.installment_plan_id = plan.id;
    next.installment_plans!.find((p) => p.id === plan.id)!.recorded_count++;
    return next;
  }
  const table = String(body.table),
    list = rows(table);
  if (body.action === "delete") {
    const old = find(table, body.id);
    if (
      table === "accounts" &&
      (data.transactions.some((t) => t.account_id === old.id) ||
        data.installment_plans?.some((p) => p.account_id === old.id))
    )
      throw new Error("Bu hesaba bağlı kayıtlar var. Önce başka hesaba taşı.");
    (data as any)[table] = list.filter((r) => r.id !== old.id);
    if (table === "buckets") {
      for (const t of data.transactions)
        if (t.bucket_id === old.id) t.bucket_id = null;
      for (const r of data.recurring_items)
        if (r.bucket_id === old.id) r.bucket_id = null;
      for (const p of data.installment_plans || [])
        if (p.bucket_id === old.id) p.bucket_id = null;
      data.merchant_rules = data.merchant_rules.filter(
        (r) => r.bucket_id !== old.id,
      );
    }
    if (table === "income_sources")
      for (const t of data.transactions)
        if (t.income_source_id === old.id) t.income_source_id = null;
    if (table === "goals")
      for (const h of data.holdings || [])
        if (h.goal_id === old.id) h.goal_id = null;
    if (table === "recurring_items")
      for (const t of data.transactions)
        if (t.recurring_item_id === old.id) {
          t.recurring_item_id = null;
          t.recurring_period_start = null;
        }
    if (table === "accounts")
      for (const r of data.recurring_items)
        if (r.account_id === old.id) r.account_id = null;
    return data;
  }
  if (body.action !== "save")
    throw new Error("Bu işlem yerel sürümde desteklenmiyor.");
  const record = validateRecord(table, body.record || {}) as Row;
  const old = body.id ? find(table, body.id) : null;
  if (record.account_id) exists("accounts", record.account_id);
  if (record.bucket_id) exists("buckets", record.bucket_id);
  if (record.income_source_id)
    exists("income_sources", record.income_source_id);
  if (record.goal_id) exists("goals", record.goal_id);
  if (
    table === "buckets" &&
    record.kind === "fixed" &&
    list.some((r) => r.kind === "fixed" && r.id !== old?.id)
  )
    throw new Error("Otomatik fatura kovası yalnızca bir tane olabilir.");
  if (
    table === "installment_plans" &&
    find("accounts", record.account_id).account_type !== "credit_card"
  )
    throw new Error("Taksit için kredi kartı seç.");
  if (
    table === "recurring_items" &&
    old &&
    old.period !== record.period &&
    data.transactions.some((t) => t.recurring_item_id === old.id)
  )
    throw new Error("Ödeme geçmişi olan giderin periyodu değiştirilemez.");
  if (table === "transactions") {
    if (
      old &&
      (old.occurred_on !== record.occurred_on ||
        Number(old.amount) !== record.amount ||
        old.direction !== record.direction)
    ) {
      record.recurring_item_id = null;
      record.recurring_period_start = null;
    }
    if (record.recurring_item_id) {
      const item = find("recurring_items", record.recurring_item_id);
      const key =
        record.recurring_period_start ||
        recurringPeriodStart(item as any, record.occurred_on);
      if (
        data.transactions.some(
          (t) =>
            t.id !== old?.id &&
            t.recurring_item_id === item.id &&
            (t.recurring_period_start ||
              recurringPeriodStart(item as any, t.occurred_on)) === key,
        )
      )
        throw new Error("Bu dönemki ödeme zaten kaydedilmiş.");
      const due = recurringDueDate(item as any, key);
      if (!recurringDates(item as any, due.slice(0, 7)).includes(due))
        throw new Error("Ödeme dönemi geçersiz.");
      record.recurring_period_start = key;
    }
    if (
      !old &&
      record.direction === "expense" &&
      !record.bucket_id &&
      data.preferences?.auto_classify
    ) {
      const suggestion = classificationSuggestion(data, record.merchant);
      if (suggestion) {
        record.bucket_id = suggestion.bucket_id;
        record.classification_source = "suggestion";
      }
    }
  }
  const next = {
    ...(old || {}),
    ...record,
    id: old?.id || crypto.randomUUID(),
    ...(table === "transactions" && !old
      ? {
          method: "manual",
          created_at: new Date().toISOString(),
          installment_plan_id: null,
          classification_source: record.classification_source || null,
        }
      : {}),
  };
  if (old) list[list.indexOf(old)] = next;
  else list.push(next);
  return data;
}
