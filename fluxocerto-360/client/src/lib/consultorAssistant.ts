import { Account, PaymentMethod, Pot, PotType, TransactionInput, TransactionType } from "@/lib/types";
import { formatCurrency as formatCurrencyBRLNative } from "@/lib/utils";
import { assistantActionLog, confirmBeforeSaving, validateAssistantAction } from "@/lib/consultorSafety";

export type AssistantBucket = "pessoal" | "negocio" | "reserva" | "auto";

export type AssistantTransactionPreview = {
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  amount: number;
  description: string;
  category: string;
  date: string;
  bucket: AssistantBucket;
  paymentMethod?: PaymentMethod;
  clientName?: string;
  serviceName?: string;
  rawMessage: string;
  confidence: "high" | "medium";
};

type PartialPreview = Partial<AssistantTransactionPreview> & { rawMessage: string };

export type ParseFinancialCommandResult = {
  isFinancialCommand: boolean;
  preview?: AssistantTransactionPreview;
  draft?: PartialPreview;
  missingFields: Array<"type" | "amount" | "bucket" | "description">;
  followUpQuestion?: string;
};

export type UserIntent = "action" | "question" | "analysis" | "simulation" | "context_reply" | "unknown";

export type SavingFrequency = "daily" | "weekly" | "monthly";

export type SavingCommitment = {
  amount: number;
  frequency: SavingFrequency;
  probableGoal: "reserva";
};

const EXPENSE_KEYWORDS = ["gasto", "despesa", "saida", "saiu", "paguei", "pagar", "lanca", "lancar"];
const INCOME_KEYWORDS = ["entrada", "recebi", "entrou", "caiu", "faturou", "venda", "registra entrada"];

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "transporte", keywords: ["uber", "gasolina", "combustivel", "onibus", "taxi", "99"] },
  { category: "alimentacao", keywords: ["almoco", "janta", "comida", "mercado", "lanche"] },
  { category: "servico", keywords: ["corte", "barba", "servico", "atendimento", "procedimento"] },
  { category: "produto", keywords: ["lamina", "produto", "shampoo", "pomada", "venda"] },
  { category: "moradia", keywords: ["aluguel", "energia", "agua", "internet", "condominio"] },
  { category: "impostos", keywords: ["imposto", "taxa", "tributo", "das"] },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s/$.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCurrencyBRL(value: number) {
  return formatCurrencyBRLNative(Number.isFinite(value) ? value : 0);
}

export function detectTransactionIntent(message: string) {
  const normalized = normalizeText(message);
  if (EXPENSE_KEYWORDS.some((item) => normalized.includes(item))) return TransactionType.EXPENSE;
  if (INCOME_KEYWORDS.some((item) => normalized.includes(item))) return TransactionType.INCOME;
  if (normalized.includes("coloca") && normalized.includes("reserva")) return TransactionType.INCOME;
  if (normalized.includes("cliente") && /\br\$\s*\d+|\br\s*\d+|\b\d+\s*reais?\b/.test(normalized)) {
    return TransactionType.INCOME;
  }
  return undefined;
}

export const detectTransactionType = detectTransactionIntent;

