import {
  AdjustmentAccount,
  Cost,
  PaymentAccount,
  Pot,
  PotDistribution,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { getTransactionFeeAmount, getTransactionGrossAmount } from "@/lib/finance";

export type FluxFinancialState =
  | "SEM_DADOS"
  | "DESORGANIZADO"
  | "SOBREVIVENDO"
  | "CONTROLADO"
  | "EVOLUINDO"
  | "PERFORMANDO";

export type FluxAdvisorContext = {
  transactions?: Transaction[] | null;
  costs?: Cost[] | null;
  pots?: Pot[] | null;
  paymentAccounts?: PaymentAccount[] | null;
  adjustmentAccounts?: AdjustmentAccount[] | null;
  potDistribution?: Partial<PotDistribution> | null;
  metaMensal?: number | null;
  monthlyGoal?: number | null;
  reserveRequired?: number | null;
  protectedCommitments?: number | null;
};

export type FluxPromptContext = {
  entradasReais: number;
  saidasReais: number;
  taxas: number;
  custos: number;
  lucroLiquido: number;
  disponivelHoje: number;
  reserva: number;
  metaMensal: number;
  estado: FluxFinancialState;
  alertaPrincipal: string;
  acaoSugerida: string;
};

export type FluxQuestionIntent =
  | "FATURAMENTO_HOJE"
  | "CAIXA_ATUAL"
  | "POSSO_GASTAR"
  | "META"
  | "LUCRO"
  | "PERDENDO_DINHEIRO"
  | "RESERVA"
  | "COMPROMISSO_FUTURO"
  | "PRECIFICACAO"
  | "PLANEJAMENTO"
  | "FINANCAS_GERAIS";

export type FluxQuestionAnswer = {
  intent: FluxQuestionIntent;
  answer: string;
  severity: "safe" | "attention" | "risk";
  suggestedAction: string;
  requiresSpecificNumbers: boolean;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.max(0, value).toFixed(2));
}

function getTransactions(context: FluxAdvisorContext) {
  return Array.isArray(context.transactions) ? context.transactions : [];
}

function formatCurrencyBR(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(roundMoney(value));
}

function normalizeQuestion(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCurrencyValue(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const moneyMatch = normalized.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/i);
  if (moneyMatch) {
    const integerPart = moneyMatch[1].replace(/\./g, "");
    const decimalPart = moneyMatch[2] ? moneyMatch[2].padEnd(2, "0") : "00";
    const parsed = Number(`${integerPart}.${decimalPart}`);
    return Number.isFinite(parsed) ? roundMoney(parsed) : null;
  }

  const simpleWords = normalizeQuestion(text);
  if (/mil cento e cinquenta/.test(simpleWords)) return 1150;
  if (/mil/.test(simpleWords)) return 1000;
  return null;
}

