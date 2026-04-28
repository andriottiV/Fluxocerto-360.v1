import { OnboardingFixedExpenseInput, Transaction, TransactionType } from "@/lib/types";
import { getTransactionNetAmount } from "@/lib/finance";
import { formatCurrency as formatCurrencyBRL } from "@/lib/utils";

type ForecastExpenseLike = {
  amount: number;
  dueDate?: string;
  status?: string;
};

export type ForecastPoint = {
  day: number;
  date: string;
  balance: number;
  conservativeBalance: number;
  bestBalance: number;
};

export type CashflowForecastResult = {
  periodDays: number;
  currentBalance: number;
  projectedBalance: number;
  bestCaseBalance: number;
  conservativeBalance: number;
  riskDay: number | null;
  riskDate: string | null;
  estimatedDailyIncome: number;
  estimatedDailyExpense: number;
  fixedCommitmentMonthly: number;
  points: ForecastPoint[];
  dataSufficient: boolean;
};

export type CashRiskLevel = "critical" | "moderate" | "positive" | "empty";

export type MonthlyComparisonRow = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

export type MonthlyComparisonResult = {
  rows: MonthlyComparisonRow[];
  incomeVariationPct: number | null;
  expenseVariationPct: number | null;
  netVariationPct: number | null;
};

type ForecastInput = {
  transactions: Transaction[];
  currentBalance: number;
  periodDays: number;
  fixedExpenses?: OnboardingFixedExpenseInput[];
  recurringExpenses?: ForecastExpenseLike[];
  pendingBills?: ForecastExpenseLike[];
};

function clampMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthLabel(key: string) {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function normalizeComparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveEstimatedDailyIncome(transactions: Transaction[]) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 90);

  const usable = transactions.filter((tx) => {
    if (tx.type !== TransactionType.INCOME) return false;
    const parsed = parseIsoDate(tx.date);
    return !!parsed && parsed >= from;
  });

  if (usable.length === 0) return 0;
  const total = usable.reduce((sum, tx) => sum + getTransactionNetAmount(tx), 0);
  return clampMoney(total / 90);
}

function resolveEstimatedDailyExpense(transactions: Transaction[]) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 90);

  const usable = transactions.filter((tx) => {
    if (tx.type !== TransactionType.EXPENSE) return false;
    const parsed = parseIsoDate(tx.date);
    return !!parsed && parsed >= from;
  });

  if (usable.length === 0) return 0;
  const total = usable.reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
  return clampMoney(total / 90);
}

function resolveMonthlyCommitment(
  fixedExpenses: OnboardingFixedExpenseInput[] = [],
  recurringExpenses: ForecastExpenseLike[] = []
) {
  const fixed = fixedExpenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const recurring = recurringExpenses
    .filter((item) => normalizeComparableName(item.status ?? "pendente") !== "pago")
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  return clampMoney(fixed + recurring);
}

function buildPendingBillMap(periodDays: number, pendingBills: ForecastExpenseLike[] = []) {
  const map = new Map<number, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  pendingBills
    .filter((item) => normalizeComparableName(item.status ?? "pendente") !== "pago")
    .forEach((bill) => {
      const amount = Math.max(0, Number(bill.amount) || 0);
      if (amount <= 0) return;
      const date = parseIsoDate(bill.dueDate);
      if (!date) return;
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
      if (diffDays < 1 || diffDays > periodDays) return;
      map.set(diffDays, (map.get(diffDays) ?? 0) + amount);
    });

  return map;
}

