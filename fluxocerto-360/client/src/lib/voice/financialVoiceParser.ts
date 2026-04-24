import { PaymentMethod, TransactionType } from "@/lib/types";

export type VoiceAreaHint = "pessoal" | "negocio" | "reserva" | "indefinido";

export type ParsedVoiceCommand = {
  rawText: string;
  correctedText: string;
  normalizedText: string;
  type?: TransactionType.INCOME | TransactionType.EXPENSE;
  amount?: number;
  category?: string;
  description?: string;
  date: string;
  paymentMethod?: PaymentMethod;
  paymentLabel?: "Pix" | "Crédito" | "Débito" | "Dinheiro" | "Transferência" | "Boleto";
  clientName?: string;
  clientId?: string;
  customerName?: string;
  customerId?: string;
  areaHint: VoiceAreaHint;
  missingFields: string[];
  ambiguous: boolean;
  summary: string;
};

const INCOME_KEYWORDS = ["entrou", "recebi", "recebeu", "recebido", "ganhei", "entrada", "caiu"];
const EXPENSE_KEYWORDS = ["saiu", "saida", "gastei", "paguei", "despesa", "gasto", "comprei", "separei"];
const INCOME_FORCE_TERMS = ["pagou", "recebeu", "recebi", "entrou", "caiu", "venda", "corte", "servico"];

const CATEGORY_HINTS: Array<{ key: string; category: string }> = [
  { key: "gasolina", category: "transporte" },
  { key: "combustivel", category: "transporte" },
  { key: "mercado", category: "alimentacao" },
  { key: "aluguel", category: "aluguel" },
  { key: "produto", category: "insumos" },
  { key: "insumo", category: "insumos" },
  { key: "marketing", category: "marketing" },
  { key: "imposto", category: "impostos" },
  { key: "conta", category: "contas fixas" },
  { key: "reserva", category: "reserva" },
  { key: "corte", category: "servicos" },
  { key: "servico", category: "servicos" },
  { key: "venda", category: "servicos" },
];

const SPELLING_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpics\b/g, "pix"],
  [/\bpixs\b/g, "pix"],
  [/\bpiks\b/g, "pix"],
  [/\bpiques\b/g, "pix"],
  [/\bcredito\b/g, "crédito"],
  [/\bdebito\b/g, "débito"],
  [/\bservico\b/g, "serviço"],
  [/\bsaida\b/g, "saída"],
  [/\bentrei\b/g, "entrei"],
  [/\bentre os\b/g, "entrou"],
  [/\brecebiu\b/g, "recebi"],
];

const CLIENT_STOP_WORDS = new Set([
  "pix",
  "dinheiro",
  "debito",
  "credito",
  "cartao",
  "transferencia",
  "boleto",
  "pessoal",
  "negocio",
  "reserva",
  "hoje",
  "ontem",
  "amanha",
  "no",
  "na",
  "em",
  "com",
  "para",
  "pra",
  "cliente",
  "do",
  "da",
  "pagou",
  "recebeu",
  "recebi",
  "fez",
  "cortou",
  "deu",
  "r",
  "real",
  "reais",
]);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applySpellingCorrections(value: string) {
  return SPELLING_REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value);
}

