import type { Plan } from "./telegram-dialogue";
import type { Transaction } from "./types";
import { merchantFamily } from "./insights";
import { recentTransactions } from "./overview";
import { normalizeMerchant } from "./finance";
export function editCandidates(
  rows: Transaction[],
  plan: Plan,
  activeId?: string | null,
) {
  const active = rows.filter((t) => !t.deleted_at);
  if (plan.target_id) return active.filter((t) => t.id === plan.target_id);
  if (plan.target_merchant || plan.target_amount || plan.target_date)
    return active
      .filter(
        (t) =>
          (!plan.target_merchant ||
            normalizeMerchant(t.merchant).includes(
              normalizeMerchant(plan.target_merchant),
            ) ||
            merchantFamily(t.merchant) ===
              merchantFamily(plan.target_merchant)) &&
          (!plan.target_amount ||
            Math.abs(Number(t.amount) - plan.target_amount) < 0.005) &&
          (!plan.target_date || t.occurred_on === plan.target_date),
      )
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  if (activeId) return active.filter((t) => t.id === activeId);
  if (plan.target_last) return recentTransactions(active, 1);
  return [];
}
