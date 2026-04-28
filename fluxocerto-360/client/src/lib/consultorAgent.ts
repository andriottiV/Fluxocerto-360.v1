import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import type { AdjustmentAccount, Client, Pot, Service, Transaction } from "@/lib/types";
import {
  buildTransactionPreview,
  detectUserIntent,
  extractSavingCommitment,
  formatCurrencyBRL,
  parseFinancialCommand,
  type SavingCommitment,
  type UserIntent,
} from "@/lib/consultorAssistant";
import { answerConsultorConversation } from "@/lib/consultorQuestion";
import { calculateSavingProjection } from "@/lib/fluxProjection";

export type FluxConversationTopic =
  | "reserve_plan"
  | "cashflow_urgent"
  | "financial_orientation"
  | "analysis"
  | "simulation"
  | "transaction_action"
  | "none";

export type FinancialTopic = "reserve" | "cashflow_urgent" | "rent" | "expense" | "income" | "growth" | "debt" | "general";
export type FinancialBucketKey = "PF" | "PJ" | "RESERVA";
export type FinancialBuckets = Record<FinancialBucketKey, number>;
export type ActiveObligationBucket = FinancialBucketKey | "PROJETO" | "DIVIDA";

export type ActiveObligation = {
  type: string;
  description: string;
  amount: number;
  dueDate: string;
  bucket: ActiveObligationBucket;
  currentBucketBalance: number;
  servicePrice: number | null;
  bucketPercentage: number | null;
};

export type FluxConversationState = {
  topic: FluxConversationTopic;
  activeTopic: string | null;
  lastUserIntent: "financial_planning" | "transaction_action" | "analysis" | "simulation" | "general" | "none";
  activeObligation: ActiveObligation | null;
  lastUserMessage: string;
  lastAssistantMessage: string;
  knownValues: Record<string, unknown>;
  knownData: {
    weeklySaving?: number;
    monthlySaving?: number;
    yearlySaving?: number;
    lastSavingFrequency?: "daily" | "weekly" | "monthly";
  };
  history: Array<{
    role: "user" | "assistant";
    message: string;
    timestamp: number;
  }>;
};

type FluxAgentInput = {
  userMessage: string;
  userFinancialData: {
    advisor: FinancialAdvisorResult;
    transactions: Transaction[];
    pots: Pot[];
    adjustmentAccounts: AdjustmentAccount[];
    clients: Client[];
    services: Service[];
  };
  conversationState: FluxConversationState;
};

export type FluxAgentResponse = {
  mode: "assistant" | "action";
  intent: UserIntent;
  response: string;
  riskTone: "positive" | "attention" | "critical";
  nextState: FluxConversationState;
};

export type FluxAgentCentralResponse = {
  message: string;
  updatedConversationState: FluxConversationState;
  pendingAction?: {
    type: "transaction_preview";
    preview: ReturnType<typeof buildTransactionPreview>;
    raw: ReturnType<typeof parseFinancialCommand>["preview"];
  };
};

const SYSTEM_PROMPT_TEMPLATE = `Sistema:
Você é o Flux, um consultor financeiro inteligente, humano e direto.

Seu papel é:
- ajudar o usuário a ganhar mais dinheiro
- evitar erros financeiros
- dar respostas claras, práticas e baseadas em dados

Regras:
- nunca responder como robô
- nunca pedir confirmação desnecessária
- entender contexto da conversa
- continuar raciocínio anterior
- responder qualquer pergunta financeira do usuário.`;

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function withHistory(state: FluxConversationState, role: "user" | "assistant", message: string): FluxConversationState {
  return {
    ...state,
    history: [...state.history.slice(-24), { role, message, timestamp: Date.now() }],
    lastUserMessage: role === "user" ? message : state.lastUserMessage,
    lastAssistantMessage: role === "assistant" ? message : state.lastAssistantMessage,
  };
}

