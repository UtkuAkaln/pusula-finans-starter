export type Bucket = {
  id: string;
  name: string;
  ratio: number;
  sort_order: number;
  kind: string;
  color: string;
  is_demo?: boolean;
};
export type Account = {
  id: string;
  name: string;
  bank: string;
  account_type?: "bank" | "cash" | "credit_card";
  statement_day?: number | null;
  payment_day?: number | null;
  opening_balance: number;
  balance_date: string;
  color: string;
  is_demo?: boolean;
};
export type IncomeSource = {
  id: string;
  name: string;
  type: string;
  expected_amount: number | null;
  period: "monthly" | "weekly" | "once";
  expected_day: number | null;
  expected_date: string | null;
  note: string;
  active: boolean;
  is_demo?: boolean;
};
export type Recurring = {
  period?: "monthly" | "weekly";
  kind?: "bill" | "subscription";
  id: string;
  name: string;
  amount: number;
  day: number;
  start_date: string;
  end_date: string | null;
  bucket_id: string | null;
  account_id: string | null;
  is_demo?: boolean;
};
export type Goal = {
  id: string;
  name: string;
  amount: number;
  target_date: string | null;
  icon: string;
  is_demo?: boolean;
};
export type SavingsAsset =
  | "TRY"
  | "USD"
  | "EUR"
  | "GBP"
  | "XAU"
  | "XAG"
  | "GOLD_QUARTER"
  | "GOLD_HALF"
  | "GOLD_FULL"
  | "GOLD_REPUBLIC";
export type Holding = {
  id: string;
  name: string;
  asset: SavingsAsset;
  quantity: number;
  cost_basis: number | null;
  goal_id: string | null;
  note: string;
};
export type Transaction = {
  recurring_period_start?: string | null;
  deleted_at?: string | null;
  installment_plan_id?: string | null;
  classification_source?: string | null;
  id: string;
  created_at?: string;
  occurred_on: string;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  merchant: string;
  bucket_id: string | null;
  account_id: string | null;
  note: string;
  method: string;
  recurring_item_id: string | null;
  income_source_id: string | null;
  is_demo?: boolean;
};
export type Notification = {
  id: string;
  raw_text: string;
  status: string;
  error: string | null;
  created_at: string;
  is_demo?: boolean;
};
export type MerchantRule = {
  id: string;
  merchant: string;
  bucket_id: string;
  is_demo?: boolean;
};
export type FinanceData = {
  holdings?: Holding[];
  installment_plans?: InstallmentPlan[];
  preferences?: { auto_classify: boolean; weekly_digest: boolean };
  telegram?: {
    configured: boolean;
    linked: boolean;
    botUsername: string;
    model: string;
    setupUrl: string | null;
  };
  gmail?: {
    verified: boolean;
    email: string;
    lastVerifiedAt: string | null;
    scriptUrl: string | null;
    senders: string[];
  };
  accounts: Account[];
  buckets: Bucket[];
  income_sources: IncomeSource[];
  recurring_items: Recurring[];
  goals: Goal[];
  transactions: Transaction[];
  raw_notifications: Notification[];
  merchant_rules: MerchantRule[];
};
export type InstallmentPlan = {
  id: string;
  name: string;
  account_id: string;
  bucket_id: string | null;
  total_amount: number;
  installment_amount: number;
  installment_count: number;
  recorded_count: number;
  first_due_on: string;
};
export const EMPTY_DATA: FinanceData = {
  holdings: [],
  accounts: [],
  buckets: [],
  income_sources: [],
  recurring_items: [],
  goals: [],
  transactions: [],
  raw_notifications: [],
  merchant_rules: [],
};