export function extractDate(text: string, now = new Date()) {
  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const rawYear = slashMatch[3];
    let year = rawYear ? Number(rawYear) : now.getFullYear();
    if (year < 100) year += 2000;
    let date = new Date(year, month - 1, day);
    if (!rawYear && date.getTime() < startOfLocalDay(now).getTime()) {
      date = new Date(year + 1, month - 1, day);
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dayMatch = normalizeQuestion(text).match(/\bdia\s+(\d{1,2})\b/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    let date = new Date(now.getFullYear(), now.getMonth(), day);
    if (date.getTime() < startOfLocalDay(now).getTime()) {
      date = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatShortDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysUntil(date: Date, now = new Date()) {
  const diff = startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function extractCommitmentDescription(text: string) {
  const normalized = normalizeQuestion(text);
  const known = ["aluguel", "boleto", "conta", "energia", "luz", "internet", "cartao", "imposto", "fornecedor"];
  return known.find((item) => normalized.includes(item)) ?? "essa conta";
}

function parseDateSafe(value?: string) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameLocalDay(date: Date, target: Date) {
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function getRealIncomeTransactions(context: FluxAdvisorContext) {
  return getTransactions(context).filter((transaction) => {
    if (transaction.type !== TransactionType.INCOME) return false;
    if (transaction.paymentStatus === "pendente" || transaction.paymentStatus === "cancelado") return false;
    return true;
  });
}

function calculateGrossRealIncome(context: FluxAdvisorContext) {
  return roundMoney(
    getRealIncomeTransactions(context).reduce((sum, transaction) => sum + getTransactionGrossAmount(transaction), 0)
  );
}

function calculateGrossRealIncomeToday(context: FluxAdvisorContext, now = new Date()) {
  return roundMoney(
    getRealIncomeTransactions(context)
      .filter((transaction) => {
        const parsed = parseDateSafe(transaction.paidAt ?? transaction.date);
        return parsed ? isSameLocalDay(parsed, now) : false;
      })
      .reduce((sum, transaction) => sum + getTransactionGrossAmount(transaction), 0)
  );
}

function calculateFees(context: FluxAdvisorContext) {
  return roundMoney(
    getRealIncomeTransactions(context).reduce((sum, transaction) => sum + getTransactionFeeAmount(transaction), 0)
  );
}

function calculateRealExpenses(context: FluxAdvisorContext) {
  return roundMoney(
    getTransactions(context)
      .filter((transaction) => transaction.type === TransactionType.EXPENSE)
      .reduce((sum, transaction) => sum + safeNumber(transaction.amount), 0)
  );
}

const OPERATIONAL_EXPENSE_CATEGORIES = new Set(["custos", "custo", "insumos", "ferramentas", "fornecedores"]);

function normalizeCostMatchText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDateKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const timestamp = new Date(text).getTime();
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  return text.slice(0, 10);
}

function buildCostFingerprint(input: Pick<Cost, "name" | "amount" | "category" | "date">) {
  return [
    normalizeCostMatchText(input.name),
    safeNumber(input.amount).toFixed(2),
    normalizeCostMatchText(input.category),
    normalizeDateKey(input.date),
  ].join("|");
}

function buildTransactionCostFingerprint(transaction: Transaction) {
  return [
    normalizeCostMatchText(transaction.description),
    safeNumber(transaction.amount).toFixed(2),
    normalizeCostMatchText(transaction.category),
    normalizeDateKey(transaction.date),
  ].join("|");
}

function getTransactionLinkedCostId(transaction: Transaction) {
  const extended = transaction as Transaction & {
    sourceId?: unknown;
    costId?: unknown;
    source?: unknown;
  };

  const directId = extended.sourceId ?? extended.costId;
  if (typeof directId === "string" && directId.trim()) return directId.trim();

  const source = typeof extended.source === "string" ? extended.source : "";
  const sourceMatch = source.match(/cost[:/_-]([\w-]+)/i);
  if (sourceMatch?.[1]) return sourceMatch[1];

  const origin = typeof transaction.origin === "string" ? transaction.origin : "";
  const originMatch = origin.match(/cost[:/_-]([\w-]+)/i);
  return originMatch?.[1] ?? null;
}

function isOperationalExpenseTransaction(transaction: Transaction) {
  return (
    transaction.type === TransactionType.EXPENSE &&
    OPERATIONAL_EXPENSE_CATEGORIES.has(normalizeCostMatchText(transaction.category))
  );
}

function getPaidCosts(context: FluxAdvisorContext) {
  if (!Array.isArray(context.costs)) return [];

  const seenIds = new Set<string>();
  return context.costs.filter((cost) => {
    if (cost.status === "pendente") return false;
    if (!cost.id) return true;
    if (seenIds.has(cost.id)) return false;
    seenIds.add(cost.id);
    return true;
  });
}

function calculateNonOperationalExpenses(context: FluxAdvisorContext) {
  return roundMoney(
    getTransactions(context)
      .filter((transaction) => transaction.type === TransactionType.EXPENSE)
      .filter((transaction) => !isOperationalExpenseTransaction(transaction))
      .reduce((sum, transaction) => sum + safeNumber(transaction.amount), 0)
  );
}

function getUniqueOperationalCostTotal(context: FluxAdvisorContext) {
  const paidCosts = getPaidCosts(context);
  const knownCostIds = new Set(paidCosts.map((cost) => cost.id).filter(Boolean));
  const knownCostFingerprints = new Set(paidCosts.map(buildCostFingerprint));

  const directCosts = paidCosts.reduce((sum, cost) => sum + safeNumber(cost.amount), 0);

  const operationalExpenses = getTransactions(context)
    .filter(isOperationalExpenseTransaction)
    .filter((transaction) => {
      const linkedCostId = getTransactionLinkedCostId(transaction);
      if (linkedCostId && knownCostIds.has(linkedCostId)) return false;

      return !knownCostFingerprints.has(buildTransactionCostFingerprint(transaction));
    })
    .reduce((sum, transaction) => sum + safeNumber(transaction.amount), 0);

  return roundMoney(directCosts + operationalExpenses);
}

function calculateOperationalCosts(context: FluxAdvisorContext) {
  return getUniqueOperationalCostTotal(context);
}

function calculateReserveValue(context: FluxAdvisorContext) {
  const pots = Array.isArray(context.pots) ? context.pots : [];
  return roundMoney(
    pots
      .filter((pot) => pot.type === "reserva" || pot.name.toLowerCase().includes("reserv"))
      .reduce((sum, pot) => sum + safeNumber(pot.balance), 0)
  );
}

function calculateCurrentRealCash(context: FluxAdvisorContext) {
  const pots = Array.isArray(context.pots) ? context.pots : [];
  const potBalance = roundMoney(pots.reduce((sum, pot) => sum + safeNumber(pot.balance), 0));
  if (potBalance > 0) return potBalance;

  const grossIncome = calculateGrossRealIncome(context);
  if (grossIncome <= 0) return 0;

  const fees = calculateFees(context);
  const expenses = calculateNonOperationalExpenses(context);
  const operationalCosts = calculateOperationalCosts(context);

  return roundMoney(grossIncome - fees - expenses - operationalCosts);
}

function calculateProtectedCommitments(context: FluxAdvisorContext) {
  const explicit = safeNumber(context.protectedCommitments);
  if (explicit > 0) return explicit;

  const paymentAccounts = Array.isArray(context.paymentAccounts) ? context.paymentAccounts : [];
  const paymentCommitments = paymentAccounts
    .filter((account) => account.status !== "pago")
    .reduce((sum, account) => sum + safeNumber(account.amount), 0);

  const adjustmentAccounts = Array.isArray(context.adjustmentAccounts) ? context.adjustmentAccounts : [];
  const adjustmentCommitments = adjustmentAccounts
    .filter((account) => account.status !== "pago")
    .reduce((sum, account) => sum + safeNumber(account.amount), 0);

  return roundMoney(paymentCommitments + adjustmentCommitments);
}

function calculateReserveRequired(context: FluxAdvisorContext, netProfit: number) {
  const explicit = safeNumber(context.reserveRequired);
  if (explicit > 0) return explicit;

  const reservePercent = safeNumber(context.potDistribution?.reserve);
  if (reservePercent <= 0 || netProfit <= 0) return 0;

  return roundMoney(netProfit * (reservePercent / 100));
}

function calculateProtectedCashForCommitments(context: FluxAdvisorContext) {
  const netProfit = calculateNetProfit(context);
  const reserveValue = calculateReserveValue(context);
  const protectedCommitments = calculateProtectedCommitments(context);
  const protectedGoals = calculateReserveRequired(context, netProfit);

  return roundMoney(reserveValue + protectedCommitments + protectedGoals);
}

function calculateUsableCashForFutureCommitment(context: FluxAdvisorContext) {
  const realCash = calculateCurrentRealCash(context);
  if (realCash <= 0) return 0;

  const protectedCash = calculateProtectedCashForCommitments(context);
  return roundMoney(realCash - protectedCash);
}

export function calculateNetProfit(context: FluxAdvisorContext) {
  const grossIncome = calculateGrossRealIncome(context);
  if (grossIncome <= 0) return 0;

  const fees = calculateFees(context);
  const operationalCosts = calculateOperationalCosts(context);

  return roundMoney(grossIncome - fees - operationalCosts);
}

export function calculateAvailableToday(context: FluxAdvisorContext) {
  const grossIncome = calculateGrossRealIncome(context);
  if (grossIncome <= 0) return 0;

  const netProfit = calculateNetProfit(context);
  const reserveRequired = calculateReserveRequired(context, netProfit);
  const protectedCommitments = calculateProtectedCommitments(context);

  return roundMoney(netProfit - reserveRequired - protectedCommitments);
}

export function getUserFinancialState(context: FluxAdvisorContext): FluxFinancialState {
  const grossIncome = calculateGrossRealIncome(context);
  if (grossIncome <= 0) return "SEM_DADOS";

  const netProfit = calculateNetProfit(context);
  const availableToday = calculateAvailableToday(context);
  const expenses = calculateNonOperationalExpenses(context);
  const costs = calculateOperationalCosts(context);
  const reserve = calculateReserveValue(context);
  const highSpending = expenses + costs >= grossIncome * 0.7;
  const reserveHealthy = reserve >= Math.max(grossIncome * 0.2, 1);
  const costsControlled = costs <= grossIncome * 0.35;

  if (netProfit <= 0 || (availableToday <= 0 && highSpending)) return "SOBREVIVENDO";
  if (availableToday <= 0) return "DESORGANIZADO";
  if (!reserveHealthy) return "CONTROLADO";
  if (availableToday > 0 && (!costsControlled || reserve < grossIncome * 0.5)) return "EVOLUINDO";
  return "PERFORMANDO";
}

export function generateLocalInsight(state: FluxFinancialState, context: FluxAdvisorContext) {
  const availableToday = calculateAvailableToday(context);
  const netProfit = calculateNetProfit(context);

  if (state === "SEM_DADOS") return "Sem entrada, você tá no escuro.";
  if (state === "SOBREVIVENDO") return "Seu dinheiro tá indo embora rápido.";
  if (state === "DESORGANIZADO") return "Tem dinheiro entrando, mas ele ainda não está protegido.";
  if (state === "CONTROLADO") return "Você tá no caminho certo.";
  if (state === "EVOLUINDO") return "Agora você começou a ganhar controle real.";
  if (state === "PERFORMANDO") return "Agora você tá jogando o jogo certo.";

  return netProfit > 0 && availableToday > 0
    ? "Seu dinheiro começou a trabalhar com mais clareza."
    : "Ainda falta dado real para uma análise segura.";
}

export function generateLocalAction(state: FluxFinancialState, context: FluxAdvisorContext) {
  const availableToday = calculateAvailableToday(context);

  if (state === "SEM_DADOS") return "Registre sua primeira entrada.";
  if (state === "SOBREVIVENDO") return "Segure os gastos hoje.";
  if (state === "DESORGANIZADO") return "Separe compromissos antes de gastar.";
  if (state === "CONTROLADO") return "Não mexa na reserva sem necessidade.";
  if (state === "EVOLUINDO") return "Reforce sua reserva na próxima entrada.";
  if (state === "PERFORMANDO") return "Revise margem e pense em crescer.";

  return availableToday > 0 ? "Use só o dinheiro livre." : "Registre mais dados reais.";
}

function detectFluxQuestionIntent(question: string): FluxQuestionIntent {
  const text = normalizeQuestion(question);

  if (
    /(pagar|aluguel|conta|boleto|vence|vencimento|dia|preciso fazer|quanto tenho que fazer|quanto preciso faturar|preciso juntar|falta para pagar)/.test(
      text
    )
  ) {
    return "COMPROMISSO_FUTURO";
  }
  if (/(faturei hoje|faturamento hoje|quanto entrou hoje|entrada hoje|ganhei hoje)/.test(text)) {
    return "FATURAMENTO_HOJE";
  }
  if (/(quanto tenho em caixa|caixa|saldo|tenho agora|dinheiro disponivel)/.test(text)) {
    return "CAIXA_ATUAL";
  }
  if (/(posso gastar|da pra gastar|d[aá] pra gastar|posso comprar|posso pagar)/.test(text)) {
    return "POSSO_GASTAR";
  }
  if (/(quanto falta pra meta|quanto falta para meta|meta|objetivo)/.test(text)) {
    return "META";
  }
  if (/(lucro|melhorar lucro|margem|ganhar mais)/.test(text)) {
    return "LUCRO";
  }
  if (/(perdendo dinheiro|gastando mais|vazando|onde estou gastando)/.test(text)) {
    return "PERDENDO_DINHEIRO";
  }
  if (/(reserva|montar reserva|emergencia|emergencia)/.test(text)) {
    return "RESERVA";
  }
  if (/(preco|preço|precificar|precificacao|precificação|cobrar|valor do servico|valor do serviço)/.test(text)) {
    return "PRECIFICACAO";
  }
  if (/(planejar|planejamento|parcelar|vale a pena|comprar|investir|maquina|máquina|aperto|sair do aperto)/.test(text)) {
    return "PLANEJAMENTO";
  }

  return "FINANCAS_GERAIS";
}

export function answerFluxQuestion(question: string, context: FluxAdvisorContext, now = new Date()): FluxQuestionAnswer {
  const intent = detectFluxQuestionIntent(question);
  const promptContext = buildFluxPromptContext(context);

  if (intent === "COMPROMISSO_FUTURO") {
    const valorCompromisso = extractCurrencyValue(question);
    const dataCompromisso = extractDate(question, now);
    const descricao = extractCommitmentDescription(question);
    const caixaAtual = calculateCurrentRealCash(context);
    const dinheiroUsavelParaCompromisso = calculateUsableCashForFutureCommitment(context);

    if (!valorCompromisso || valorCompromisso <= 0) {
      return {
        intent,
        answer: "Entendi que existe uma conta futura, mas faltou o valor.",
        severity: "attention",
        suggestedAction: "Me diga o valor da conta para eu calcular quanto precisa fazer.",
        requiresSpecificNumbers: true,
      };
    }

    const faltante = roundMoney(Math.max(0, valorCompromisso - dinheiroUsavelParaCompromisso));
    if (!dataCompromisso) {
      return {
        intent,
        answer:
          faltante > 0
            ? `Faltam ${formatCurrencyBR(faltante)} para pagar ${descricao}.`
            : `Você já tem esse valor protegido para pagar ${descricao}.`,
        severity: faltante > 0 ? "attention" : "safe",
        suggestedAction: "Me diga a data de vencimento que eu calculo quanto precisa fazer por dia.",
        requiresSpecificNumbers: true,
      };
    }

    const diasRestantes = getDaysUntil(dataCompromisso, now);
    const necessarioPorDia = roundMoney(faltante / diasRestantes);
    if (faltante <= 0) {
      return {
        intent,
        answer: `Você precisa garantir ${formatCurrencyBR(valorCompromisso)} até ${formatShortDate(
          dataCompromisso
        )} para pagar ${descricao}.`,
        severity: "safe",
        suggestedAction: "Você já tem esse valor protegido. Só não usa em outra coisa.",
        requiresSpecificNumbers: true,
      };
    }

    return {
      intent,
      answer:
        caixaAtual > 0
          ? `Você precisa garantir ${formatCurrencyBR(valorCompromisso)} até ${formatShortDate(
              dataCompromisso
            )} para pagar ${descricao}. Pelo dinheiro livre depois de proteger reserva e compromissos, faltam ${formatCurrencyBR(faltante)}. Isso dá cerca de ${formatCurrencyBR(
              necessarioPorDia
            )} por dia até lá.`
          : `Você ainda não tem caixa registrado para ${descricao}. Precisa fazer ${formatCurrencyBR(
              valorCompromisso
            )} até ${formatShortDate(dataCompromisso)}. Isso dá cerca de ${formatCurrencyBR(necessarioPorDia)} por dia até lá.`,
      severity: "attention",
      suggestedAction: "Trate esse valor como intocável e registre as próximas entradas.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "FATURAMENTO_HOJE") {
    const entradaHoje = calculateGrossRealIncomeToday(context, now);
    if (entradaHoje > 0) {
      return {
        intent,
        answer: `Hoje entrou ${formatCurrencyBR(entradaHoje)}.`,
        severity: "safe",
        suggestedAction: "Agora separa os potes antes de pensar em gastar.",
        requiresSpecificNumbers: true,
      };
    }
    return {
      intent,
      answer: "Hoje ainda não entrou nada registrado.",
      severity: "attention",
      suggestedAction: "Registre a entrada de hoje para eu calcular certinho.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "CAIXA_ATUAL") {
    const caixaAtual = calculateCurrentRealCash(context);
    return {
      intent,
      answer:
        caixaAtual > 0
          ? `Seu caixa real agora é ${formatCurrencyBR(caixaAtual)}.`
          : "Seu caixa real agora é R$ 0,00. Sem entrada registrada, eu não invento dinheiro.",
      severity: caixaAtual > 0 ? "safe" : "attention",
      suggestedAction: caixaAtual > 0 ? "Use esse número como base real antes de assumir novos gastos." : "Registre entradas reais para eu calcular seu caixa.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "POSSO_GASTAR") {
    const requestedSpend = extractCurrencyValue(question);
    if (promptContext.disponivelHoje <= 0) {
      return {
        intent,
        answer: "Hoje não. Você não tem dinheiro livre sem comprometer seu plano.",
        severity: "risk",
        suggestedAction: "Registre entradas reais ou segure esse gasto.",
        requiresSpecificNumbers: true,
      };
    }
    if (requestedSpend && requestedSpend > promptContext.disponivelHoje) {
      return {
        intent,
        answer: `Hoje não é seguro gastar ${formatCurrencyBR(requestedSpend)}. Seu limite livre é ${formatCurrencyBR(
          promptContext.disponivelHoje
        )}.`,
        severity: "risk",
        suggestedAction: "Se for obrigatório, registre a entrada ou corte outro compromisso antes.",
        requiresSpecificNumbers: true,
      };
    }
    return {
      intent,
      answer: requestedSpend
        ? `Pode gastar ${formatCurrencyBR(requestedSpend)}, porque seu limite livre hoje é ${formatCurrencyBR(
            promptContext.disponivelHoje
          )}.`
        : `Pode, mas com limite: até ${formatCurrencyBR(promptContext.disponivelHoje)} hoje.`,
      severity: "safe",
      suggestedAction: "Passou disso, começa a comprometer seu plano.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "META") {
    if (promptContext.metaMensal > 0) {
      const missing = roundMoney(Math.max(0, promptContext.metaMensal - promptContext.lucroLiquido));
      return {
        intent,
        answer: `Faltam ${formatCurrencyBR(missing)} para sua meta mensal.`,
        severity: missing > 0 ? "attention" : "safe",
        suggestedAction: "Foca em aumentar entradas ou reduzir custos nessa semana.",
        requiresSpecificNumbers: true,
      };
    }
    return {
      intent,
      answer: "Você ainda não definiu uma meta mensal.",
      severity: "attention",
      suggestedAction: "Defina uma meta nos Ajustes para eu acompanhar.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "LUCRO") {
    const pressure = promptContext.taxas + promptContext.custos;
    const pressureHigh = promptContext.entradasReais > 0 && pressure >= promptContext.entradasReais * 0.18;
    return {
      intent,
      answer: `Seu lucro líquido é ${formatCurrencyBR(promptContext.lucroLiquido)}.`,
      severity: promptContext.lucroLiquido > 0 ? "safe" : "risk",
      suggestedAction: pressureHigh
        ? "Revise taxas e custos primeiro."
        : "Agora o próximo passo é aumentar margem nos serviços/produtos.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "PERDENDO_DINHEIRO") {
    const villains = [
      { label: "saídas", value: promptContext.saidasReais },
      { label: "custos", value: promptContext.custos },
      { label: "taxas", value: promptContext.taxas },
    ].sort((a, b) => b.value - a.value);
    const top = villains[0];

    if (!top || top.value <= 0) {
      return {
        intent,
        answer: "Ainda não dá pra ver onde o dinheiro está vazando.",
        severity: "attention",
        suggestedAction: "Registre entradas e saídas por alguns dias.",
        requiresSpecificNumbers: true,
      };
    }

    return {
      intent,
      answer: `O maior vilão agora são ${top.label}: ${formatCurrencyBR(top.value)}.`,
      severity: top.label === "saídas" ? "risk" : "attention",
      suggestedAction: `Comece revisando ${top.label} antes de cortar qualquer outra coisa.`,
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "RESERVA") {
    if (promptContext.reserva <= 0) {
      return {
        intent,
        answer: "Sua reserva ainda está zerada.",
        severity: "attention",
        suggestedAction: "Separe um pedaço pequeno da próxima entrada.",
        requiresSpecificNumbers: true,
      };
    }
    return {
      intent,
      answer: `Sua reserva atual é ${formatCurrencyBR(promptContext.reserva)}.`,
      severity: "safe",
      suggestedAction: "Continua reforçando antes de aumentar gastos.",
      requiresSpecificNumbers: true,
    };
  }

  if (intent === "PRECIFICACAO") {
    return {
      intent,
      answer:
        promptContext.lucroLiquido > 0
          ? `Sua base atual mostra lucro líquido de ${formatCurrencyBR(promptContext.lucroLiquido)}. Para precificar melhor, olhe custo, taxa e margem antes de dar desconto.`
          : "Para precificar sem chute, eu preciso que você registre entradas, taxas e custos do serviço/produto.",
      severity: promptContext.lucroLiquido > 0 ? "safe" : "attention",
      suggestedAction: "Me diga o custo e o preço de venda que eu calculo a margem.",
      requiresSpecificNumbers: false,
    };
  }

  if (intent === "PLANEJAMENTO") {
    return {
      intent,
      answer:
        promptContext.disponivelHoje > 0
          ? `Seu dinheiro livre hoje é ${formatCurrencyBR(promptContext.disponivelHoje)}. Qualquer compra ou parcela precisa caber dentro disso sem tocar reserva.`
          : "Primeiro separa o essencial do que pode esperar. Pelo seu caixa atual, eu começaria travando gastos e registrando tudo que entra hoje.",
      severity: promptContext.disponivelHoje > 0 ? "safe" : "attention",
      suggestedAction: "Se for uma compra grande, me diga valor e data para eu calcular o impacto.",
      requiresSpecificNumbers: false,
    };
  }

  const state = getUserFinancialState(context);
  return {
    intent,
    answer:
      promptContext.entradasReais > 0
        ? `Pelo que você registrou, entraram ${formatCurrencyBR(promptContext.entradasReais)} e seu lucro líquido está em ${formatCurrencyBR(
            promptContext.lucroLiquido
          )}.`
        : "Ainda falta dinheiro real registrado para eu calcular com precisão.",
    severity: state === "SOBREVIVENDO" || state === "DESORGANIZADO" ? "risk" : state === "SEM_DADOS" ? "attention" : "safe",
    suggestedAction:
      state === "SEM_DADOS"
        ? "Registre sua primeira entrada ou me diga valor e data do compromisso."
        : "Me diga o valor, a data ou a conta que você quer analisar.",
    requiresSpecificNumbers: false,
  };
}

export function buildFluxPromptContext(context: FluxAdvisorContext): FluxPromptContext {
  const entradasReais = calculateGrossRealIncome(context);
  const saidasReais = calculateRealExpenses(context);
  const taxas = calculateFees(context);
  const custos = calculateOperationalCosts(context);
  const lucroLiquido = calculateNetProfit(context);
  const disponivelHoje = calculateAvailableToday(context);
  const reserva = calculateReserveValue(context);
  const metaMensal = safeNumber(context.metaMensal ?? context.monthlyGoal);
  const estado = getUserFinancialState(context);

  return {
    entradasReais,
    saidasReais,
    taxas,
    custos,
    lucroLiquido,
    disponivelHoje,
    reserva,
    metaMensal,
    estado,
    alertaPrincipal: generateLocalInsight(estado, context),
    acaoSugerida: generateLocalAction(estado, context),
  };
}
