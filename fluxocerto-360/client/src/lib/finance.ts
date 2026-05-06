import { PotType, Transaction, TransactionType, type AdjustmentAccount, type Pot } from "@/lib/types";
import {
  getRecurrenceDateForPeriod,
  recurrencePeriodKey,
  type Recurrence,
} from "@/lib/recurrences";

export type FinanceTotals = {
  income: number;
  expense: number;
  fees: number;
  netIncome: number;
  net: number;
  periodBalance: number;
};

export type IncomeProfitBreakdown = {
  grossIncome: number;
  fees: number;
  supplies: number;
  netProfit: number;
};

export type PotAvailability = {
  potId: string;
  potType: PotType;
  potName: string;
  balance: number;
  committed: number;
  availableReal: number;
  deficit: number;
};

export type UpcomingCommitmentSource = "account" | "recurrence";

export type UpcomingCommitment = {
  id: string;
  source: UpcomingCommitmentSource;
  sourceId: string;
  name: string;
  amount: number;
  dueDate: string;
  potType: PotType;
  category?: string;
};

export type RealPotAvailability = {
  potId: string;
  potType: PotType;
  potName: string;
  balance: number;
  committed: number;
  availableReal: number;
  deficit: number;
};

export type PotExpenseValidation = {
  ok: boolean;
  missingAmount: number;
  pot?: Pot;
  suggestedPot?: Pot;
};

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function positiveMoney(value: number) {
  return Math.max(0, roundMoney(value));
}

export function calculateIncomeProfitBreakdown({
  grossIncome,
  fees = 0,
  supplies = 0,
}: {
  grossIncome: number;
  fees?: number;
  supplies?: number;
}): IncomeProfitBreakdown {
  const safeGrossIncome = positiveMoney(grossIncome);
  const safeFees = positiveMoney(fees);
  const safeSupplies = positiveMoney(supplies);

  return {
    grossIncome: safeGrossIncome,
    fees: safeFees,
    supplies: safeSupplies,
    netProfit: roundMoney(safeGrossIncome - safeFees - safeSupplies),
  };
}

function isOpenCommitment(commitment: Pick<AdjustmentAccount, "status">) {
  return commitment.status !== "pago";
}

function commitmentMatchesPot(commitment: Pick<AdjustmentAccount, "pot" | "status">, potType: PotType) {
  if (!isOpenCommitment(commitment)) return false;
  if (potType === PotType.PERSONAL) return commitment.pot === "pf";
  if (potType === PotType.BUSINESS) return commitment.pot === "pj";
  return false;
}

export function getCommittedAmountForPot(
  potType: PotType,
  commitments: Array<Pick<AdjustmentAccount, "amount" | "pot" | "status">>
) {
  return positiveMoney(
    commitments
      .filter((commitment) => commitmentMatchesPot(commitment, potType))
      .reduce((sum, commitment) => sum + positiveMoney(Number(commitment.amount)), 0)
  );
}

