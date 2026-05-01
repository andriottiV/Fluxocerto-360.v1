import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";

import type { AIAdvisorContextPayload } from "./types";

export function buildAIAdvisorContext(snapshot: FinancialAdvisorResult["snapshot"]): AIAdvisorContextPayload {
  return {
    financialSummary: snapshot.financialSummary,
    personalSummary: snapshot.personalSummary,
    businessSummary: snapshot.businessSummary,
    reserveSummary: snapshot.reserveSummary,
    riskProfile: snapshot.riskProfile,
    investmentReadiness: snapshot.investmentReadiness,
  };
}

export function buildAIAdvisorPrompt(params: {
  context: AIAdvisorContextPayload;
  baseline: FinancialAdvisorResult;
}) {
  const { context, baseline } = params;

  return [
    "Você é um consultor financeiro de um app SaaS.",
    "Retorne exclusivamente JSON valido com os campos:",
    "diagnostico, riscoPrincipal, acaoImediata, metaDaSemana, proximoPassoRecomendado, insights.",
    "Cada insight deve ter: id, title, description, impact, action.",
    "Use tom profissional, curto e acionavel, em portugues do Brasil.",
    "Considere os dados abaixo como verdade operacional:",
    JSON.stringify(context),
    "Diagnostico baseline do motor local:",
    JSON.stringify({
      diagnostico: baseline.diagnostico,
      riscoPrincipal: baseline.riscoPrincipal,
      acaoImediata: baseline.acaoImediata,
      metaDaSemana: baseline.metaDaSemana,
      proximoPassoRecomendado: baseline.proximoPassoRecomendado,
    }),
  ].join("\n");
}