function parseAmountToken(token: string) {
  const parsed = Number.parseFloat(token.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Number(parsed.toFixed(2));
}

function extractAllCurrencyValues(message: string) {
  const withoutDates = message.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ");
  const values: number[] = [];
  const matcher = /(?:r\$\s*|r\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*reais?)?/gi;
  let match = matcher.exec(withoutDates);
  while (match) {
    const value = parseAmountToken(match[1]);
    if (value) values.push(value);
    match = matcher.exec(withoutDates);
  }
  return values;
}

function extractDueDateRaw(message: string) {
  const match = message.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
}

function extractDueDateObject(message: string) {
  const match = message.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return undefined;
  const now = new Date();
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : now.getFullYear();
  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function calculateDaysUntil(date: Date) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function extractDaysToDue(message: string, obligationDueDate?: string) {
  const normalized = normalizeText(message);
  const explicit = normalized.match(/\b(\d{1,3})\s*dias?\b/);
  if (explicit) {
    const days = Number(explicit[1]);
    return Number.isFinite(days) && days > 0 ? days : undefined;
  }
  const explicitDate = extractDueDateObject(message);
  if (explicitDate) {
    const days = calculateDaysUntil(explicitDate);
    return days > 0 ? days : undefined;
  }
  if (!obligationDueDate) return undefined;
  const dateParts = obligationDueDate.match(/^(\d{2})\/(\d{2})$/);
  if (!dateParts) return undefined;
  const now = new Date();
  const day = Number(dateParts[1]);
  const month = Number(dateParts[2]) - 1;
  let target = new Date(now.getFullYear(), month, day);
  if (target.getTime() < now.getTime()) {
    target = new Date(now.getFullYear() + 1, month, day);
  }
  const days = calculateDaysUntil(target);
  return days > 0 ? days : undefined;
}

export function detectFinancialTopic(message: string): FinancialTopic {
  const normalized = normalizeText(message);
  if (!normalized) return "general";
  if (includesAny(normalized, ["aluguel", "preciso pagar", "tenho que pagar", "conta", "vencer", "vencimento", "vou quebrar", "pagar"])) {
    return "cashflow_urgent";
  }
  if (includesAny(normalized, ["reserva", "guardar", "poupar", "emergencia"])) return "reserve";
  if (includesAny(normalized, ["divida", "parcela", "juros"])) return "debt";
  if (includesAny(normalized, ["gasto", "despesa", "saida", "custo"])) return "expense";
  if (includesAny(normalized, ["entrada", "receita", "faturamento", "recebi"])) return "income";
  if (includesAny(normalized, ["ganhar mais", "crescer", "vender mais", "ticket medio"])) return "growth";
  return "general";
}

function mapTopicToContext(topic: FinancialTopic): FluxConversationTopic {
  if (topic === "cashflow_urgent" || topic === "rent" || topic === "debt") return "cashflow_urgent";
  if (topic === "reserve") return "reserve_plan";
  if (topic === "general") return "none";
  return "financial_orientation";
}

type ResolvedContext = {
  nextState: FluxConversationState;
  switchedTopic: boolean;
  detectedTopic: FinancialTopic;
  isUrgentCashflow: boolean;
};

export function resolveConversationContext(message: string, currentState: FluxConversationState): ResolvedContext {
  const normalized = normalizeText(message);
  const detectedTopic = detectFinancialTopic(message);
  const mappedContext = mapTopicToContext(detectedTopic);
  const isUrgentCashflow = includesAny(normalized, [
    "aluguel",
    "preciso pagar",
    "tenho que pagar",
    "conta",
    "vencer",
    "vencimento",
    "vou quebrar",
    "pagar",
    "dinheiro curto",
  ]);
  const forcedContext: FluxConversationTopic = isUrgentCashflow ? "cashflow_urgent" : mappedContext;

  if (forcedContext === "none" || forcedContext === currentState.topic) {
    return {
      nextState: currentState,
      switchedTopic: false,
      detectedTopic,
      isUrgentCashflow,
    };
  }

  return {
    nextState: {
      ...currentState,
      topic: forcedContext,
      activeTopic: forcedContext,
      lastUserIntent: forcedContext === "cashflow_urgent" ? "analysis" : "financial_planning",
      activeObligation: forcedContext === "cashflow_urgent" ? currentState.activeObligation : null,
    },
    switchedTopic: true,
    detectedTopic,
    isUrgentCashflow,
  };
}

function clampBucketPercentage(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number((value > 1 ? value / 100 : value).toFixed(4));
}

function resolvePotBalance(pots: Pot[], key: FinancialBucketKey) {
  if (key === "PF") {
    return (
      pots.find((pot) => pot.type === "pessoal")?.balance ??
      pots.find((pot) => normalizeText(pot.name).includes("pess"))?.balance ??
      0
    );
  }
  if (key === "PJ") {
    return (
      pots.find((pot) => pot.type === "negocio")?.balance ??
      pots.find((pot) => normalizeText(pot.name).includes("neg"))?.balance ??
      0
    );
  }
  return (
    pots.find((pot) => pot.type === "reserva")?.balance ??
    pots.find((pot) => normalizeText(pot.name).includes("reserv"))?.balance ??
    0
  );
}

export function buildFinancialBuckets(pots: Pot[]): FinancialBuckets {
  const pf = clampBucketPercentage(
    pots.find((pot) => pot.type === "pessoal")?.percentage ??
      pots.find((pot) => normalizeText(pot.name).includes("pess"))?.percentage ??
      50
  );
  const pj = clampBucketPercentage(
    pots.find((pot) => pot.type === "negocio")?.percentage ??
      pots.find((pot) => normalizeText(pot.name).includes("neg"))?.percentage ??
      40
  );
  const reserva = clampBucketPercentage(
    pots.find((pot) => pot.type === "reserva")?.percentage ??
      pots.find((pot) => normalizeText(pot.name).includes("reserv"))?.percentage ??
      10
  );
  const total = pf + pj + reserva;
  if (total <= 0) return { PF: 0.5, PJ: 0.4, RESERVA: 0.1 };
  return {
    PF: Number((pf / total).toFixed(4)),
    PJ: Number((pj / total).toFixed(4)),
    RESERVA: Number((reserva / total).toFixed(4)),
  };
}

export function classifyExpenseOrigin(text: string): FinancialBucketKey {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["emergencia", "reserva", "imprevisto"])) return "RESERVA";
  if (includesAny(normalized, ["lamina", "produto", "fornecedor", "insumo", "negocio", "trabalho", "taxa"])) return "PJ";
  if (includesAny(normalized, ["aluguel", "mercado", "casa", "moradia", "conta", "luz", "agua", "internet"])) return "PF";
  return "PF";
}

