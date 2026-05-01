import { runFinancialAdvisorEngine } from "@/lib/financialAdvisor";

import { buildAIAdvisorContext, buildAIAdvisorPrompt } from "./promptBuilder";
import { adaptAIAdvisorResponse } from "./responseAdapter";
import type {
  AIAdvisorAnalyzeInput,
  AIAdvisorExternalRequest,
  AIAdvisorServiceConfig,
  AIAdvisorServiceResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_MODEL = "advisor-v1";

function envConfig(): AIAdvisorServiceConfig {
  return {
    apiUrl: import.meta.env.VITE_AI_ADVISOR_API_URL as string | undefined,
    model: import.meta.env.VITE_AI_ADVISOR_MODEL as string | undefined,
    timeoutMs: Number(import.meta.env.VITE_AI_ADVISOR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

export function isAIAdvisorExternalConfigured(config?: AIAdvisorServiceConfig) {
  const merged = { ...envConfig(), ...config };
  return Boolean(merged.apiUrl);
}

export async function analyzeFinancialAdvisorWithAI(
  input: AIAdvisorAnalyzeInput,
  config?: AIAdvisorServiceConfig
): Promise<AIAdvisorServiceResponse> {
  const localFallback = runFinancialAdvisorEngine(input);
  const merged = { ...envConfig(), ...config };

  if (!merged.apiUrl) {
    return {
      source: "local-fallback",
      data: localFallback,
      error: "API externa não configurada. Fallback local ativo.",
    };
  }

  const context = buildAIAdvisorContext(localFallback.snapshot);
  const prompt = buildAIAdvisorPrompt({ context, baseline: localFallback });
  const requestBody: AIAdvisorExternalRequest = {
    model: merged.model || DEFAULT_MODEL,
    prompt,
    context,
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), merged.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    /**
     * Seguranca:
     * - não enviamos chave secreta do provider no front.
     * - esperado uso de endpoint proxy/backend proprio (VITE_AI_ADVISOR_API_URL).
     */
    const response = await fetch(merged.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        source: "local-fallback",
        data: localFallback,
        error: `Falha externa (${response.status}). Fallback local ativo.`,
      };
    }

    const raw = await response.json();
    const adapted =
      adaptAIAdvisorResponse({
        payload:
          raw?.result ??
          raw?.data ??
          raw?.output ??
          raw?.content ??
          raw,
        fallback: localFallback,
      }) ?? localFallback;

    return {
      source: adapted === localFallback ? "local-fallback" : "external",
      data: adapted,
      rawExternal: raw,
      error: adapted === localFallback ? "Resposta externa invalida. Fallback local ativo." : undefined,
    };
  } catch (error) {
    return {
      source: "local-fallback",
      data: localFallback,
      error:
        error instanceof Error
          ? `Erro na IA externa: ${error.message}. Fallback local ativo.`
          : "Erro na IA externa. Fallback local ativo.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

