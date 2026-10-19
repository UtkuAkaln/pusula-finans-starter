import type {
  FinanceData,
  Transaction,
  Recurring,
  IncomeSource,
} from "./types";
export const money = (value: number, compact = false) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(value);
export const todayTR = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthKey = (date = todayTR()) => date.slice(0, 7);
export function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}
export const monthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat("tr-TR", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
export function dueDate(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
export const sum = (rows: Transaction[], direction?: string) =>
  rows
    .filter((t) => !direction || t.direction === direction)
    .reduce((s, t) => s + Number(t.amount), 0);
export const monthly = (data: FinanceData, month: string) =>
  data.transactions.filter((t) => t.occurred_on.startsWith(month));
export const weekdays = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
export function weekStart(date: string) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function weeklyDates(
  month: string,
  weekday: number,
  start: string,
  end?: string | null,
) {
  const dates: string[] = [];
  const d = new Date(month + "-01T00:00:00Z");
  d.setUTCDate(1 + ((weekday - 1 - ((d.getUTCDay() + 6) % 7) + 7) % 7));
  while (d.toISOString().startsWith(month)) {
    const date = d.toISOString().slice(0, 10);
    if (date >= start && (!end || date <= end)) dates.push(date);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}
export function recurringDates(item: Recurring, month: string) {
  if (item.period === "weekly")
    return weeklyDates(month, item.day, item.start_date, item.end_date);
  const due = dueDate(month, item.day);
  return item.start_date <= due && (!item.end_date || item.end_date >= due)
    ? [due]
    : [];
}
export function recurringPeriodStart(item: Recurring, date: string) {
  return item.period === "weekly" ? weekStart(date) : date.slice(0, 7) + "-01";
}
export function recurringDueDate(item: Recurring, date: string) {
  if (item.period !== "weekly") return dueDate(date.slice(0, 7), item.day);
  const d = new Date(weekStart(date) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + item.day - 1);
  return d.toISOString().slice(0, 10);
}
export function recurringPayment(
  data: FinanceData,
  item: Recurring,
  due: string,
) {
  const period = recurringPeriodStart(item, due);
  return data.transactions.find(
    (t) =>
      !t.deleted_at &&
      t.direction === "expense" &&
      t.recurring_item_id === item.id &&
      (t.recurring_period_start ||
        recurringPeriodStart(item, t.occurred_on)) === period,
  );
}
export function recurringOccurrences(data: FinanceData, month: string) {
  return data.recurring_items.flatMap((item) =>
    recurringDates(item, month).map((due) => ({
      item,
      due,
      matched: recurringPayment(data, item, due),
    })),
  );
}
export function incomeDates(source: IncomeSource, month: string) {
  if (!source.active) return [];
  if (source.period === "weekly")
    return weeklyDates(
      month,
      source.expected_day || 1,
      source.expected_date || month + "-01",
    );
  if (source.period === "once")
    return source.expected_date?.startsWith(month)
      ? [source.expected_date]
      : [];
  return [dueDate(month, source.expected_day || 1)];
}
export function activeRecurring(item: Recurring, month: string) {
  return recurringDates(item, month).length > 0;
}
export function accountBalance(
  data: FinanceData,
  id: string,
  date = todayTR(),
) {
  const a = data.accounts.find((a) => a.id === id);
  if (!a) return 0;
  if (date < a.balance_date) return NaN;
  return (
    Number(a.opening_balance) +
    data.transactions
      .filter(
        (t) =>
          t.account_id === id &&
          t.occurred_on > a.balance_date &&
          t.occurred_on <= date,
      )
      .reduce(
        (s, t) => s + (t.direction === "income" ? 1 : -1) * Number(t.amount),
        0,
      )
  );
}
export function expectedSource(source: IncomeSource, month: string) {
  return (
    incomeDates(source, month).length * Number(source.expected_amount || 0)
  );
}
export function budgets(data: FinanceData, month: string) {
  const fixed = data.recurring_items.reduce(
    (s, r) => s + recurringDates(r, month).length * Number(r.amount),
    0,
  );
  const expected = data.income_sources.reduce(
    (s, i) => s + expectedSource(i, month),
    0,
  );
  const actual = sum(monthly(data, month), "income");
  const fixedRatio = data.buckets.find((b) => b.kind === "fixed")?.ratio || 25;
  const base = Math.max(
    expected,
    actual,
    expected || actual ? 0 : fixed / (fixedRatio / 100),
  );
  return data.buckets.map((b) => {
    const budget = b.kind === "fixed" ? fixed : (base * Number(b.ratio)) / 100;
    const spent = sum(
      monthly(data, month).filter((t) => t.bucket_id === b.id),
      "expense",
    );
    return {
      ...b,
      budget,
      spent,
      remaining: budget - spent,
      percent: budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0,
    };
  });
}
export function trend(data: FinanceData, month: string, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(month, i - count + 1);
    const tx = monthly(data, key);
    return {
      month: key,
      name: monthLabel(key, true),
      income: sum(tx, "income"),
      expense: sum(tx, "expense"),
      ...Object.fromEntries(
        budgets(data, key).map((b) => [b.id, Math.round(b.percent)]),
      ),
    };
  });
}
export function savingPace(data: FinanceData, month: string) {
  const history = trend(data, shiftMonth(month, -1), 3);
  const observed = history.filter((h) => monthly(data, h.month).length > 0);
  return observed.length
    ? Math.max(
        0,
        observed.reduce((s, h) => s + h.income - h.expense, 0) /
          observed.length,
      )
    : 0;
}
export function goalEnvelopes(data: FinanceData, month: string) {
  const date = todayTR();
  const total = data.accounts.reduce(
    (s, a) => s + accountBalance(data, a.id),
    0,
  );
  const reserve = budgets(data, month).reduce(
    (s, b) => s + (b.kind === "savings" ? 0 : Math.max(0, b.remaining)),
    0,
  );
  let available = Math.max(0, total - reserve);
  let queuedRemaining = 0;
  const pace = savingPace(data, month);
  return [...data.goals]
    .sort((a, b) =>
      (a.target_date || "9999").localeCompare(b.target_date || "9999"),
    )
    .map((g) => {
      const allocated = Math.min(available, Number(g.amount));
      available -= allocated;
      const remaining = Number(g.amount) - allocated;
      queuedRemaining += remaining;
      const months = g.target_date
        ? Math.max(
            1,
            (new Date(g.target_date).getTime() - new Date(date).getTime()) /
              (30.4375 * 86400000),
          )
        : null;
      return {
        ...g,
        allocated,
        remaining,
        monthlyNeeded: months ? remaining / months : null,
        eta:
          remaining === 0
            ? 0
            : pace > 0
              ? Math.ceil(queuedRemaining / pace)
              : null,
      };
    });
}
export function expectedPayments(data: FinanceData, month: string) {
  return data.income_sources
    .filter((s) => s.active && Number(s.expected_amount) > 0)
    .flatMap((s) => {
      const received = sum(
        (s.period === "once"
          ? data.transactions.filter((t) => t.occurred_on <= month + "-31")
          : monthly(data, month)
        ).filter(
          (t) =>
            t.income_source_id === s.id &&
            !t.deleted_at &&
            (s.period !== "weekly" ||
              !s.expected_date ||
              t.occurred_on >= s.expected_date),
        ),
        "income",
      );
      const dates =
        s.period === "once" &&
        s.expected_date &&
        s.expected_date <= month + "-31"
          ? [s.expected_date]
          : incomeDates(s, month);
      return dates.map((date, index) => {
        const allocated = Math.min(
          Number(s.expected_amount),
          Math.max(0, received - index * Number(s.expected_amount)),
        );
        const remaining = Math.max(0, Number(s.expected_amount) - allocated);
        return {
          ...s,
          received: allocated,
          remaining,
          due: date,
          overdue: date < todayTR() && remaining > 0,
        };
      });
    })
    .filter((s) => s.remaining > 0);
}
export function projection(data: FinanceData, startMonth: string) {
  const now = todayTR(),
    current = monthKey(now);
  let balance = data.accounts.reduce(
    (s, a) => s + accountBalance(data, a.id, now),
    0,
  );
  // Reconstruct the opening of a past selected month only where every snapshot supports it.
  if (startMonth < current) {
    const before = new Date(startMonth + "-01T00:00:00Z");
    before.setUTCDate(0);
    const day = before.toISOString().slice(0, 10);
    if (data.accounts.some((a) => a.balance_date > day)) return [];
    balance = data.accounts.reduce(
      (s, a) => s + accountBalance(data, a.id, day),
      0,
    );
  }
  const first = startMonth > current ? current : startMonth;
  const steps =
    (Number(startMonth.slice(0, 4)) - Number(first.slice(0, 4))) * 12 +
    Number(startMonth.slice(5)) -
    Number(first.slice(5)) +
    6;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const m = shiftMonth(first, i),
      tx = monthly(data, m),
      income = sum(tx, "income"),
      expense = sum(tx, "expense");
    const bs = budgets(data, m);
    const unassigned = sum(
      tx.filter((t) => !t.bucket_id),
      "expense",
    );
    const planned =
      bs.reduce(
        (s, b) =>
          s + (b.kind === "savings" ? b.spent : Math.max(b.budget, b.spent)),
        0,
      ) + unassigned;
    const futureIncome = data.income_sources.reduce(
      (s, v) => s + expectedSource(v, m),
      0,
    );
    if (m < current) balance += income - expense;
    else if (m === current)
      balance +=
        expectedPayments(data, m).reduce((s, p) => s + p.remaining, 0) -
        Math.max(0, planned - expense);
    else balance += futureIncome - planned;
    if (m >= startMonth)
      points.push({
        month: m,
        name: monthLabel(m, true),
        balance: Math.round(balance),
        income: m < current ? income : Math.max(income, futureIncome),
        expense: m < current ? expense : planned,
      });
  }
  return points;
}
export function recurringSuggestions(
  data: FinanceData,
  t: Transaction,
  due?: string,
) {
  return data.recurring_items.filter(
    (r) =>
      recurringDates(
        r,
        (due || recurringDueDate(r, t.occurred_on)).slice(0, 7),
      ).some(
        (date) =>
          (!due || date === due) &&
          recurringPeriodStart(r, date) ===
            recurringPeriodStart(r, t.occurred_on) &&
          !recurringPayment(data, r, date),
      ) &&
      (Math.abs(Number(r.amount) - Number(t.amount)) < 0.01 ||
        t.merchant
          .toLocaleLowerCase("tr")
          .includes(r.name.toLocaleLowerCase("tr"))),
  );
}
export const normalizeMerchant = (s: string) =>
  s.trim().toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\s+/g, " ");