function inferObligationType(text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes("aluguel")) return "rent";
  if (normalized.includes("divida") || normalized.includes("dívida")) return "debt";
  return "expense";
}

function inferObligationDescription(text: string, type: string) {
  const normalized = normalizeText(text);
  if (type === "rent" && normalized.includes("casa")) return "aluguel da casa";
  if (type === "rent") return "aluguel";
  if (type === "debt") return "dívida";
  return "conta";
}

function extractServicePriceFromMessage(message: string) {
  const normalized = normalizeText(message);
  const hasServiceHint = includesAny(normalized, ["servico", "serviço", "corte", "atendimento", "ticket", "media", "média", "por servico", "por serviço"]);
  if (!hasServiceHint) return undefined;
  const values = extractAllCurrencyValues(message);
  return values[0];
}

function updateActiveObligationFromMessage(params: {
  message: string;
  state: FluxConversationState;
  pots: Pot[];
  forceUrgent: boolean;
}): FluxConversationState {
  const { message, state, pots, forceUrgent } = params;
  if (!forceUrgent && state.topic !== "cashflow_urgent" && !state.activeObligation) return state;

  const normalized = normalizeText(message);
  const existing = state.activeObligation;
  const values = extractAllCurrencyValues(message);
  const hasServiceHint = includesAny(normalized, ["servico", "serviço", "corte", "atendimento", "ticket", "media", "média"]);
  const hasObligationHint = includesAny(normalized, ["aluguel", "pagar", "conta", "vencer", "vencimento", "divida", "dívida", "devo"]);
  const dueDateRaw = extractDueDateRaw(message) || existing?.dueDate || "";

  let amountFromMessage: number | undefined;
  let servicePriceFromMessage: number | undefined;
  if (hasObligationHint && hasServiceHint && values.length >= 2) {
    amountFromMessage = values[0];
    servicePriceFromMessage = values[1];
  } else if (hasObligationHint && values.length > 0) {
    amountFromMessage = values[0];
  } else if (hasServiceHint && values.length > 0) {
    servicePriceFromMessage = values[0];
  } else if (!existing && values.length > 0) {
    amountFromMessage = values[0];
  }

  const type = existing?.type ?? inferObligationType(message);
  const bucket: ActiveObligationBucket =
    type === "debt" ? "DIVIDA" : type === "rent" || hasObligationHint ? classifyExpenseOrigin(message) : existing?.bucket ?? "PF";
  const safeBucket: FinancialBucketKey = bucket === "PJ" || bucket === "RESERVA" ? bucket : "PF";
  const buckets = buildFinancialBuckets(pots);
  const bucketPercentage = buckets[safeBucket];
  const currentBucketBalance = resolvePotBalance(pots, safeBucket);
  const amount = amountFromMessage ?? existing?.amount ?? 0;
  const servicePrice = servicePriceFromMessage ?? existing?.servicePrice ?? extractServicePriceFromMessage(message) ?? null;
  const description = existing?.description ?? inferObligationDescription(message, type);

  if (amount <= 0 && !existing) return state;

  const next: FluxConversationState = {
    ...state,
    topic: "cashflow_urgent",
    activeTopic: "cashflow_urgent",
    activeObligation: {
      type,
      description,
      amount,
      dueDate: dueDateRaw,
      bucket,
      currentBucketBalance,
      servicePrice,
      bucketPercentage: bucketPercentage > 0 ? bucketPercentage : null,
    },
    knownValues: {
      ...state.knownValues,
      obligationAmount: amount,
      servicePrice: servicePrice ?? undefined,
      dueDate: dueDateRaw || undefined,
    },
  };
  return next;
}

