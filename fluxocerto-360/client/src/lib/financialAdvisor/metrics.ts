import { parseDateSafe } from "@/lib/finance";
import { PotType, TransactionType, type Pot, type Transaction } from "@/lib/types";

import type {
  BusinessSummary,
  FinancialArea,
  FinancialInsight,
  FinancialRiskProfile,
  FinancialSummary,
  InvestmentReadiness,
  PersonalSummary,
  ReserveSummary,
} from "./types";

const FIXED_CATEGORY_HINTS = [
  "aluguel",
  "internet",
  "assinatura",
  "energia",
  "agua",
  "telefone",
  "salario",
  "plano",
  "fornecedor",
  "parcela",
];

const WEEKDAYS_PT = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export type TransactionsByArea = Record<FinancialArea, Transaction[]>;

export function normalizeTransactionArea(transaction: Transaction): FinancialArea {
  if (transaction.pot === PotType.BUSINESS || transaction.accountTypeLink === "pj") {
    return PotType.BUSINESS;
  }
  if (transaction.pot === PotType.RESERVE) {
    return PotType.RESERVE;
  }
  return PotType.PERSONAL;
}

export function splitTransactionsByArea(transactions: Transaction[]): TransactionsByArea {
  return transactions.reduce<TransactionsByArea>(
    (acc, transaction) => {
      const area = normalizeTransactionArea(transaction);
      acc[area].push(transaction);
      return acc;
    },
    { [PotType.PERSONAL]: [], [PotType.BUSINESS]: [], [PotType.RESERVE]: [] }
  );
}

export function calculateTotalIncome(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === TransactionType.INCOME)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateTotalExpense(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === TransactionType.EXPENSE)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateNetProfit(transactions: Transaction[]) {
  return calculateTotalIncome(transactions) - calculateTotalExpense(transactions);
}

function isFixedCategory(category: string) {
  const normalized = category.toLowerCase();
  return FIXED_CATEGORY_HINTS.some((hint) => normalized.includes(hint));
}

export function calculateFixedExpenses(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === TransactionType.EXPENSE && isFixedCategory(transaction.category))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateVariableExpenses(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === TransactionType.EXPENSE && !isFixedCategory(transaction.category))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateCurrentBalance(transactions: Transaction[], pots: Pot[] = []) {
  const potsBalance = pots.reduce((sum, pot) => sum + pot.balance, 0);
  if (potsBalance > 0) return potsBalance;
  return calculateNetProfit(transactions);
}

export function calculateProjectedBalance({
  transactions,
  currentBalance,
  projectionDays = 30,
  now = new Date(),
}: {
  transactions: Transaction[];
  currentBalance: number;
  projectionDays?: number;
  now?: Date;
}) {
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const recent = transactions.filter((transaction) => {
    const parsed = parseDateSafe(transaction.date);
    return parsed ? parsed.getTime() >= start.getTime() : false;
  });

  const dailyNet = recent.length > 0 ? calculateNetProfit(recent) / 30 : 0;
  return currentBalance + dailyNet * projectionDays;
}

export function calculateIncomeFrequency(transactions: Transaction[]) {
  const incomes = transactions.filter((transaction) => transaction.type === TransactionType.INCOME);
  if (incomes.length === 0) return 0;

  const days = new Set(
    incomes
      .map((transaction) => parseDateSafe(transaction.date))
      .filter((value): value is Date => value !== null)
      .map((date) => date.toISOString().slice(0, 10))
  );

  return Number((incomes.length / Math.max(1, days.size)).toFixed(2));
}

export function calculateStrongestDays(transactions: Transaction[], count = 2) {
  const totals = new Map<number, number>();

  transactions.forEach((transaction) => {
    const parsed = parseDateSafe(transaction.date);
    if (!parsed) return;
    const weekday = parsed.getDay();
    const signedAmount = transaction.type === TransactionType.INCOME ? transaction.amount : -transaction.amount;
    totals.set(weekday, (totals.get(weekday) ?? 0) + signedAmount);
  });

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([weekday]) => WEEKDAYS_PT[weekday]);
}

export function calculateWeakestDays(transactions: Transaction[], count = 2) {
  const totals = new Map<number, number>();

  transactions.forEach((transaction) => {
    const parsed = parseDateSafe(transaction.date);
    if (!parsed) return;
    const weekday = parsed.getDay();
    const signedAmount = transaction.type === TransactionType.INCOME ? transaction.amount : -transaction.amount;
    totals.set(weekday, (totals.get(weekday) ?? 0) + signedAmount);
  });

  return [...totals.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([weekday]) => WEEKDAYS_PT[weekday]);
}

export function calculateRiskOfCashSqueeze(summary: FinancialSummary): FinancialRiskProfile {
  const coverageRatio = summary.totalExpense > 0 ? summary.currentBalance / summary.totalExpense : 1;
  const projectedDelta = summary.projectedBalance - summary.currentBalance;
  let score = 0.2;

  if (coverageRatio < 0.3) score += 0.45;
  else if (coverageRatio < 0.6) score += 0.3;
  else if (coverageRatio < 0.9) score += 0.15;

  if (summary.fixedExpenses > summary.totalExpense * 0.65) score += 0.2;
  if (projectedDelta < 0) score += 0.2;

  score = Math.min(1, Number(score.toFixed(2)));

  if (score >= 0.7) {
    return { level: "high", score, reason: "Baixa cobertura de caixa e pressao de custos fixos." };
  }
  if (score >= 0.4) {
    return { level: "medium", score, reason: "Sinais de atencao para o fluxo nas proximas semanas." };
  }
  return { level: "low", score, reason: "Fluxo saudavel com boa previsibilidade de caixa." };
}

