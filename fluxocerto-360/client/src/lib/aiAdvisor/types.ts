import type {
  FinancialAdvisorEngineInput,
  FinancialAdvisorResult,
  FinancialSnapshot,
} from "@/lib/financialAdvisor";

export type AIAdvisorSource = "external" | "local-fallback";

export interface AIAdvisorServiceConfig {
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIAdvisorContextPayload {
  financialSummary: FinancialSnapshot["financialSummary"];
  personalSummary: FinancialSnapshot["personalSummary"];
  businessSummary: FinancialSnapshot["businessSummary"];
  reserveSummary: FinancialSnapshot["reserveSummary"];
  riskProfile: FinancialSnapshot["riskProfile"];
  investmentReadiness: FinancialSnapshot["investmentReadiness"];
}

export interface AIAdvisorExternalRequest {
  model: string;
  prompt: string;
  context: AIAdvisorContextPayload;
}

export interface AIAdvisorServiceResponse {
  source: AIAdvisorSource;
  data: FinancialAdvisorResult;
  rawExternal?: unknown;
  error?: string;
}

export type AIAdvisorAnalyzeInput = FinancialAdvisorEngineInput;