export function calculatePotAvailability(
  pots: Pot[],
  commitments: Array<Pick<AdjustmentAccount, "amount" | "pot" | "status">>
): PotAvailability[] {
  return pots.map((pot) => {
    const balance = positiveMoney(Number(pot.balance));
    const committed = getCommittedAmountForPot(pot.type, commitments);
    const rawAvailable = roundMoney(balance - committed);

    return {
      potId: pot.id,
      potType: pot.type,
      potName: pot.name,
      balance,
      committed,
      availableReal: rawAvailable,
      deficit: positiveMoney(-rawAvailable),
    };
  });
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date) {
  const start = startOfLocalDay(a).getTime();
  const end = startOfLocalDay(b).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function accountPotToPotType(pot: AdjustmentAccount["pot"]) {
  return pot === "pj" ? PotType.BUSINESS : PotType.PERSONAL;
}

function isFutureDateInWindow(date: Date, today: Date, daysWindow: number) {
  const diff = daysBetween(today, date);
  return diff >= 0 && diff <= daysWindow;
}

function getUpcomingRecurrenceDate(recurrence: Recurrence, today: Date) {
  const currentPeriodDate = getRecurrenceDateForPeriod(recurrence, today);
  if (daysBetween(today, currentPeriodDate) >= 0) return currentPeriodDate;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return getRecurrenceDateForPeriod(recurrence, nextMonth);
}

export function getUpcomingCommitments({
  accounts = [],
  recurrences = [],
  today = new Date(),
  daysWindow = 10,
}: {
  accounts?: AdjustmentAccount[];
  recurrences?: Recurrence[];
  today?: Date;
  daysWindow?: number;
}): UpcomingCommitment[] {
  const accountCommitments = accounts
    .filter((account) => account.status !== "pago")
    .map((account): UpcomingCommitment | null => {
      const due = parseDateSafe(account.dueDate);
      if (!due || !isFutureDateInWindow(due, today, daysWindow)) return null;
      return {
        id: `account-${account.id}`,
        source: "account",
        sourceId: account.id,
        name: account.name,
        amount: positiveMoney(Number(account.amount)),
        dueDate: toIsoDate(due),
        potType: accountPotToPotType(account.pot),
        category: account.category,
      };
    })
    .filter((item): item is UpcomingCommitment => Boolean(item));

  const recurrenceCommitments = recurrences
    .filter((recurrence) => recurrence.status === "active" && recurrence.type === TransactionType.EXPENSE)
    .map((recurrence): UpcomingCommitment | null => {
      const due = getUpcomingRecurrenceDate(recurrence, today);
      if (!isFutureDateInWindow(due, today, daysWindow)) return null;
      const period = recurrencePeriodKey(due);
      if (recurrence.ignoredPeriods?.includes(period)) return null;
      if (recurrence.lastConfirmedPeriod === period) return null;
      return {
        id: `recurrence-${recurrence.id}-${period}`,
        source: "recurrence",
        sourceId: recurrence.id,
        name: recurrence.name,
        amount: positiveMoney(Number(recurrence.amount)),
        dueDate: toIsoDate(due),
        potType: recurrence.potType,
        category: recurrence.category,
      };
    })
    .filter((item): item is UpcomingCommitment => Boolean(item));

  return [...accountCommitments, ...recurrenceCommitments].sort((a, b) => {
    const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.amount - a.amount;
  });
}

export function calculateCommittedByPot(commitments: UpcomingCommitment[]) {
  return commitments.reduce<Record<PotType, number>>(
    (totals, commitment) => ({
      ...totals,
      [commitment.potType]: roundMoney(totals[commitment.potType] + positiveMoney(commitment.amount)),
    }),
    {
      [PotType.PERSONAL]: 0,
      [PotType.BUSINESS]: 0,
      [PotType.RESERVE]: 0,
    }
  );
}

export function calculateRealAvailableByPot(
  pots: Pot[],
  commitments: UpcomingCommitment[]
): RealPotAvailability[] {
  const committedByPot = calculateCommittedByPot(commitments);

  return pots.map((pot) => {
    const balance = positiveMoney(Number(pot.balance));
    const committed = positiveMoney(committedByPot[pot.type] ?? 0);
    const rawAvailable = roundMoney(balance - committed);
    return {
      potId: pot.id,
      potType: pot.type,
      potName: pot.name,
      balance,
      committed,
      availableReal: positiveMoney(rawAvailable),
      deficit: positiveMoney(-rawAvailable),
    };
  });
}

export function validatePotExpense(
  amount: number,
  potId: string | undefined,
  pots: Pot[]
): PotExpenseValidation {
  const safeAmount = positiveMoney(amount);
  const pot = potId ? pots.find((item) => item.id === potId) : undefined;

  if (!pot || safeAmount <= 0) {
    return { ok: false, missingAmount: safeAmount, pot };
  }

  const balance = positiveMoney(Number(pot.balance));
  if (balance >= safeAmount) {
    return { ok: true, missingAmount: 0, pot };
  }

  const missingAmount = roundMoney(safeAmount - balance);
  const suggestedPot =
    pots
      .filter((item) => item.id !== pot.id && positiveMoney(Number(item.balance)) >= missingAmount)
      .sort((a, b) => positiveMoney(Number(b.balance)) - positiveMoney(Number(a.balance)))[0] ??
    pots
      .filter((item) => item.id !== pot.id && positiveMoney(Number(item.balance)) > 0)
      .sort((a, b) => positiveMoney(Number(b.balance)) - positiveMoney(Number(a.balance)))[0];

  return {
    ok: false,
    missingAmount,
    pot,
    suggestedPot,
  };
}

export function parseDateSafe(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isInCurrentMonth(date: Date, now = new Date()) {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function calculateTotals(transactions: Transaction[]): FinanceTotals {
  const income = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + getTransactionGrossAmount(tx), 0);

  const expense = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const fees = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + getTransactionFeeAmount(tx), 0);

  const netIncome = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + getTransactionNetAmount(tx), 0);

  return { income, expense, fees, netIncome, net: netIncome, periodBalance: netIncome - expense };
}

export function getTransactionGrossAmount(transaction: Transaction) {
  if (transaction.type !== TransactionType.INCOME) return Math.max(0, transaction.amount);
  const gross = Number(transaction.grossAmount ?? transaction.amount);
  return Number.isFinite(gross) ? Math.max(0, gross) : Math.max(0, transaction.amount);
}

export function getTransactionNetAmount(transaction: Transaction) {
  if (transaction.type !== TransactionType.INCOME) return Math.max(0, transaction.amount);
  const net = Number(transaction.netAmount);
  if (Number.isFinite(net)) return Math.max(0, net);

  const gross = getTransactionGrossAmount(transaction);
  return Number(Math.max(0, gross - getTransactionFeeAmount(transaction)).toFixed(2));
}

export function getTransactionFeeAmount(transaction: Transaction) {
  if (transaction.type !== TransactionType.INCOME) return 0;
  const fee = Number(transaction.feeAmount);
  if (Number.isFinite(fee)) return Math.max(0, fee);
  return 0;
}

export function sortTransactionsByDateDesc(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    const dateA = parseDateSafe(a.date)?.getTime() ?? 0;
    const dateB = parseDateSafe(b.date)?.getTime() ?? 0;
    return dateB - dateA;
  });
}

export function buildDailyTotals(transactions: Transaction[]) {
  const map = new Map<string, number>();

  transactions.forEach((tx) => {
    const prev = map.get(tx.date) ?? 0;
    const signedAmount = tx.type === TransactionType.INCOME ? getTransactionNetAmount(tx) : -tx.amount;
    map.set(tx.date, prev + signedAmount);
  });

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