export function calculateInvestmentReadiness(params: {
  summary: FinancialSummary;
  reserveSummary: ReserveSummary;
  riskProfile: FinancialRiskProfile;
}): InvestmentReadiness {
  const { summary, reserveSummary, riskProfile } = params;
  const reserveCoverage = summary.totalExpense > 0 ? reserveSummary.currentBalance / summary.totalExpense : 0;
  const projectedPositive = summary.projectedBalance >= summary.currentBalance;

  let score = 0.15;
  if (reserveCoverage >= 0.8) score += 0.35;
  else if (reserveCoverage >= 0.4) score += 0.2;
  if (summary.netProfit > 0) score += 0.25;
  if (projectedPositive) score += 0.15;
  if (riskProfile.level === "low") score += 0.15;
  if (riskProfile.level === "high") score -= 0.15;
  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));

  if (score >= 0.7) {
    return { level: "ready", score, reason: "Reserva e fluxo permitem iniciar alocacoes graduais." };
  }
  if (score >= 0.4) {
    return { level: "caution", score, reason: "Pronto com cautela. Priorize reforco de caixa antes de escalar." };
  }
  return { level: "not_ready", score, reason: "Primeiro estabilize caixa e aumente a reserva de seguranca." };
}

function findPotBalance(pots: Pot[], type: PotType) {
  return pots.find((pot) => pot.type === type)?.balance ?? 0;
}

export function buildFinancialSummary(params: {
  transactions: Transaction[];
  pots?: Pot[];
  projectionDays?: number;
  now?: Date;
}): FinancialSummary {
  const { transactions, pots = [], projectionDays = 30, now = new Date() } = params;
  const totalIncome = calculateTotalIncome(transactions);
  const totalExpense = calculateTotalExpense(transactions);
  const netProfit = totalIncome - totalExpense;
  const fixedExpenses = calculateFixedExpenses(transactions);
  const variableExpenses = calculateVariableExpenses(transactions);
  const currentBalance = calculateCurrentBalance(transactions, pots);
  const projectedBalance = calculateProjectedBalance({
    transactions,
    currentBalance,
    projectionDays,
    now,
  });
  const incomeFrequency = calculateIncomeFrequency(transactions);
  const strongestDays = calculateStrongestDays(transactions);
  const weakestDays = calculateWeakestDays(transactions);

  return {
    totalIncome,
    totalExpense,
    netProfit,
    fixedExpenses,
    variableExpenses,
    currentBalance,
    projectedBalance,
    incomeFrequency,
    strongestDays,
    weakestDays,
  };
}

function buildAreaSummary(transactions: Transaction[], currentBalance: number) {
  const income = calculateTotalIncome(transactions);
  const expense = calculateTotalExpense(transactions);
  const net = income - expense;
  const fixedExpenses = calculateFixedExpenses(transactions);
  const variableExpenses = calculateVariableExpenses(transactions);
  return { income, expense, net, fixedExpenses, variableExpenses, currentBalance };
}

export function buildPersonalSummary(transactions: Transaction[], pots: Pot[] = []): PersonalSummary {
  return {
    area: "pessoal",
    ...buildAreaSummary(transactions, findPotBalance(pots, PotType.PERSONAL)),
  };
}

export function buildBusinessSummary(transactions: Transaction[], pots: Pot[] = []): BusinessSummary {
  return {
    area: "negocio",
    ...buildAreaSummary(transactions, findPotBalance(pots, PotType.BUSINESS)),
  };
}

export function buildReserveSummary(transactions: Transaction[], pots: Pot[] = []): ReserveSummary {
  return {
    area: "reserva",
    income: calculateTotalIncome(transactions),
    expense: calculateTotalExpense(transactions),
    net: calculateNetProfit(transactions),
    currentBalance: findPotBalance(pots, PotType.RESERVE),
  };
}

export function buildFinancialInsights(params: {
  summary: FinancialSummary;
  risk: FinancialRiskProfile;
  readiness: InvestmentReadiness;
}): FinancialInsight[] {
  const { summary, risk, readiness } = params;
  const insights: FinancialInsight[] = [];

  insights.push({
    id: "cashflow-net",
    title: "Resultado liquido",
    description:
      summary.netProfit >= 0
        ? "Entradas superam saidas no periodo analisado."
        : "Saidas superam entradas no periodo analisado.",
    impact: summary.netProfit >= 0 ? "positive" : "critical",
    action:
      summary.netProfit >= 0
        ? "Mantenha consistencia nas fontes de receita."
        : "Corte gastos variaveis e acelere recebimentos.",
  });

  insights.push({
    id: "cash-squeeze-risk",
    title: "Risco de aperto",
    description: risk.reason,
    impact: risk.level === "high" ? "critical" : risk.level === "medium" ? "attention" : "positive",
    action:
      risk.level === "high"
        ? "Priorize caixa de emergencia e renegocie custos fixos."
        : "Monitore o fluxo semanal para evitar deterioracao.",
  });

  insights.push({
    id: "investment-readiness",
    title: "Prontidao para investir",
    description: readiness.reason,
    impact: readiness.level === "ready" ? "positive" : readiness.level === "caution" ? "attention" : "critical",
    action:
      readiness.level === "ready"
        ? "Comece com aportes graduais e metas objetivas."
        : "Reforce reserva antes de aumentar risco de alocacao.",
  });

  if (summary.weakestDays.length > 0) {
    insights.push({
      id: "weak-days",
      title: "Dias mais fracos",
      description: `Pior desempenho em: ${summary.weakestDays.join(", ")}.`,
      impact: "attention",
      action: "Concentre campanhas e cobrancas nesses dias.",
    });
  }

  return insights;
}

