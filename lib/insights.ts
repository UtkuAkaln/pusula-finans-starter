import type { FinanceData, InstallmentPlan, Transaction } from "./types";
import {
  accountBalance,
  dueDate,
  money,
  normalizeMerchant,
  shiftMonth,
  todayTR,
  weekStart,
} from "./finance";

const cents = (n: number) => Math.round(n * 100) / 100;
export function merchantFamily(name: string) {
  const n = normalizeMerchant(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const brand = n.match(
    /\b(bim|a101|migros|carrefour|sok|netflix|spotify|youtube|icloud|google one|amazon prime|disney|exxen)\b/,
  );
  return brand?.[1] || n;
}
export function classificationSuggestion(data: FinanceData, merchant: string) {
  const family = merchantFamily(merchant);
  const exact = data.merchant_rules.find(
    (r) => normalizeMerchant(r.merchant) === normalizeMerchant(merchant),
  );
  if (exact) return { bucket_id: exact.bucket_id, reason: "Hatırlanan işyeri" };
  const history = data.transactions.filter(
    (t) =>
      !t.deleted_at &&
      t.direction === "expense" &&
      t.bucket_id &&
      !t.classification_source &&
      merchantFamily(t.merchant) === family,
  );
  const counts = new Map<string, number>();
  history.forEach((t) =>
    counts.set(t.bucket_id!, (counts.get(t.bucket_id!) || 0) + 1),
  );
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 3 && best[1] / history.length >= 0.9)
    return { bucket_id: best[0], reason: "Önceki seçimlerin" };
  if (/^(bim|a101|migros|carrefour|sok)$/.test(family)) {
    const bucket = data.buckets.find((b) => b.kind === "living");
    if (bucket) return { bucket_id: bucket.id, reason: "Market alışverişi" };
  }
  return null;
}
export function installmentSchedule(plan: InstallmentPlan) {
  return Array.from({ length: plan.installment_count }, (_, i) => ({
    number: i + 1,
    date: dueDate(
      shiftMonth(plan.first_due_on.slice(0, 7), i),
      Number(plan.first_due_on.slice(8)),
    ),
    amount: cents(
      i === plan.installment_count - 1
        ? Number(plan.total_amount) -
            Number(plan.installment_amount) * (plan.installment_count - 1)
        : Number(plan.installment_amount),
    ),
    recorded: i < plan.recorded_count,
  }));
}
export function cardSummary(data: FinanceData, id: string, today = todayTR()) {
  const account = data.accounts.find((a) => a.id === id)!;
  const balance = accountBalance(data, id, today);
  let statement: string | null = null,
    payment: string | null = null,
    statementDebt: number | null = null;
  if (account.statement_day && account.payment_day) {
    statement = dueDate(today.slice(0, 7), account.statement_day);
    if (statement > today)
      statement = dueDate(
        shiftMonth(today.slice(0, 7), -1),
        account.statement_day,
      );
    payment = dueDate(
      shiftMonth(
        statement.slice(0, 7),
        account.payment_day <= account.statement_day ? 1 : 0,
      ),
      account.payment_day,
    );
    const b = accountBalance(data, id, statement);
    statementDebt = Number.isFinite(b) ? Math.max(0, -b) : null;
  }
  return {
    debt: Number.isFinite(balance) ? Math.max(0, -balance) : null,
    statement,
    payment,
    statementDebt,
  };
}
export function expenseDistribution(
  data: FinanceData,
  month: string,
  group: "bucket" | "merchant" = "bucket",
) {
  const totals = new Map<string, number>();
  data.transactions
    .filter(
      (t) =>
        !t.deleted_at &&
        t.direction === "expense" &&
        t.occurred_on.startsWith(month),
    )
    .forEach((t) => {
      const key = group === "merchant" ? t.merchant : t.bucket_id || "";
      totals.set(key, (totals.get(key) || 0) + Number(t.amount));
    });
  if (group === "merchant") {
    const palette = [
      "#b4d797",
      "#9cbbf9",
      "#c6adf3",
      "#edc88d",
      "#7acbb8",
      "#879786",
    ];
    const entries = [...totals].sort((a, b) => b[1] - a[1]);
    const shown = entries.slice(0, 5);
    if (entries.length > 5)
      shown.push([
        "Diğer işyerleri",
        entries.slice(5).reduce((s, r) => s + r[1], 0),
      ]);
    return shown.map(([name, value], i) => ({
      name,
      value: cents(value),
      color: palette[i],
    }));
  }
  return [...totals]
    .map(([id, value]) => ({
      name: data.buckets.find((b) => b.id === id)?.name || "Sınıflandırılmamış",
      value: cents(value),
      color: data.buckets.find((b) => b.id === id)?.color || "#d9bd83",
    }))
    .sort((a, b) => b.value - a.value);
}
const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function weeklySummary(data: FinanceData, end = todayTR()) {
  const start = addDays(end, -6),
    prevStart = addDays(start, -7),
    prevEnd = addDays(start, -1);
  const rows = data.transactions.filter(
    (t) => !t.deleted_at && t.occurred_on >= start && t.occurred_on <= end,
  );
  const previous = data.transactions.filter(
    (t) =>
      !t.deleted_at && t.occurred_on >= prevStart && t.occurred_on <= prevEnd,
  );
  const total = (list: Transaction[], dir: string) =>
    cents(
      list
        .filter((t) => t.direction === dir)
        .reduce((s, t) => s + Number(t.amount), 0),
    );
  const spending = total(rows, "expense"),
    income = total(rows, "income"),
    previousSpending = total(previous, "expense");
  const byMerchant = new Map<string, number>();
  rows
    .filter((t) => t.direction === "expense")
    .forEach((t) =>
      byMerchant.set(
        t.merchant,
        (byMerchant.get(t.merchant) || 0) + Number(t.amount),
      ),
    );
  const top = [...byMerchant].sort((a, b) => b[1] - a[1])[0];
  const change = previousSpending
    ? Math.round(((spending - previousSpending) / previousSpending) * 100)
    : null;
  return {
    start,
    end,
    spending,
    income,
    previousSpending,
    change,
    count: rows.length,
    top: top ? { name: top[0], amount: cents(top[1]) } : null,
  };
}
export function weeklySummaryText(data: FinanceData, end = todayTR()) {
  const w = weeklySummary(data, end);
  const alerts = subscriptionInsights(data)
    .filter(
      (s) =>
        s.last.occurred_on >= w.start &&
        s.last.occurred_on <= end &&
        (s.increase || s.duplicates),
    )
    .slice(0, 5)
    .map(
      (s) =>
        `${s.name}: ${s.increase ? money(s.increase) + " fiyat artışı" : ""}${s.increase && s.duplicates ? "; " : ""}${s.duplicates ? "aynı ay birden fazla ödeme" : ""}`,
    );
  return `Pusula · Haftalık özet\n${w.start} – ${w.end}\nHarcama: ${money(w.spending)}\nGelir: ${money(w.income)}\n${w.count} işlem${w.change === null ? "\nÖnceki haftada harcama kaydı yok." : `\nÖnceki haftaya göre harcama: ${w.change > 0 ? "+" : ""}%${w.change}.`}${w.top ? `\nEn çok: ${w.top.name} · ${money(w.top.amount)}` : ""}${alerts.length ? "\nAbonelik uyarıları:\n" + alerts.join("\n") : ""}`;
}
export function subscriptionInsights(data: FinanceData) {
  const groups = new Map<string, Transaction[]>();
  data.transactions
    .filter((t) => !t.deleted_at && t.direction === "expense")
    .forEach((t) => {
      const explicit = data.recurring_items.find(
        (r) => r.id === t.recurring_item_id && r.kind === "subscription",
      );
      const key = merchantFamily(explicit?.name || t.merchant);
      groups.set(key, [...(groups.get(key) || []), t]);
    });
  return [...groups].flatMap(([family, rows]) => {
    rows.sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    const item = data.recurring_items.find(
      (r) => r.kind === "subscription" && merchantFamily(r.name) === family,
    );
    const months = new Map<string, Transaction[]>();
    rows.forEach((t) => {
      const m = t.occurred_on.slice(0, 7);
      months.set(m, [...(months.get(m) || []), t]);
    });
    const singles = [...months.values()]
      .filter((r) => r.length === 1)
      .map((r) => r[0]);
    const last = rows.at(-1)!,
      previous =
        item?.period === "weekly"
          ? rows.filter((t) => t.occurred_on < last.occurred_on).at(-1)
          : singles
              .filter(
                (t) => t.occurred_on.slice(0, 7) < last.occurred_on.slice(0, 7),
              )
              .at(-1);
    const known =
      /netflix|spotify|youtube|icloud|google one|amazon prime|disney|exxen/.test(
        family,
      );
    const lastMonths = [...months.keys()].sort().slice(-3);
    const consecutive =
      lastMonths.length >= 2 &&
      lastMonths.slice(1).every((m, i) => shiftMonth(lastMonths[i], 1) === m);
    const stable =
      singles.length >= 3 &&
      singles
        .slice(-3)
        .every(
          (t) =>
            Math.abs(Number(t.amount) - Number(last.amount)) /
              Number(last.amount) <=
            0.1,
        );
    const likely = consecutive && ((known && months.size >= 2) || stable);
    if (!item && !likely) return [];
    const increase =
      previous && Number(last.amount) > Number(previous.amount) * 1.02
        ? cents(Number(last.amount) - Number(previous.amount))
        : 0;
    const duplicates =
      item?.period === "weekly"
        ? rows.filter(
            (t) =>
              (t.recurring_period_start || weekStart(t.occurred_on)) ===
              (last.recurring_period_start || weekStart(last.occurred_on)),
          ).length > 1
        : (months.get(last.occurred_on.slice(0, 7)) || []).length > 1;
    return [
      {
        family,
        name: item?.name || last.merchant,
        item,
        last,
        previous,
        increase,
        duplicates,
        detected: !item,
      },
    ];
  });
}