export function calculateBucketDeficit(obligationAmount: number, currentBucketBalance: number) {
  const safeObligation = Number.isFinite(obligationAmount) ? Math.max(obligationAmount, 0) : 0;
  const safeBalance = Number.isFinite(currentBucketBalance) ? Math.max(currentBucketBalance, 0) : 0;
  return Math.max(safeObligation - safeBalance, 0);
}

export function calculateGrossNeededForBucket(deficit: number, percentage: number) {
  const safeDeficit = Number.isFinite(deficit) ? Math.max(deficit, 0) : 0;
  const safePercentage = clampBucketPercentage(percentage);
  if (safeDeficit <= 0 || safePercentage <= 0) return 0;
  return Number((safeDeficit / safePercentage).toFixed(2));
}

export function calculateServicesNeeded(deficit: number, percentage: number, servicePrice: number) {
  const safeServicePrice = Number.isFinite(servicePrice) ? Math.max(servicePrice, 0) : 0;
  if (safeServicePrice <= 0) return 0;
  const grossNeeded = calculateGrossNeededForBucket(deficit, percentage);
  if (grossNeeded <= 0) return 0;
  return Math.max(1, Math.ceil(grossNeeded / safeServicePrice));
}

export function validateCalculation(services: number, price: number, percentage: number, deficit: number) {
  const safeServices = Number.isFinite(services) ? Math.max(Math.floor(services), 0) : 0;
  const safePrice = Number.isFinite(price) ? Math.max(price, 0) : 0;
  const safePercentage = clampBucketPercentage(percentage);
  const safeDeficit = Number.isFinite(deficit) ? Math.max(deficit, 0) : 0;
  if (safeServices <= 0 || safePrice <= 0 || safePercentage <= 0 || safeDeficit <= 0) return false;
  return safeServices * safePrice * safePercentage >= safeDeficit;
}

export function calculateServicesForBucketDeficit(deficit: number, servicePrice: number, bucketPercentage: number) {
  const amountPerServiceToBucket = Number((Math.max(servicePrice, 0) * clampBucketPercentage(bucketPercentage)).toFixed(2));
  const grossRevenueNeeded = calculateGrossNeededForBucket(deficit, bucketPercentage);
  let servicesNeeded = calculateServicesNeeded(deficit, bucketPercentage, servicePrice);
  while (servicesNeeded > 0 && !validateCalculation(servicesNeeded, servicePrice, bucketPercentage, deficit)) {
    servicesNeeded += 1;
  }
  return {
    deficit: Number(deficit.toFixed(2)),
    servicePrice: Number(servicePrice.toFixed(2)),
    bucketPercentage: clampBucketPercentage(bucketPercentage),
    amountPerServiceToBucket,
    servicesNeeded,
    grossRevenueNeeded,
  };
}

function buildObligationSummary(obligation: ActiveObligation) {
  const deficit = calculateBucketDeficit(obligation.amount, obligation.currentBucketBalance);
  return `Seu compromisso é ${formatCurrencyBRL(obligation.amount)}.
Hoje o pote ${obligation.bucket} cobre ${formatCurrencyBRL(obligation.currentBucketBalance)}.
Então faltam ${formatCurrencyBRL(deficit)} para pagar sem bagunçar os outros potes.`;
}

