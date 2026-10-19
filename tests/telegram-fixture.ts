import assert from "node:assert/strict";
import {
  dialogueTurn,
  findNamed,
  directChoice,
  type Plan,
  type DialoguePorts,
  type DialogueState,
  type DialogueAction,
  type TransactionView,
  type Catalog,
} from "../lib/telegram-dialogue";
export const A = "11111111-1111-4111-a111-111111111111",
  B = "22222222-2222-4222-a222-222222222222",
  K = "33333333-3333-4333-a333-333333333333",
  K2 = "44444444-4444-4444-a444-444444444444";
export const plan = (p: Partial<Plan> = {}): Plan => ({
  intent: "transaction",
  amount: 250,
  merchant: "Market",
  occurred_on: null,
  date_explicit: false,
  currency: "TRY",
  direction: "expense",
  account_name: null,
  bucket_name: null,
  question: null,
  query: null,
  ...p,
});
export function fixture(
  plans: Plan[] = [],
  catalog: Catalog = {
    accounts: [{ id: A, name: "Yapı Kredi", bank: "Yapı Kredi" }],
    buckets: [
      { id: K, name: "Zorunlu yaşam" },
      { id: K2, name: "Esnek" },
    ],
  },
) {
  let state: DialogueState = {};
  const actions = new Map<string, DialogueAction>(),
    rows = new Map<string, TransactionView>();
  let queries = 0,
    commits = 0,
    assigns = 0;
  const ports: DialoguePorts = {
    catalog: async () => structuredClone(catalog),
    state: async () => structuredClone(state),
    saveState: async (s) => {
      state = structuredClone(s);
    },
    actionId: (n) => `bbbbbbbb-bbbb-4bbb-abbb-${String(n).padStart(12, "0")}`,
    action: async (id) => structuredClone(actions.get(id) || null),
    saveAction: async (a) => {
      actions.set(a.id, structuredClone(a));
      return structuredClone(a);
    },
    transaction: async (id) => structuredClone(rows.get(id) || null),
    commit: async (a, account, bucket) => {
      commits++;
      let row = rows.get(a.id);
      const duplicate = Boolean(row);
      if (!row) {
        row = {
          id: a.id,
          ...a.payload.receipt,
          amount: a.payload.receipt.amount!,
          merchant: a.payload.receipt.merchant!,
          occurred_on: a.payload.receipt.occurred_on!,
          direction: a.payload.direction || "expense",
          account_id: account,
          bucket_id: a.payload.direction === "income" ? null : bucket,
        };
        rows.set(row.id, row);
      }
      a.transaction_id = row.id;
      actions.set(a.id, structuredClone(a));
      return { transaction: structuredClone(row), duplicate };
    },
    assign: async (a, bucket) => {
      assigns++;
      const row = rows.get(a.transaction_id!);
      if (!row || row.bucket_id) return false;
      row.bucket_id = bucket;
      return true;
    },
    plan: async () => {
      const next = plans.shift();
      assert.ok(next, "Beklenmeyen model çağrısı");
      return next;
    },
    query: async () => {
      queries++;
      return "Bu ayın sorgu sonucu.";
    },
  };
  return {
    ports,
    rows,
    actions,
    catalog,
    get state() {
      return state;
    },
    get queries() {
      return queries;
    },
    get commits() {
      return commits;
    },
    get assigns() {
      return assigns;
    },
    turn: (n: number, text: string) => dialogueTurn(1, n, text, ports),
  };
}
