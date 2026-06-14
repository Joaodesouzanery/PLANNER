export type FinanceEntityType = "cpf" | "cnpj";
export type FinanceAccountType = "checking" | "savings" | "cash" | "investment" | "credit_card";
export type FinanceStatus = "planned" | "confirmed" | "reconciled";

export interface FinanceEntity {
  id: string;
  user_id: string | null;
  company_id: string | null;
  entity_type: FinanceEntityType;
  name: string;
  color: string | null;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FinanceAccount {
  id: string;
  user_id: string | null;
  company_id: string | null;
  entity_id: string;
  name: string;
  account_type: FinanceAccountType;
  opening_balance: number;
  opening_balance_date: string;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FinanceTransfer {
  id: string;
  user_id: string | null;
  company_id: string | null;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  description: string | null;
  status: FinanceStatus;
  created_at: string;
  updated_at?: string;
}

export interface FinanceCardInvoice {
  id: string;
  user_id: string | null;
  company_id: string | null;
  card_account_id: string;
  period_start: string;
  period_end: string;
  closing_date: string;
  due_date: string;
  amount: number;
  status: "open" | "closed" | "paid";
  paid_at: string | null;
  payment_transfer_id: string | null;
  created_at: string;
  updated_at?: string;
}

export type ForecastEventKind = "income" | "expense" | "transfer_in" | "transfer_out";
export type ForecastScenario = "base" | "conservative" | "expected" | "optimistic";

export interface ForecastEvent {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: ForecastEventKind;
  accountId: string | null;
  entityId: string | null;
  category?: string | null;
  sourceType: "transaction" | "plan" | "project" | "transfer" | "invoice" | "installment";
  sourceId?: string | null;
  status: FinanceStatus | "skipped";
  isScenario?: boolean;
  confidence?: "high" | "medium" | "low" | null;
}

export interface ForecastDay {
  date: string;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
  conservative: number;
  expected: number;
  optimistic: number;
  events: ForecastEvent[];
}

export interface ForecastSeries {
  startDate: string;
  endDate: string;
  openingBalance: number;
  days: ForecastDay[];
  minimumBalance: number;
  minimumBalanceDate: string;
  firstNegativeDate: string | null;
}

export interface UpcomingPayable {
  id: string;
  description: string;
  dueDate: string;
  amount: number;
  daysUntilDue: number;
  status: "overdue" | "today" | "soon" | "future";
  accountId: string | null;
  sourceType: ForecastEvent["sourceType"];
}