function buildCashUrgentResponse(params: { obligation: ActiveObligation; daysAvailable?: number; askStrategy?: boolean }) {
  const { obligation, daysAvailable, askStrategy = true } = params;
  const deficit = calculateBucketDeficit(obligation.amount, obligation.currentBucketBalance);
  const safePct = clampBucketPercentage(obligation.bucketPercentage ?? 0);

  if (deficit <= 0) {
    return `Boa notícia: esse compromisso já está coberto no pote ${obligation.bucket}. Dá para pagar sem mexer no PJ nem na reserva.`;
  }

  if (!obligation.servicePrice || obligation.servicePrice <= 0 || safePct <= 0) {
    return `Vamos direto.

Esse ${obligation.description} é ${obligation.bucket}.

Valor total: ${formatCurrencyBRL(obligation.amount)}
Saldo atual do ${obligation.bucket}: ${formatCurrencyBRL(obligation.currentBucketBalance)}
Falta: ${formatCurrencyBRL(deficit)}

Agora me diga sua média por serviço para eu calcular quantos atendimentos você precisa até o vencimento.`;
  }

  const calc = calculateServicesForBucketDeficit(deficit, obligation.servicePrice, safePct);
  const days = daysAvailable && daysAvailable > 0 ? daysAvailable : undefined;
  const pace10 = Math.ceil(calc.servicesNeeded / 10);
  const pace7 = Math.ceil(calc.servicesNeeded / 7);
  const pace5 = Math.ceil(calc.servicesNeeded / 5);
  const paceText = days
    ? `Se faltam ${days} dias: ${Math.ceil(calc.servicesNeeded / days)} atendimentos por dia.`
    : `Se faltam 10 dias: ${pace10} por dia.\nSe faltam 7 dias: ${pace7} por dia.\nSe faltam 5 dias: ${pace5} por dia.`;

  const strategy = askStrategy
    ? `
Estratégia prática:
- não mexer no PJ
- não usar a reserva agora
- chamar clientes fiéis e antigos
- abrir encaixes até a data
- tentar subir ticket com combo`
    : "";

  return `Vamos fazer isso do jeito certo, respeitando seus potes.

Esse ${obligation.description} é ${obligation.bucket}. Nada de puxar do dinheiro do negócio.

Valor total: ${formatCurrencyBRL(obligation.amount)}
Saldo atual do ${obligation.bucket}: ${formatCurrencyBRL(obligation.currentBucketBalance)}
Falta: ${formatCurrencyBRL(calc.deficit)}

Com serviço médio de ${formatCurrencyBRL(calc.servicePrice)} e ${Math.round(calc.bucketPercentage * 100)}% indo para ${obligation.bucket}, cada atendimento coloca ${formatCurrencyBRL(
    calc.amountPerServiceToBucket
  )} nesse pote.

Para cobrir ${formatCurrencyBRL(calc.deficit)}:
- faturamento bruto necessário: ${formatCurrencyBRL(calc.grossRevenueNeeded)}
- atendimentos necessários: ${calc.servicesNeeded}

${paceText}${strategy}`;
}

export function answerFollowUpQuestion(message: string, state: FluxConversationState) {
  const obligation = state.activeObligation;
  if (!obligation) return null;
  const normalized = normalizeText(message);
  const deficit = calculateBucketDeficit(obligation.amount, obligation.currentBucketBalance);

  const asksRemaining = includesAny(normalized, ["quanto falta", "faltam", "falta pra", "falta para", "quanto ainda"]);
  const asksStrategy = includesAny(normalized, ["estrategia", "estratégia", "como faço", "o que faço", "quanto tenho que fazer", "qual a estrategia", "qual estratégia"]);
  const asksPerDay = includesAny(normalized, ["por dia", "da tempo", "dá tempo", "quantos por dia", "por semana"]);
  const asksUseReserve = includesAny(normalized, ["usar a reserva", "posso usar reserva", "tirar da reserva"]);
  const asksUsePJ = includesAny(normalized, ["usar o pj", "tirar do pj", "mexer no pj", "posso usar o pj", "posso tirar do pj"]);

  if (asksUseReserve) {
    return `Dá para usar reserva só em último caso. Hoje faltam ${formatCurrencyBRL(
      deficit
    )}. O caminho mais saudável é resolver isso dentro do ${obligation.bucket} para não perder proteção financeira.`;
  }

  if (asksUsePJ) {
    return `Melhor evitar tirar do PJ agora. Você resolve uma conta e pode apertar seu caixa de trabalho. Hoje faltam ${formatCurrencyBRL(
      deficit
    )}. Vamos bater isso com produção e manter estrutura saudável.`;
  }

  if (asksRemaining) {
    return `Falta ${formatCurrencyBRL(deficit)}.

${buildObligationSummary(obligation)}

A estratégia é fechar esse valor dentro do pote ${obligation.bucket}, sem mexer no PJ nem na reserva.`;
  }

  if (asksPerDay || asksStrategy) {
    const days = extractDaysToDue(message, obligation.dueDate);
    return buildCashUrgentResponse({
      obligation,
      daysAvailable: days,
      askStrategy: true,
    });
  }

  if (state.topic === "cashflow_urgent") {
    const days = extractDaysToDue(message, obligation.dueDate);
    return buildCashUrgentResponse({
      obligation,
      daysAvailable: days,
      askStrategy: true,
    });
  }

  return null;
}

export function preventAmbiguityLoop(lastAssistantMessage: string | undefined, nextAssistantMessage: string) {
  if (!lastAssistantMessage) return nextAssistantMessage;
  const previous = normalizeText(lastAssistantMessage);
  const next = normalizeText(nextAssistantMessage);
  if (!previous || previous !== next) return nextAssistantMessage;
  return "";
}

