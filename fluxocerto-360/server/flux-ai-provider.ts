import { createFluxAgentResponse, type FluxConversationState } from "../client/src/lib/consultorAgent";
import type { FinancialAdvisorResult } from "../client/src/lib/financialAdvisor";
import type { AdjustmentAccount, Client, Pot, Service, Transaction } from "../client/src/lib/types";

export type FluxAgentProviderInput = {
  userId?: string;
  userMessage: string;
  conversationState: FluxConversationState;
  userFinancialContext: {
    advisor: FinancialAdvisorResult;
    transactions: Transaction[];
    pots: Pot[];
    adjustmentAccounts: AdjustmentAccount[];
    clients: Client[];
    services: Service[];
  };
};

export type FluxAgentProviderOutput = {
  message: string;
  responseText: string;
  riskLevel: "safe" | "warning" | "critical";
  suggestedActions: string[];
  updatedConversationState: FluxConversationState;
  pendingAction?: {
    type: "transaction_preview";
    preview: unknown;
    raw: unknown;
  };
  source: "local-fallback";
};

function safeOwnerFilter<T extends { ownerId?: string }>(items: T[], userId?: string) {
  if (!userId) return items;
  return items.filter((item) => !item.ownerId || item.ownerId === userId);
}

function buildScopedInput(input: FluxAgentProviderInput): FluxAgentProviderInput {
  const { userId, userFinancialContext } = input;
  if (!userId) return input;
  return {
    ...input,
    userFinancialContext: {
      ...userFinancialContext,
      transactions: safeOwnerFilter(userFinancialContext.transactions, userId),
      pots: safeOwnerFilter(userFinancialContext.pots, userId),
      adjustmentAccounts: safeOwnerFilter(userFinancialContext.adjustmentAccounts, userId),
      clients: safeOwnerFilter(userFinancialContext.clients, userId),
      services: safeOwnerFilter(userFinancialContext.services, userId),
    },
  };
}

function detectRiskLevel(text: string): "safe" | "warning" | "critical" {
  const normalized = text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/(critico|grave|urgente|quebrar|insustentavel|nao fecha|não fecha)/.test(normalized)) return "critical";
  if (/(atencao|atenção|risco|cuidado|faltam|falta)/.test(normalized)) return "warning";
  return "safe";
}

export async function runFluxAiProvider(input: FluxAgentProviderInput): Promise<FluxAgentProviderOutput> {
  const scopedInput = buildScopedInput(input);
  const central = createFluxAgentResponse({
    userMessage: scopedInput.userMessage,
    conversationState: scopedInput.conversationState,
    userFinancialData: {
      advisor: scopedInput.userFinancialContext.advisor,
      transactions: scopedInput.userFinancialContext.transactions,
      pots: scopedInput.userFinancialContext.pots,
      adjustmentAccounts: scopedInput.userFinancialContext.adjustmentAccounts,
      clients: scopedInput.userFinancialContext.clients,
      services: scopedInput.userFinancialContext.services,
    },
  });

  return {
    message: central.message,
    responseText: central.message,
    riskLevel: detectRiskLevel(central.message),
    suggestedActions: ["Posso gastar hoje?", "Onde estou gastando mais?", "Criar plano de reserva"],
    updatedConversationState: central.updatedConversationState,
    pendingAction: central.pendingAction,
    source: "local-fallback",
  };
}
