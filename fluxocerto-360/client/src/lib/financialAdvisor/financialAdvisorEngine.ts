import type { FinancialAdvisorEngineInput, FinancialAdvisorResult } from "./types";
import {
  buildBusinessSummary,
  buildFinancialInsights,
  buildFinancialSummary,
  buildPersonalSummary,
  buildReserveSummary,
  calculateInvestmentReadiness,
  calculateRiskOfCashSqueeze,
  splitTransactionsByArea,
} from "./metrics";

function buildDiagnostico(result: {
  riskLevel: "low" | "medium" | "high";
  readinessLevel: "not_ready" | "caution" | "ready";
  netProfit: number;
}) {
  const { riskLevel, readinessLevel, netProfit } = result;

  if (riskLevel === "high") {
    return "Fluxo em alerta: foco imediato em preservar caixa e reduzir pressao de custos.";
  }
  if (netProfit < 0) {
    return "Resultado negativo no periodo: ajuste de despesas e rotina de receita recomendado.";
  }
  if (readinessLevel === "ready") {
    return "Operacao estavel e pronta para evoluir com estrategia de investimento gradual.";
  }
  return "Cenario controlado com espaco para otimizar previsibilidade e crescimento.";
}

function buildRiscoPrincipal(result: { riskScore: number; fixedShare: number; projectedDrop: boolean }) {
  const { riskScore, fixedShare, projectedDrop } = result;

  if (riskScore >= 0.7) return "Risco elevado de aperto de caixa no curto prazo.";
  if (fixedShare > 0.65) return "Custos fixos altos comprimindo margem operacional.";
  if (projectedDrop) return "Tendencia de queda no saldo projetado para os proximos dias.";
  return "Risco controlado, com necessidade de monitoramento continuo.";
}

function buildAcaoImediata(result: {
  riskLevel: "low" | "medium" | "high";
  weakestDays: string[];
}) {
  if (result.riskLevel === "high") {
    return "Reduza gastos variaveis hoje e priorize renegociacao de despesas fixas.";
  }
  if (result.weakestDays.length > 0) {
    return `Reforce receitas nos dias de menor performance: ${result.weakestDays.join(", ")}.`;
  }
  return "Mantenha disciplina de caixa e acompanhe indicadores semanalmente.";
}

function buildMetaDaSemana(result: {
  netProfit: number;
  totalExpense: number;
  reserveBalance: number;
}) {
  if (result.netProfit < 0) {
    const target = Math.max(100, Math.round(result.totalExpense * 0.08));
    return `Reduzir saidas em pelo menos R$ ${target} nesta semana.`;
  }
  if (result.reserveBalance <= 0) {
    return "Direcionar um aporte inicial para o pote de reserva.";
  }
  return "Elevar a margem liquida com ganho adicional de receita recorrente.";
}

function buildProximoPasso(result: {
  readinessLevel: "not_ready" | "caution" | "ready";
  projectedPositive: boolean;
}) {
  if (result.readinessLevel === "ready") {
    return "Estruturar uma politica de aporte mensal com revisao quinzenal.";
  }
  if (!result.projectedPositive) {
    return "Revisar fluxo projetado e ajustar teto de gastos para os proximos 30 dias.";
  }
  return "Consolidar reserva de seguranca antes de ampliar exposicao a risco.";
}

export function runFinancialAdvisorEngine(input: FinancialAdvisorEngineInput): FinancialAdvisorResult {
  const { transactions, pots = [], now = new Date(), projectionDays = 30 } = input;
  const transactionsByArea = splitTransactionsByArea(transactions);

  const financialSummary = buildFinancialSummary({
    transactions,
    pots,
    now,
    projectionDays,
  });

  const personalSummary = buildPersonalSummary(transactionsByArea.pessoal, pots);
  const businessSummary = buildBusinessSummary(transactionsByArea.negocio, pots);
  const reserveSummary = buildReserveSummary(transactionsByArea.reserva, pots);
  const riskProfile = calculateRiskOfCashSqueeze(financialSummary);
  const investmentReadiness = calculateInvestmentReadiness({
    summary: financialSummary,
    reserveSummary,
    riskProfile,
  });
  const insights = buildFinancialInsights({
    summary: financialSummary,
    risk: riskProfile,
    readiness: investmentReadiness,
  });

  const fixedShare =
    financialSummary.totalExpense > 0
      ? financialSummary.fixedExpenses / financialSummary.totalExpense
      : 0;
  const projectedPositive = financialSummary.projectedBalance >= financialSummary.currentBalance;

  return {
    diagnostico: buildDiagnostico({
      riskLevel: riskProfile.level,
      readinessLevel: investmentReadiness.level,
      netProfit: financialSummary.netProfit,
    }),
    riscoPrincipal: buildRiscoPrincipal({
      riskScore: riskProfile.score,
      fixedShare,
      projectedDrop: !projectedPositive,
    }),
    acaoImediata: buildAcaoImediata({
      riskLevel: riskProfile.level,
      weakestDays: financialSummary.weakestDays,
    }),
    metaDaSemana: buildMetaDaSemana({
      netProfit: financialSummary.netProfit,
      totalExpense: financialSummary.totalExpense,
      reserveBalance: reserveSummary.currentBalance,
    }),
    proximoPassoRecomendado: buildProximoPasso({
      readinessLevel: investmentReadiness.level,
      projectedPositive,
    }),
    insights,
    snapshot: {
      financialSummary,
      personalSummary,
      businessSummary,
      reserveSummary,
      riskProfile,
      investmentReadiness,
      insights,
    },
  };
}