function getLoopSafeReply(state: FluxConversationState, nextMessage: string) {
  const checked = preventAmbiguityLoop(state.lastAssistantMessage, nextMessage);
  if (checked) return checked;
  if (state.topic === "cashflow_urgent") {
    return "Já peguei o contexto. Me diga só a média por serviço ou quantos dias faltam que eu fecho sua meta diária.";
  }
  if (state.topic === "reserve_plan") {
    return "Para ajustar seu plano sem enrolação, me diga quanto você consegue separar por semana.";
  }
  return "Me diga em uma frase o que você quer decidir agora que eu respondo direto.";
}

function toWeeklyAmount(commitment: SavingCommitment) {
  if (commitment.frequency === "weekly") return commitment.amount;
  if (commitment.frequency === "daily") return commitment.amount * 7;
  return commitment.amount / 4.33;
}

function detectDailyForWeeklyQuestion(message: string) {
  const normalized = normalizeText(message);
  if (!(normalized.includes("por dia") && normalized.includes("por semana"))) return undefined;
  const commitment = extractSavingCommitment(message);
  if (commitment && commitment.frequency === "weekly") return commitment.amount;
  const values = extractAllCurrencyValues(message);
  return values[0];
}

function extractMonthsQuestion(normalized: string) {
  const match = normalized.match(/\b(\d{1,2})\s*mes(?:es)?\b/);
  if (!match) return undefined;
  const months = Number(match[1]);
  if (!Number.isFinite(months) || months <= 0) return undefined;
  return months;
}

function buildReserveProjectionReply(weeklySaving: number) {
  const projection = calculateSavingProjection(weeklySaving, "weekly", 12);
  return `Perfeito. Com ${formatCurrencyBRL(weeklySaving)} por semana, você coloca ${formatCurrencyBRL(projection.monthlyApproxAmount)} por mês na reserva.

Plano:
- ${formatCurrencyBRL(projection.weeklyAmount)} por semana
- ${formatCurrencyBRL(projection.monthlyApproxAmount)} por mês
- ${formatCurrencyBRL(projection.months3)} em 3 meses
- ${formatCurrencyBRL(projection.months6)} em 6 meses
- ${formatCurrencyBRL(projection.months12)} em 12 meses

Se quiser, eu te ajudo a transformar isso em meta semanal com acompanhamento simples.`;
}

function buildLocalProjectionIfPossible(message: string, state: FluxConversationState) {
  const normalized = normalizeText(message);
  const directCommitment = extractSavingCommitment(message);
  const weeklyFromState = state.knownData.weeklySaving;
  const weekly = directCommitment ? toWeeklyAmount(directCommitment) : weeklyFromState;
  const weeklyTargetForDaily = detectDailyForWeeklyQuestion(message);

  if (weeklyTargetForDaily && weeklyTargetForDaily > 0) {
    const projection = calculateSavingProjection(weeklyTargetForDaily, "weekly", 12);
    return {
      weekly: projection.weeklyAmount,
      yearlyProjection: projection.months12,
      response: `Boa, essa conta é simples:

👉 ${formatCurrencyBRL(projection.weeklyAmount)} ÷ 7 dias = ${formatCurrencyBRL(projection.dailyAmount)} por dia

Na prática, pode arredondar para ${formatCurrencyBRL(Math.ceil(projection.dailyAmount))} por dia.

Isso dá:
- ${formatCurrencyBRL(projection.weeklyAmount)} por semana
- cerca de ${formatCurrencyBRL(projection.monthlyApproxAmount)} por mês
- ${formatCurrencyBRL(projection.months12)} em 12 meses`,
    };
  }

  if (!weekly || weekly <= 0) return null;
  const projection12 = calculateSavingProjection(weekly, "weekly", 12);
  const months = extractMonthsQuestion(normalized);
  if (months) {
    const projected = calculateSavingProjection(weekly, "weekly", months).selectedMonthsAmount;
    return {
      weekly,
      yearlyProjection: projection12.months12,
      response: `Se você mantiver ${formatCurrencyBRL(weekly)} por semana:
👉 ${formatCurrencyBRL(projected)} em ${months} meses.

Sem mágica, só consistência. Quer que eu simule 24 e 36 meses também?`,
    };
  }
  return null;
}

