import type { FluxConversationState } from "@/lib/consultorAgent";
import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import type { AdjustmentAccount, Client, Pot, Service, Transaction } from "@/lib/types";

type FluxAiProviderInput = {
  userId?: string;
  userMessage: string;
  conversationState: FluxConversationState;
  userFinancialData: {
    advisor: FinancialAdvisorResult;
    transactions: Transaction[];
    pots: Pot[];
    adjustmentAccounts: AdjustmentAccount[];
    clients: Client[];
    services: Service[];
  };
};

type FluxAiProviderResult = {
  mode: "assistant" | "action";
  intent: "question" | "action";
  response: string;
  riskTone: "positive" | "attention" | "critical";
  nextState: FluxConversationState;
  source: "api";
  suggestedActions: string[];
  pendingAction?: unknown;
};

type FluxAgentApiResponse = {
  message?: string;
  responseText: string;
  riskLevel: "safe" | "warning" | "critical";
  suggestedActions?: string[];
  updatedConversationState: FluxConversationState;
  pendingAction?: unknown;
};

async function apiProvider(input: FluxAiProviderInput): Promise<FluxAiProviderResult> {
  const response = await fetch("/api/flux-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: input.userId,
      userMessage: input.userMessage,
      conversationState: input.conversationState,
      userFinancialContext: input.userFinancialData,
    }),
  });

  if (!response.ok) {
    throw new Error(`flux-agent api failed: ${response.status}`);
  }

  const payload = (await response.json()) as FluxAgentApiResponse;
  const responseMessage = payload.message ?? payload.responseText;
  const mappedRiskTone =
    payload.riskLevel === "critical"
      ? "critical"
      : payload.riskLevel === "warning"
        ? "attention"
        : "positive";
  const hasPendingAction = Boolean(payload.pendingAction);
  return {
    mode: hasPendingAction ? "action" : "assistant",
    intent: hasPendingAction ? "action" : "question",
    response: responseMessage,
    riskTone: mappedRiskTone,
    nextState: payload.updatedConversationState,
    source: "api",
    suggestedActions: payload.suggestedActions ?? [],
    pendingAction: payload.pendingAction,
  };
}

export async function runFluxAiProvider(input: FluxAiProviderInput): Promise<FluxAiProviderResult> {
  return apiProvider(input);
}
