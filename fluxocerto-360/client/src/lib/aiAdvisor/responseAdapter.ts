import type { FinancialAdvisorResult, FinancialInsight } from "@/lib/financialAdvisor";

function isInsightList(value: unknown): value is FinancialInsight[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<FinancialInsight>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.title === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.action === "string" &&
      (candidate.impact === "positive" || candidate.impact === "attention" || candidate.impact === "critical")
    );
  });
}

function parseFromString(payload: string): Record<string, unknown> | null {
  const trimmed = payload.trim();
  const jsonBlock = trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonBlock) return null;
  try {
    return JSON.parse(jsonBlock) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toObject(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null;
  if (typeof payload === "object") return payload as Record<string, unknown>;
  if (typeof payload === "string") return parseFromString(payload);
  return null;
}

export function adaptAIAdvisorResponse(params: {
  payload: unknown;
  fallback: FinancialAdvisorResult;
}): FinancialAdvisorResult | null {
  const { payload, fallback } = params;
  const objectPayload = toObject(payload);
  if (!objectPayload) return null;

  const diagnostico =
    typeof objectPayload.diagnostico === "string" ? objectPayload.diagnostico : fallback.diagnostico;
  const riscoPrincipal =
    typeof objectPayload.riscoPrincipal === "string" ? objectPayload.riscoPrincipal : fallback.riscoPrincipal;
  const acaoImediata =
    typeof objectPayload.acaoImediata === "string" ? objectPayload.acaoImediata : fallback.acaoImediata;
  const metaDaSemana =
    typeof objectPayload.metaDaSemana === "string" ? objectPayload.metaDaSemana : fallback.metaDaSemana;
  const proximoPassoRecomendado =
    typeof objectPayload.proximoPassoRecomendado === "string"
      ? objectPayload.proximoPassoRecomendado
      : fallback.proximoPassoRecomendado;
  const insights = isInsightList(objectPayload.insights) ? objectPayload.insights : fallback.insights;

  return {
    ...fallback,
    diagnostico,
    riscoPrincipal,
    acaoImediata,
    metaDaSemana,
    proximoPassoRecomendado,
    insights,
    snapshot: {
      ...fallback.snapshot,
      insights,
    },
  };
}

