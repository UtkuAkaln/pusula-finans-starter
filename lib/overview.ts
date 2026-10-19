import type { FinanceData, Transaction } from "./types";
import { accountBalance, monthly, sum, todayTR } from "./finance";
function occurrenceTime(t: Transaction) {
  const time =
    t.note?.match(/\bSaat:\s*((?:[01]\d|2[0-3]):[0-5]\d)/i)?.[1] || "00:00";
  return Date.parse(`${t.occurred_on}T${time}:00+03:00`) || 0;
}
export function recentTransactions(transactions: Transaction[], limit = 2) {
  return [...transactions]
    .sort((a, b) => {
      const aCreated = Date.parse(a.created_at || ""),
        bCreated = Date.parse(b.created_at || "");
      const primary =
        (Number.isFinite(bCreated) ? bCreated : occurrenceTime(b)) -
        (Number.isFinite(aCreated) ? aCreated : occurrenceTime(a));
      return (
        primary ||
        occurrenceTime(b) - occurrenceTime(a) ||
        b.id.localeCompare(a.id)
      );
    })
    .slice(0, limit);
}
export function overviewSummary(
  data: FinanceData,
  month: string,
  date = todayTR(),
) {
  const cashAccounts = data.accounts.filter(
    (a) => a.account_type !== "credit_card",
  );
  const cash = cashAccounts.reduce((total, a) => {
    const balance = accountBalance(data, a.id, date);
    return total + (Number.isFinite(balance) ? Math.max(0, balance) : 0);
  }, 0);
  const spending = sum(monthly(data, month), "expense");
  return {
    cash,
    spending,
    assets: cash - spending,
    cashAccountCount: cashAccounts.length,
    recent: recentTransactions(data.transactions),
  };
}