export function generateProtectedPaymentStrategy(input: {
  message: string;
  pots: Pot[];
  explicitAmount?: number;
  explicitServicePrice?: number;
  explicitDaysAvailable?: number;
}) {
  const obligation: ActiveObligation = {
    type: inferObligationType(input.message),
    description: inferObligationDescription(input.message, inferObligationType(input.message)),
    amount: input.explicitAmount ?? extractAllCurrencyValues(input.message)[0] ?? 0,
    dueDate: extractDueDateRaw(input.message),
    bucket: classifyExpenseOrigin(input.message),
    currentBucketBalance: resolvePotBalance(input.pots, classifyExpenseOrigin(input.message)),
    servicePrice: input.explicitServicePrice ?? extractServicePriceFromMessage(input.message) ?? null,
    bucketPercentage: buildFinancialBuckets(input.pots)[classifyExpenseOrigin(input.message)],
  };
  return buildCashUrgentResponse({
    obligation,
    daysAvailable: input.explicitDaysAvailable,
    askStrategy: true,
  });
}

export function generateCashUrgencyPlan(params: { requiredAmount: number; servicePrice?: number; daysAvailable?: number }) {
  const fakeObligation: ActiveObligation = {
    type: "expense",
    description: "conta urgente",
    amount: params.requiredAmount,
    dueDate: "",
    bucket: "PF",
    currentBucketBalance: 0,
    servicePrice: params.servicePrice ?? null,
    bucketPercentage: 0.5,
  };
  return buildCashUrgentResponse({
    obligation: fakeObligation,
    daysAvailable: params.daysAvailable,
    askStrategy: true,
  });
}

export function createInitialConversationState(): FluxConversationState {
  return {
    topic: "none",
    activeTopic: null,
    lastUserIntent: "none",
    activeObligation: null,
    lastUserMessage: "",
    lastAssistantMessage: "",
    knownValues: {},
    knownData: {},
    history: [],
  };
}

export function updateConversationState(params: {
  userMessage: string;
  currentState: FluxConversationState;
  userFinancialData: FluxAgentInput["userFinancialData"];
}): FluxConversationState {
  const { userMessage, currentState, userFinancialData } = params;
  const resolvedContext = resolveConversationContext(userMessage, currentState);
  const stateAfterContext = resolvedContext.nextState;
  const withUserMessage = withHistory(stateAfterContext, "user", userMessage);
  const withMemory = updateActiveObligationFromMessage({
    message: userMessage,
    state: withUserMessage,
    pots: userFinancialData.pots,
    forceUrgent: resolvedContext.isUrgentCashflow || withUserMessage.topic === "cashflow_urgent",
  });
  return withMemory;
}

function buildAssistantReturn(params: {
  state: FluxConversationState;
  intent: UserIntent;
  response: string;
  riskTone: "positive" | "attention" | "critical";
  mode?: "assistant" | "action";
}) {
  const { state, intent, response, riskTone, mode = "assistant" } = params;
  if (mode === "action") {
    return {
      mode,
      intent,
      response,
      riskTone,
      nextState: state,
    } as FluxAgentResponse;
  }
  const safeResponse = getLoopSafeReply(state, response);
  const next = withHistory(state, "assistant", safeResponse);
  return {
    mode,
    intent,
    response: safeResponse,
    riskTone,
    nextState: next,
  } as FluxAgentResponse;
}

