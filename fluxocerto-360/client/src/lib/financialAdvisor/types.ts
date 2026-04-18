import type { Pot, PotType, Transaction, TransactionType } from "@/lib/types";

export type FinancialArea = PotType;
export type FinancialRiskLevel = "low" | "medium" | "high";
export type InvestmentReadinessLevel = "not_ready" | "caution" | "ready";

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  area: FinancialArea;
}

export type transaction = FinancialTransaction;

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  fixedExpenses: number;
  variableExpenses: number;
  currentBalance: number;
  projectedBalance: number;
  incomeFrequency: number;
  strongestDays: string[];
  weakestDays: string[];
}

export type financialSummary = FinancialSummary;

export interface BusinessSummary {
  area: "negocio";
  income: number;
  expense: number;
  net: number;
  fixedExpenses: number;
  variableExpenses: number;
  currentBalance: number;
}

export type businessSummary = BusinessSummary;

export interface PersonalSummary {
  area: "pessoal";
  income: number;
  expense: number;
  net: number;
  fixedExpenses: number;
  variableExpenses: number;
  currentBalance: number;
}

export type personalSummary = PersonalSummary;

export interface ReserveSummary {
  area: "reserva";
  income: number;
  expense: number;
  net: number;
  currentBalance: number;
}

export interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  impact: "positive" | "attention" | "critical";
  action: string;
}

export type financialInsight = FinancialInsight;

export interface FinancialRiskProfile {
  level: FinancialRiskLevel;
  score: number;
  reason: string;
}

export type financialRiskProfile = FinancialRiskProfile;

export interface InvestmentReadiness {
  level: InvestmentReadinessLevel;
  score: number;
  reason: string;
}

export type investmentReadiness = InvestmentReadiness;

export interface FinancialSnapshot {
  financialSummary: FinancialSummary;
  personalSummary: PersonalSummary;
  businessSummary: BusinessSummary;
  reserveSummary: ReserveSummary;
  riskProfile: FinancialRiskProfile;
  investmentReadiness: InvestmentReadiness;
  insights: FinancialInsight[];
}

export interface FinancialAdvisorEngineInput {
  transactions: Transaction[];
  pots?: Pot[];
  now?: Date;
  projectionDays?: number;
}

export interface FinancialAdvisorResult {
  diagnostico: string;
  riscoPrincipal: string;
  acaoImediata: string;
  metaDaSemana: string;
  proximoPassoRecomendado: string;
  insights: FinancialInsight[];
  snapshot: FinancialSnapshot;
}