export function extractAmount(message: string) {
  const normalized = normalizeText(message);
  const pattern = /(?:r\$\s*|r\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*reais?)?/i;
  const match = normalized.match(pattern);
  if (!match?.[1]) return undefined;
  const sanitized = match[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number.parseFloat(sanitized);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Number(amount.toFixed(2));
}

export function extractCategory(message: string, type?: TransactionType) {
  const normalized = normalizeText(message);
  const rule = CATEGORY_RULES.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  if (rule) return rule.category;
  return type === TransactionType.INCOME ? "servico" : "outros";
}

export const detectCategory = extractCategory;

export function detectWalletOrBucket(message: string): AssistantBucket | undefined {
  const normalized = normalizeText(message);
  if (normalized.includes("pessoal") || normalized.includes("pf")) return "pessoal";
  if (normalized.includes("negocio") || normalized.includes("trabalho") || normalized.includes("pj")) return "negocio";
  if (normalized.includes("reserva")) return "reserva";
  return undefined;
}

export function extractPaymentMethod(message: string): PaymentMethod | undefined {
  const normalized = normalizeText(message);
  if (normalized.includes("pix")) return "pix";
  if (normalized.includes("debito")) return "debito";
  if (normalized.includes("credito") || normalized.includes("cartao")) return "credito";
  if (normalized.includes("transferencia")) return "transferencia";
  if (normalized.includes("dinheiro")) return "dinheiro";
  return undefined;
}

export const detectPaymentMethod = extractPaymentMethod;

export function extractDate(message: string) {
  const normalized = normalizeText(message);
  const now = new Date();

  if (normalized.includes("hoje")) return todayIso();
  if (normalized.includes("ontem")) {
    const date = new Date(now);
    date.setDate(now.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  if (normalized.includes("amanha")) {
    const date = new Date(now);
    date.setDate(now.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  const dateMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!dateMatch) return todayIso();

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const year = dateMatch[3] ? Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : now.getFullYear();
  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) return todayIso();
  return parsed.toISOString().slice(0, 10);
}

export const detectDate = extractDate;

function extractAmountFromWords(normalized: string) {
  const simpleWords: Record<string, number> = {
    dez: 10,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    cem: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    mil: 1000,
  };
  for (const [word, value] of Object.entries(simpleWords)) {
    if (normalized.includes(word)) return value;
  }
  return undefined;
}

function detectSavingFrequency(normalized: string): SavingFrequency | undefined {
  if (/\bpor dia\b|\bao dia\b|\bdiario\b|\bdiaria\b/.test(normalized)) return "daily";
  if (/\bpor semana\b|\bsemanal\b|\bsemanalmente\b/.test(normalized)) return "weekly";
  if (/\bpor mes\b|\bao mes\b|\bmensal\b|\bmensalmente\b/.test(normalized)) return "monthly";
  return undefined;
}

export function extractSavingCommitment(message: string): SavingCommitment | undefined {
  const normalized = normalizeText(message);
  const frequency = detectSavingFrequency(normalized);
  if (!frequency) return undefined;

  const amount = extractAmount(message) ?? extractAmountFromWords(normalized);
  if (!amount || amount <= 0) return undefined;

  const hasSavingSignal =
    /\bguardar\b|\bguardo\b|\bconsigo\b|\breserva\b|\beconomia\b|\bseparar\b/.test(normalized) ||
    /^(\d+|\w+)\s+por\s+(dia|semana|mes)/.test(normalized);
  if (!hasSavingSignal) return undefined;

  return {
    amount,
    frequency,
    probableGoal: "reserva",
  };
}

export function detectClientName(message: string) {
  const normalized = normalizeText(message);
  const explicit = normalized.match(/(?:cliente|do cliente|da cliente)\s+([a-z\s]{2,40})/i)?.[1];
  if (explicit) {
    return explicit
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return undefined;
}

function detectServiceName(message: string) {
  const normalized = normalizeText(message);
  const betweenClientAndAmount = normalized.match(/cliente\s+[a-z\s]{2,40},?\s*([a-z\s]{2,40})\s*(?:r\$|r\s*\d|\d+\s*reais)/i)?.[1];
  const fromWith = normalized.match(/(?:com|de)\s+([a-z0-9\s]{2,50})/i)?.[1];
  const raw = betweenClientAndAmount ?? fromWith;
  if (!raw) return undefined;

  const cleaned = raw
    .replace(/\b(hoje|amanha|ontem|pix|debito|credito|dinheiro|transferencia|pessoal|negocio|reserva|cliente)\b/g, " ")
    .replace(/\b(r\$|r)\s*\d+[.,]?\d*\b/g, " ")
    .replace(/\b(adicione|adiciona|registra|registrar|lanca|lancar|gasto|despesa|entrada|coloca)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;
  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function shouldTreatAsFinancialCommand(message: string) {
  const normalized = normalizeText(message);
  if (/\br\$\b|\br\s*\d+|\b\d+\s*reais?\b/.test(normalized)) return true;
  return [
    "gasto",
    "despesa",
    "entrada",
    "recebi",
    "entrou",
    "pix",
    "debito",
    "credito",
    "reserva",
    "adiciona",
    "registra",
    "lanca",
    "coloca",
    "cliente",
  ].some((keyword) => normalized.includes(keyword));
}

export function detectUserIntent(message: string): UserIntent {
  const normalized = normalizeText(message);
  if (!normalized) return "unknown";

  if (normalized.includes("e se")) return "simulation";

  if (extractSavingCommitment(message)) return "context_reply";
  if (
    /\b(consigo|guardar|guardo|separar|separo|economizar|economizo)\b/.test(normalized) &&
    /\b(?:r\$\s*|r\s*)?\d+(?:[.,]\d{1,2})?\b/.test(normalized)
  ) {
    return "context_reply";
  }

  const actionTerms = ["adiciona", "adicionar", "registra", "registrar", "lanca", "lancar", "coloca", "cria lancamento"];
  if (actionTerms.some((term) => normalized.includes(term))) return "action";

  const questionTerms = ["como", "posso", "devo", "vale a pena", "me ajuda", "me passe", "plano", "orientacao", "estrategica"];
  if (questionTerms.some((term) => normalized.includes(term))) return "question";

  const analysisTerms = ["quanto tenho", "como esta", "meu mes", "meu caixa", "meu saldo", "minha situacao"];
  if (analysisTerms.some((term) => normalized.includes(term))) return "analysis";

  return "unknown";
}

export function parseFinancialCommand(
  message: string,
  existingDraft?: PartialPreview | Partial<AssistantTransactionPreview> | null
): ParseFinancialCommandResult {
  const rawMessage = message.trim();
  if (!rawMessage) return { isFinancialCommand: false, missingFields: [] };

  const isFinancialCommand = shouldTreatAsFinancialCommand(rawMessage) || !!existingDraft;
  if (!isFinancialCommand) return { isFinancialCommand: false, missingFields: [] };

  const type = detectTransactionIntent(rawMessage) ?? existingDraft?.type;
  const amount = extractAmount(rawMessage) ?? existingDraft?.amount;
  const bucket = detectWalletOrBucket(rawMessage) ?? existingDraft?.bucket;
  const date = extractDate(rawMessage) ?? existingDraft?.date ?? todayIso();
  const paymentMethod = extractPaymentMethod(rawMessage) ?? existingDraft?.paymentMethod;
  const clientName = detectClientName(rawMessage) ?? existingDraft?.clientName;
  const serviceName = detectServiceName(rawMessage) ?? existingDraft?.serviceName;
  const description = serviceName ?? existingDraft?.description;
  const category = extractCategory(rawMessage, type) ?? existingDraft?.category;

  const missingFields: Array<"type" | "amount" | "bucket" | "description"> = [];
  if (!type) missingFields.push("type");
  if (!amount) missingFields.push("amount");
  if (!description) missingFields.push("description");
  if (type === TransactionType.EXPENSE && !bucket) missingFields.push("bucket");

  if (missingFields.length > 0) {
    const draft: PartialPreview = {
      ...existingDraft,
      rawMessage,
      type,
      amount,
      description,
      category,
      date,
      bucket,
      paymentMethod,
      clientName,
      serviceName,
    };
    const followUpQuestion = missingFields.includes("bucket")
      ? "Entendi o valor, mas não consegui identificar se é pessoal, negócio ou reserva. De onde esse dinheiro saiu?"
      : missingFields.includes("amount")
        ? "Entendi sua intenção, mas faltou o valor. Qual valor devo registrar?"
        : "Perfeito, estou quase montando. Me confirme a descrição do lançamento.";
    return {
      isFinancialCommand: true,
      draft,
      missingFields,
      followUpQuestion,
    };
  }

  const preview: AssistantTransactionPreview = {
    type: type as TransactionType.INCOME | TransactionType.EXPENSE,
    amount: Number(amount),
    description: description as string,
    serviceName,
    category: category ?? "outros",
    date: date ?? todayIso(),
    bucket: bucket ?? "auto",
    paymentMethod,
    clientName,
    rawMessage,
    confidence: existingDraft ? "medium" : "high",
  };

  return {
    isFinancialCommand: true,
    preview,
    missingFields: [],
  };
}

export function buildTransactionPreview(preview: AssistantTransactionPreview) {
  return {
    ...preview,
    amountLabel: formatCurrencyBRL(preview.amount),
    typeLabel: preview.type === TransactionType.INCOME ? "Entrada" : "Saída",
    bucketLabel:
      preview.bucket === "auto"
        ? "Distribuição automática"
        : preview.bucket === "pessoal"
          ? "Pessoal"
          : preview.bucket === "negocio"
            ? "Negócio"
            : "Reserva",
    dateLabel: preview.date === todayIso() ? "Hoje" : preview.date,
    paymentLabel: preview.paymentMethod
      ? preview.paymentMethod === "pix"
        ? "Pix"
        : preview.paymentMethod === "debito"
          ? "Cartão de débito"
          : preview.paymentMethod === "credito"
            ? "Cartão de crédito"
            : preview.paymentMethod === "dinheiro"
              ? "Dinheiro"
              : "Transferência"
      : "Não informado",
  };
}

function resolvePotId(bucket: AssistantBucket, pots: Pot[]) {
  if (bucket === "auto") return undefined;
  const typeByBucket: Record<Exclude<AssistantBucket, "auto">, PotType> = {
    pessoal: PotType.PERSONAL,
    negocio: PotType.BUSINESS,
    reserva: PotType.RESERVE,
  };
  const targetType = typeByBucket[bucket];
  const byType = pots.find((pot) => pot.type === targetType);
  if (byType) return byType.id;
  const byName = pots.find((pot) => normalizeText(pot.name).includes(bucket === "negocio" ? "negocio" : bucket));
  return byName?.id;
}

export function editAssistantTransaction(
  current: AssistantTransactionPreview,
  patch: Partial<AssistantTransactionPreview>
): AssistantTransactionPreview {
  const next = { ...current, ...patch };
  return {
    ...next,
    amount: Number.isFinite(next.amount) && next.amount > 0 ? Number(next.amount.toFixed(2)) : current.amount,
    description: next.description?.trim() ? next.description.trim() : current.description,
    category: next.category?.trim() ? next.category.trim() : current.category,
  };
}

export function cancelAssistantTransaction() {
  return { ok: true } as const;
}

export function confirmAssistantTransaction(params: {
  userId?: string | null;
  userConfirmed?: boolean;
  preview: AssistantTransactionPreview;
  accounts: Account[];
  pots: Pot[];
  addTransaction: (transaction: TransactionInput) => { ok: boolean; error?: string; data?: unknown };
}) {
  const { userId, userConfirmed = true, preview, addTransaction, accounts, pots } = params;

  if (!confirmBeforeSaving(userConfirmed)) {
    if (userId) {
      assistantActionLog.append({
        userId,
        action: "assistant_transaction",
        status: "blocked",
        summary: "Tentativa de salvar lançamento sem confirmação explícita.",
        reason: "missing_confirmation",
      });
    }
    return { ok: false, error: "Confirmação obrigatória antes de salvar." };
  }

  const validation = validateAssistantAction({ userId, preview, accounts, pots });
  if (!validation.ok) {
    if (userId) {
      assistantActionLog.append({
        userId,
        action: "assistant_transaction",
        status: "blocked",
        summary: "Ação do assistente bloqueada por validação.",
        reason: validation.error,
      });
    }
    return { ok: false, error: validation.error };
  }

  assistantActionLog.append({
    userId: userId as string,
    action: "assistant_transaction",
    status: "confirmed",
    summary: `Confirmação recebida para ${preview.type} de ${formatCurrencyBRL(preview.amount)}.`,
    metadata: {
      amount: preview.amount,
      type: preview.type,
    },
  });

  const accountName = accounts[0]?.name ?? "Conta Corrente";
  const potId = resolvePotId(preview.bucket, pots);

  const payload: TransactionInput = {
    type: preview.type,
    amount: preview.amount,
    description: preview.description,
    serviceName: preview.serviceName,
    category: preview.category,
    date: preview.date,
    account: accountName,
    potId,
    paymentMethod: preview.paymentMethod,
    clientName: preview.clientName,
    paymentStatus: "pago",
    paidAt: preview.date,
    origin: "Consultor Flux",
    notes: "assistente-confirmado",
  };

  const result = addTransaction(payload);
  assistantActionLog.append({
    userId: userId as string,
    action: "assistant_transaction",
    status: result.ok ? "saved" : "failed",
    summary: result.ok
      ? `Lançamento salvo via assistente: ${preview.type} ${formatCurrencyBRL(preview.amount)}.`
      : "Falha ao salvar lançamento via assistente.",
    reason: result.ok ? undefined : result.error ?? "unknown_error",
    metadata: {
      amount: preview.amount,
      type: preview.type,
      hasClient: !!preview.clientName,
    },
  });
  return result;
}