function toSentenceCase(value: string) {
  if (!value) return value;
  const trimmed = value.trim();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

function toNameCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function extractAmount(normalizedText: string) {
  const match = normalizedText.match(/(\d+[.,]?\d{0,2})/);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function detectType(normalizedText: string) {
  const base = normalizeText(normalizedText);
  const hasIncome = INCOME_KEYWORDS.some((keyword) => base.includes(keyword));
  const hasExpense = EXPENSE_KEYWORDS.some((keyword) => base.includes(keyword));
  const hasForcedIncomeTerm = INCOME_FORCE_TERMS.some((keyword) => base.includes(keyword));
  const hasClientPaidPattern =
    /\b(?:o\s+)?cliente\s+[a-z0-9\s]{2,}\s+pagou\b/.test(base) || /\b[a-z0-9]{2,}\s+pagou\b/.test(base);

  if (base.includes("separei") && base.includes("reserva")) {
    return TransactionType.EXPENSE;
  }
  if (base.includes("paguei")) return TransactionType.EXPENSE;
  if (hasForcedIncomeTerm || hasClientPaidPattern) return TransactionType.INCOME;

  if (hasIncome && !hasExpense) return TransactionType.INCOME;
  if (!hasIncome && hasExpense) return TransactionType.EXPENSE;
  return undefined;
}

function detectArea(normalizedText: string): VoiceAreaHint {
  const base = normalizeText(normalizedText);
  if (base.includes("reserva")) return "reserva";
  if (base.includes("negocio") || base.includes("empresa") || base.includes("pj")) {
    return "negocio";
  }
  if (base.includes("pessoal") || base.includes("pf")) {
    return "pessoal";
  }
  return "indefinido";
}

function detectCategory(normalizedText: string, type?: TransactionType.INCOME | TransactionType.EXPENSE) {
  const base = normalizeText(normalizedText);
  const found = CATEGORY_HINTS.find((item) => base.includes(item.key))?.category;
  if (found) return found;
  if (
    type === TransactionType.INCOME &&
    (base.includes("cliente") || base.includes("pagou") || base.includes("corte") || base.includes("servico"))
  ) {
    return "servicos";
  }
  if (type === TransactionType.INCOME) return "nao_aplicavel";
  if (type === TransactionType.EXPENSE) return "outros";
  return undefined;
}

function detectPayment(normalizedText: string): { paymentMethod?: PaymentMethod; paymentLabel?: ParsedVoiceCommand["paymentLabel"] } {
  const base = normalizeText(normalizedText);
  if (base.includes("pix")) return { paymentMethod: "pix", paymentLabel: "Pix" };
  if (base.includes("cartao de credito") || base.includes("credito")) {
    return { paymentMethod: "credito", paymentLabel: "Crédito" };
  }
  if (base.includes("cartao de debito") || base.includes("debito")) {
    return { paymentMethod: "debito", paymentLabel: "Débito" };
  }
  if (base.includes("dinheiro")) return { paymentMethod: "dinheiro", paymentLabel: "Dinheiro" };
  if (base.includes("transferencia")) {
    return { paymentMethod: "transferencia", paymentLabel: "Transferência" };
  }
  if (base.includes("boleto")) {
    return { paymentMethod: "transferencia", paymentLabel: "Boleto" };
  }
  return {};
}

function extractSubject(normalizedText: string) {
  const base = normalizeText(normalizedText);
  const fromDe = base.match(/\bde\s+([a-z0-9\s]+)/)?.[1];
  const fromCom = base.match(/\bcom\s+([a-z0-9\s]+)/)?.[1];
  const fromPara = base.match(/\bpara\s+([a-z0-9\s]+)/)?.[1];
  const subject = (fromDe ?? fromCom ?? fromPara ?? "").trim();
  return subject;
}

function sanitizeClientCandidate(candidate: string) {
  const cleaned = normalizeText(candidate);
  if (!cleaned) return undefined;

  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const token of tokens) {
    if (CLIENT_STOP_WORDS.has(token) && kept.length > 0) break;
    if (CLIENT_STOP_WORDS.has(token) && kept.length === 0) continue;
    if (/^\d+$/.test(token)) continue;
    kept.push(token);
    if (kept.length >= 4) break;
  }

  if (kept.length === 0) return undefined;
  const name = toNameCase(kept.join(" "));
  return name.length >= 2 ? name : undefined;
}

function extractClientName(normalizedText: string) {
  const base = normalizeText(normalizedText);
  const patterns = [
    /\b(?:o\s+)?cliente\s+([a-z0-9\s]+?)(?=\s+(?:pagou|recebeu|fez|cortou|deu|no|na|em|r|r\$|\d)|$)/,
    /\b([a-z0-9]+(?:\s+[a-z0-9]+)?)\s+pagou\b/,
    /\b(?:do|de|com)\s+(?:o\s+)?cliente\s+([a-z0-9\s]+)/,
    /\bda\s+cliente\s+([a-z0-9\s]+)/,
    /\bcliente\s+([a-z0-9\s]+)/,
    /\brecebi\s+do\s+([a-z0-9\s]+)/,
    /\brecebi\s+da\s+([a-z0-9\s]+)/,
    /\bentrou\s+do\s+([a-z0-9\s]+)/,
    /\bentrou\s+da\s+([a-z0-9\s]+)/,
    /\b(?:recebi|entrou|ganhei|caiu)\b.*?\bdo\s+([a-z0-9\s]+)/,
    /\b(?:recebi|entrou|ganhei|caiu)\b.*?\bda\s+([a-z0-9\s]+)/,
  ];

  for (const pattern of patterns) {
    const matched = base.match(pattern)?.[1];
    if (!matched) continue;
    const sanitized = sanitizeClientCandidate(matched);
    if (sanitized) return sanitized;
  }

  return undefined;
}

function buildDescription(params: {
  type?: TransactionType.INCOME | TransactionType.EXPENSE;
  paymentLabel?: ParsedVoiceCommand["paymentLabel"];
  subject: string;
  amount?: number;
  clientName?: string;
}) {
  const { type, paymentLabel, subject, amount, clientName } = params;
  const amountLabel = amount ? `R$ ${amount.toFixed(2).replace(".", ",")}` : undefined;
  const paymentLabelLower = paymentLabel ? paymentLabel.toLowerCase() : "";

  if (type === TransactionType.INCOME) {
    if (clientName && amountLabel) {
      return `Cliente ${clientName} pagou ${amountLabel}${paymentLabelLower ? ` no ${paymentLabelLower}` : ""}`;
    }
    if (paymentLabel === "Pix") return "Recebimento via Pix";
    if (paymentLabel === "Dinheiro") return "Recebimento em dinheiro";
    if (paymentLabel === "Crédito") return "Recebimento via cartão de crédito";
    if (paymentLabel === "Débito") return "Recebimento via cartão de débito";
    if (paymentLabel === "Transferência") return "Recebimento via transferência";
    if (paymentLabel === "Boleto") return "Recebimento via boleto";
    return "Recebimento";
  }

  if (type === TransactionType.EXPENSE) {
    if (subject && paymentLabel) {
      return `Pagamento via ${paymentLabel} no ${subject}`;
    }
    if (subject) return `Pagamento de ${subject}`;
    if (paymentLabel) return `Pagamento via ${paymentLabel}`;
    return "Pagamento";
  }

  return undefined;
}

function buildCorrectedDisplayText(params: {
  correctedRaw: string;
  type?: TransactionType.INCOME | TransactionType.EXPENSE;
  amount?: number;
  paymentLabel?: ParsedVoiceCommand["paymentLabel"];
  subject: string;
}) {
  const { correctedRaw, type, amount, paymentLabel, subject } = params;
  if (!type || !amount) return toSentenceCase(correctedRaw);

  const verb = type === TransactionType.INCOME ? "Entrou" : "Saiu";
  const money = `R$ ${amount.toFixed(2).replace(".", ",")}`;
  const payPart = paymentLabel ? ` no ${paymentLabel}` : "";
  const subjectPart = subject ? ` de ${subject}` : "";

  return toSentenceCase(`${verb} ${money}${subjectPart}${payPart}`.replace(/\s+/g, " ").trim());
}

export function parseFinancialVoiceCommand(text: string): ParsedVoiceCommand {
  const normalizedText = normalizeText(text);
  const correctedRaw = applySpellingCorrections(normalizedText);

  const type = detectType(correctedRaw);
  const amount = extractAmount(correctedRaw);
  const category = detectCategory(correctedRaw, type);
  const { paymentMethod, paymentLabel } = detectPayment(correctedRaw);
  const areaHint = detectArea(correctedRaw);
  const subject = extractSubject(correctedRaw);
  const clientName = extractClientName(correctedRaw);
  const description = buildDescription({ type, paymentLabel, subject, amount, clientName });
  const correctedText = buildCorrectedDisplayText({
    correctedRaw,
    type,
    amount,
    paymentLabel,
    subject,
  });

  const missingFields: string[] = [];
  if (!type) missingFields.push("tipo");
  if (!amount) missingFields.push("valor");

  const ambiguous = missingFields.length > 0;
  const summary = !ambiguous
    ? `${type === TransactionType.INCOME ? "Entrada" : "Saída"} de R$ ${amount?.toFixed(2).replace(".", ",")}`
    : "Comando com informações incompletas";

  return {
    rawText: text,
    correctedText,
    normalizedText: correctedRaw,
    type,
    amount,
    category,
    description,
    date: todayIso(),
    paymentMethod,
    paymentLabel,
    clientName,
    customerName: clientName,
    areaHint,
    missingFields,
    ambiguous,
    summary,
  };
}