function createFluxAgentCoreResponse(input: FluxAgentInput): FluxAgentResponse {
  const { userMessage, userFinancialData, conversationState } = input;
  const withMemory = updateConversationState({
    userMessage,
    currentState: conversationState,
    userFinancialData,
  });

  const promptContext = `${SYSTEM_PROMPT_TEMPLATE}

Contexto atual:
- topic: ${withMemory.topic}
- activeTopic: ${withMemory.activeTopic}
- activeObligation: ${withMemory.activeObligation ? JSON.stringify(withMemory.activeObligation) : "none"}
- weeklySaving: ${withMemory.knownData.weeklySaving ?? "não definido"}
- pergunta: ${userMessage}`;
  void promptContext;

  const intent = detectUserIntent(userMessage);
  const normalized = normalizeText(userMessage);

  if (intent === "action") {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "transaction_action",
        activeTopic: "transaction_action",
        lastUserIntent: "transaction_action",
      },
      intent,
      response: "",
      riskTone: "attention",
      mode: "action",
    });
  }

  const followUp = answerFollowUpQuestion(userMessage, withMemory);
  if (followUp) {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "cashflow_urgent",
        activeTopic: "cashflow_urgent",
        lastUserIntent: "analysis",
      },
      intent: "analysis",
      response: followUp,
      riskTone: "attention",
    });
  }

  const commitment = extractSavingCommitment(userMessage);
  if (commitment) {
    const weekly = toWeeklyAmount(commitment);
    const response = buildReserveProjectionReply(weekly);
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "reserve_plan",
        activeTopic: "reserve_plan",
        lastUserIntent: "financial_planning",
        knownData: {
          ...withMemory.knownData,
          weeklySaving: weekly,
          monthlySaving: calculateSavingProjection(weekly, "weekly", 12).monthlyApproxAmount,
          yearlySaving: calculateSavingProjection(weekly, "weekly", 12).months12,
          lastSavingFrequency: commitment.frequency,
        },
      },
      intent: "context_reply",
      response,
      riskTone: "positive",
    });
  }

  const localProjection = buildLocalProjectionIfPossible(userMessage, withMemory);
  if (localProjection) {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "reserve_plan",
        activeTopic: "reserve_plan",
        lastUserIntent: "financial_planning",
        knownData: {
          ...withMemory.knownData,
          weeklySaving: localProjection.weekly,
          monthlySaving: calculateSavingProjection(localProjection.weekly, "weekly", 12).monthlyApproxAmount,
          yearlySaving: localProjection.yearlyProjection,
        },
      },
      intent: "analysis",
      response: localProjection.response,
      riskTone: "positive",
    });
  }

  if (
    (withMemory.topic === "reserve_plan" || withMemory.topic === "financial_orientation") &&
    (normalized.includes("orientacao estrategica") || normalized.includes("quero orientacao"))
  ) {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "reserve_plan",
        activeTopic: "reserve_plan",
        lastUserIntent: "financial_planning",
      },
      intent: "question",
      response:
        "Perfeito. Vamos na orientação estratégica da reserva. Me diga quanto você consegue guardar por semana e eu monto um plano de 3, 6 e 12 meses.",
      riskTone: "attention",
    });
  }

  if (normalized.includes("plano simples para melhorar minha reserva") || normalized.includes("plano simples para minha reserva")) {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        topic: "reserve_plan",
        activeTopic: "reserve_plan",
        lastUserIntent: "financial_planning",
      },
      intent: "question",
      response:
        "Boa decisão. O foco é constância:\n- guarde um valor pequeno toda semana\n- trate como conta obrigatória\n- não use para impulso\n\nMe diga quanto consegue por semana e eu ajusto para o seu cenário.",
      riskTone: "positive",
    });
  }

  if (intent === "unknown") {
    return buildAssistantReturn({
      state: {
        ...withMemory,
        lastUserIntent: "general",
      },
      intent,
      response:
        withMemory.topic === "cashflow_urgent"
          ? "Já tenho seu contexto aqui. Se quiser, te passo agora a meta por dia e o plano até o vencimento."
          : withMemory.topic === "reserve_plan"
            ? "Posso montar isso contigo. Me diz quanto consegue separar por semana para a reserva."
            : "Me fala em uma frase o objetivo de agora (pagar conta, reduzir gasto ou aumentar receita) e eu te respondo direto.",
      riskTone: "attention",
    });
  }

  const fallback = answerConsultorConversation({
    question: userMessage,
    advisor: userFinancialData.advisor,
    transactions: userFinancialData.transactions,
    pots: userFinancialData.pots,
    adjustmentAccounts: userFinancialData.adjustmentAccounts,
    clients: userFinancialData.clients,
    services: userFinancialData.services,
  });

  const nextTopic: FluxConversationTopic =
    intent === "analysis" ? "analysis" : intent === "simulation" ? "simulation" : "financial_orientation";
  const nextLastIntent: FluxConversationState["lastUserIntent"] =
    intent === "analysis" ? "analysis" : intent === "simulation" ? "simulation" : "financial_planning";

  return buildAssistantReturn({
    state: {
      ...withMemory,
      topic: nextTopic,
      activeTopic: nextTopic,
      lastUserIntent: nextLastIntent,
    },
    intent,
    response: fallback.message,
    riskTone: fallback.riskTone,
  });
}

export function createFluxAgentResponse(input: FluxAgentInput): FluxAgentCentralResponse {
  const core = createFluxAgentCoreResponse(input);
  if (core.mode === "action") {
    const parsed = parseFinancialCommand(input.userMessage);
    if (parsed.preview) {
      return {
        message: "Entendi assim:",
        updatedConversationState: core.nextState,
        pendingAction: {
          type: "transaction_preview",
          preview: buildTransactionPreview(parsed.preview),
          raw: parsed.preview,
        },
      };
    }
    return {
      message:
        parsed.followUpQuestion ??
        "Quase lá. Me passe os dados que faltam para eu montar o lançamento com segurança.",
      updatedConversationState: core.nextState,
    };
  }

  return {
    message: core.response,
    updatedConversationState: core.nextState,
  };
}
