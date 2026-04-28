import type { Account, AdjustmentAccount, Pot, Transaction } from "@/lib/types";
import type { AssistantTransactionPreview } from "@/lib/consultorAssistant";

export type AssistantActionStatus = "requested" | "confirmed" | "saved" | "cancelled" | "blocked" | "failed";
export type DuplicateResponsePhase = "start_input" | "finish_input" | "assistant_reply";

export type DuplicateResponseGuardState = {
  processingInput: string | null;
  lastProcessedInput: string;
  lastAssistantReply: string;
  lastUpdatedAt: number;
};

export type AssistantActionLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  action: "assistant_transaction" | "assistant_question" | "assistant_warning";
  status: AssistantActionStatus;
  summary: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean>;
};

const ACTION_LOG_PREFIX = "fc360:assistantActionLog:";

function buildLogKey(userId: string) {
  return `${ACTION_LOG_PREFIX}${userId}`;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeTextBase(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDedupe(value: string) {
  return sanitizeTextBase(value).toLocaleLowerCase("pt-BR");
}

function redactSensitive(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, "[telefone]");
}

export function sanitizeUserInput(value: string) {
  return redactSensitive(sanitizeTextBase(value));
}

export function preventDuplicateResponse(params: {
  phase: DuplicateResponsePhase;
  text?: string;
  state: DuplicateResponseGuardState;
  dedupeWindowMs?: number;
  now?: number;
}) {
  const { phase, state, text = "", dedupeWindowMs = 2200, now = Date.now() } = params;
  const normalizedText = normalizeForDedupe(text);
  const isWithinWindow = now - state.lastUpdatedAt <= dedupeWindowMs;

  if (phase === "start_input") {
    if (!normalizedText) return { blocked: true as const, state };
    const isProcessingSameInput = !!state.processingInput && state.processingInput === normalizedText;
    const isRepeatedInput = !!state.lastProcessedInput && state.lastProcessedInput === normalizedText && isWithinWindow;
    if (isProcessingSameInput || isRepeatedInput) return { blocked: true as const, state };
    return {
      blocked: false as const,
      state: {
        ...state,
        processingInput: normalizedText,
      },
    };
  }

  if (phase === "finish_input") {
    const finalizedInput = normalizedText || state.processingInput || state.lastProcessedInput;
    return {
      blocked: false as const,
      state: {
        ...state,
        processingInput: null,
        lastProcessedInput: finalizedInput,
        lastUpdatedAt: now,
      },
    };
  }

  if (!normalizedText) return { blocked: false as const, state };
  const isRepeatedReply = !!state.lastAssistantReply && state.lastAssistantReply === normalizedText && isWithinWindow;
  if (isRepeatedReply) return { blocked: true as const, state };
  return {
    blocked: false as const,
    state: {
      ...state,
      lastAssistantReply: normalizedText,
      lastUpdatedAt: now,
    },
  };
}

function readLog(userId: string): AssistantActionLogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(buildLogKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AssistantActionLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.userId === userId);
  } catch {
    return [];
  }
}

function writeLog(userId: string, entries: AssistantActionLogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildLogKey(userId), JSON.stringify(entries.slice(-200)));
}

export const assistantActionLog = {
  getByUser(userId: string) {
    return readLog(userId);
  },
  append(entry: Omit<AssistantActionLogEntry, "id" | "timestamp">) {
    const safeSummary = sanitizeUserInput(entry.summary).slice(0, 240);
    const fullEntry: AssistantActionLogEntry = {
      ...entry,
      id: createId("assist-log"),
      timestamp: new Date().toISOString(),
      summary: safeSummary,
    };
    const current = readLog(entry.userId);
    writeLog(entry.userId, [...current, fullEntry]);
    return fullEntry;
  },
  clear(userId: string) {
    writeLog(userId, []);
  },
};

export function confirmBeforeSaving(hasUserConfirmation: boolean) {
  return hasUserConfirmation === true;
}

export function validateAssistantAction(params: {
  userId?: string | null;
  preview?: AssistantTransactionPreview;
  accounts: Account[];
  pots: Pot[];
}) {
  const { userId, preview, accounts, pots } = params;
  if (!userId) return { ok: false as const, error: "Usuário não autenticado." };
  if (!preview) return { ok: false as const, error: "Prévia de ação inválida." };
  if (!accounts.length) return { ok: false as const, error: "Não encontrei conta para registrar." };
  if (!pots.length) return { ok: false as const, error: "Não encontrei potes financeiros." };
  if (!Number.isFinite(preview.amount) || preview.amount <= 0) {
    return { ok: false as const, error: "Valor da ação inválido." };
  }
  if (!preview.description?.trim()) {
    return { ok: false as const, error: "Descrição da ação obrigatória." };
  }
  return { ok: true as const };
}

export function validateFinancialDataAvailability(params: {
  transactions?: Transaction[];
  pots?: Pot[];
  adjustmentAccounts?: AdjustmentAccount[];
}) {
  const transactions = params.transactions ?? [];
  const pots = params.pots ?? [];
  const adjustmentAccounts = params.adjustmentAccounts ?? [];

  const hasTransactions = transactions.length >= 3;
  const hasPotData = pots.some((pot) => Number.isFinite(pot.balance) && Math.abs(pot.balance) > 0);
  const hasAccountSignals = adjustmentAccounts.length > 0;
  const ok = hasTransactions || hasPotData || hasAccountSignals;

  if (ok) return { ok: true as const };
  return {
    ok: false as const,
    message:
      "Consigo te ajudar melhor, mas ainda faltam alguns dados. Cadastre algumas entradas e saídas para eu enxergar seu cenário real.",
    fallback:
      "Eu não vou chutar número aqui. Com os dados que tenho, o caminho mais seguro é começar registrando entradas e saídas dos próximos dias.",
  };
}

export function preventCrossUserDataLeak<T extends { ownerId?: string }>(params: {
  userId?: string | null;
  items: T[];
}) {
  const { userId, items } = params;
  if (!userId) return [];
  return items.filter((item) => !item.ownerId || item.ownerId === userId);
}