export function calculateCashflowForecast(input: ForecastInput): CashflowForecastResult {
  const periodDays = Math.max(1, Math.min(365, Math.round(input.periodDays)));
  const currentBalance = clampMoney(input.currentBalance);
  const estimatedDailyIncome = resolveEstimatedDailyIncome(input.transactions);
  const estimatedDailyExpense = resolveEstimatedDailyExpense(input.transactions);
  const fixedCommitmentMonthly = resolveMonthlyCommitment(input.fixedExpenses, input.recurringExpenses);
  const pendingMap = buildPendingBillMap(periodDays, input.pendingBills);
  const dailyCommitment = fixedCommitmentMonthly / 30;

  let projectedBalance = currentBalance;
  let bestCaseBalance = currentBalance;
  let conservativeBalance = currentBalance;
  let riskDay: number | null = null;
  let riskDate: string | null = null;

  const points: ForecastPoint[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let day = 1; day <= periodDays; day += 1) {
    const pendingAmount = pendingMap.get(day) ?? 0;
    const netBase = estimatedDailyIncome - estimatedDailyExpense - dailyCommitment;
    projectedBalance = clampMoney(projectedBalance + netBase - pendingAmount);

    const bestNet = estimatedDailyIncome * 1.15 - estimatedDailyExpense * 0.9 - dailyCommitment * 0.9;
    bestCaseBalance = clampMoney(bestCaseBalance + bestNet - pendingAmount);

    const conservativeNet = estimatedDailyIncome * 0.8 - estimatedDailyExpense * 1.15 - dailyCommitment * 1.15;
    conservativeBalance = clampMoney(conservativeBalance + conservativeNet - pendingAmount);

    if (riskDay === null && projectedBalance < 0) {
      riskDay = day;
      const risk = new Date(start);
      risk.setDate(start.getDate() + day);
      riskDate = toIsoDate(risk);
    }

    const pointDate = new Date(start);
    pointDate.setDate(start.getDate() + day);
    points.push({
      day,
      date: toIsoDate(pointDate),
      balance: projectedBalance,
      bestBalance: bestCaseBalance,
      conservativeBalance,
    });
  }

  const hasHistory = input.transactions.length >= 3;
  const hasDriverData = estimatedDailyIncome > 0 || estimatedDailyExpense > 0 || fixedCommitmentMonthly > 0;
  const dataSufficient = hasHistory || hasDriverData;

  return {
    periodDays,
    currentBalance,
    projectedBalance,
    bestCaseBalance,
    conservativeBalance,
    riskDay,
    riskDate,
    estimatedDailyIncome,
    estimatedDailyExpense,
    fixedCommitmentMonthly,
    points,
    dataSufficient,
  };
}

export function getCashRiskLevel(result: CashflowForecastResult): CashRiskLevel {
  if (!result.dataSufficient) return "empty";
  if (result.riskDay !== null && result.riskDay <= 30) return "critical";
  if (result.riskDay !== null && result.riskDay <= 60) return "moderate";
  return "positive";
}

export function getMonthlyComparison(transactions: Transaction[], maxMonths = 6): MonthlyComparisonResult {
  const grouped = new Map<string, { income: number; netIncome: number; expense: number }>();

  transactions.forEach((tx) => {
    const date = parseIsoDate(tx.date);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = grouped.get(key) ?? { income: 0, netIncome: 0, expense: 0 };
    if (tx.type === TransactionType.INCOME) current.income += Math.max(0, tx.amount);
    if (tx.type === TransactionType.INCOME) current.netIncome += getTransactionNetAmount(tx);
    if (tx.type === TransactionType.EXPENSE) current.expense += Math.max(0, tx.amount);
    grouped.set(key, current);
  });

  const rows = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-Math.max(1, maxMonths))
    .map(([monthKey, value]) => ({
      monthKey,
      label: monthLabel(monthKey),
      income: clampMoney(value.income),
      expense: clampMoney(value.expense),
      net: clampMoney(value.netIncome),
    }));

  const current = rows[rows.length - 1];
  const previous = rows[rows.length - 2];

  const calcVariation = (a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (b === 0) return a === 0 ? 0 : 100;
    return ((a - b) / Math.abs(b)) * 100;
  };

  return {
    rows,
    incomeVariationPct: current && previous ? calcVariation(current.income, previous.income) : null,
    expenseVariationPct: current && previous ? calcVariation(current.expense, previous.expense) : null,
    netVariationPct: current && previous ? calcVariation(current.net, previous.net) : null,
  };
}

export function formatCurrency(value: number) {
  return formatCurrencyBRL(Number.isFinite(value) ? value : 0);
}

export function formatPercentage(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "-";
  const safe = Number(value.toFixed(digits));
  const sign = safe > 0 ? "+" : "";
  return `${sign}${safe.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}
