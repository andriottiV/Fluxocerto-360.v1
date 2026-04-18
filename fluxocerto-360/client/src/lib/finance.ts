import { Transaction, TransactionType } from "@/lib/types";

export type FinanceTotals = {
  income: number;
  expense: number;
  net: number;
};

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
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expense = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return { income, expense, net: income - expense };
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
    const signedAmount = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
    map.set(tx.date, prev + signedAmount);
  });

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
