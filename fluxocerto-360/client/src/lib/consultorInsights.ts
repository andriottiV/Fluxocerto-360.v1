import {
  Client,
  Cost,
  OnboardingFixedExpenseInput,
  PaymentAccount,
  Pot,
  PotType,
  SalesItem,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { calculateCashflowForecast, formatCurrency, getCashRiskLevel, getMonthlyComparison } from "@/lib/cashflowForecast";
import { getTransactionNetAmount } from "@/lib/finance";

export type SmartNotification = {
  id: string;
  title: string;
  message: string;
  level: "critical" | "moderate" | "positive" | "info";
  read: boolean;
};

export type ProactiveInsightLevel = "positive" | "attention" | "critical";

export type ProactiveInsight = {
  id: string;
  kind:
    | "cashRisk"
    | "expenseIncrease"
    | "revenueDrop"
    | "clientRetention"
    | "goalProgress"
    | "lowMargin"
    | "lowStock"
    | "opportunity";
  title: string;
  message: string;
  level: ProactiveInsightLevel;
  impactEstimate: string;
  suggestedAction: string;
  actionLabel?: string;
  actionQuestion?: string;
};

export const notificationRules = [
  "risk_negative_balance",
  "expenses_rising",
  "goal_nearby",
  "bill_due_soon",
  "revenue_drop",
] as const;

type InsightParams = {
  transactions: Transaction[];
  pots: Pot[];
  paymentAccounts?: PaymentAccount[];
  fixedExpenses?: OnboardingFixedExpenseInput[];
  clients?: Client[];
  salesItems?: SalesItem[];
  costs?: Cost[];
};

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDaysLabel(days: number) {
  if (days <= 0) return "hoje";
  if (days === 1) return "em 1 dia";
  return `em ${days} dias`;
}

function monthCategoryTotals(transactions: Transaction[], monthShift = 0) {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - monthShift, 1);
  const month = targetMonth.getMonth();
  const year = targetMonth.getFullYear();

  const totals = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.type !== TransactionType.EXPENSE) return;
    const date = toDate(tx.date);
    if (!date) return;
    if (date.getMonth() !== month || date.getFullYear() !== year) return;
    const key = normalizeText(tx.category || "outros");
    totals.set(key, (totals.get(key) ?? 0) + Math.max(0, tx.amount));
  });
  return totals;
}

function buildPendingBills(paymentAccounts: PaymentAccount[]) {
  const today = new Date();
  return paymentAccounts.map((bill) => {
    const due = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(28, bill.dueDate)));
    return {
      amount: bill.amount,
      status: bill.status,
      dueDate: due.toISOString().slice(0, 10),
    };
  });
}

function estimateNet30(transactions: Transaction[]) {
  const limit = new Date();
  limit.setDate(limit.getDate() - 30);
  return transactions
    .filter((tx) => {
      const parsed = toDate(tx.date);
      return !!parsed && parsed >= limit;
    })
    .reduce((sum, tx) => sum + (tx.type === TransactionType.INCOME ? getTransactionNetAmount(tx) : 0), 0);
}

function toInsightLevelNotification(level: ProactiveInsightLevel): SmartNotification["level"] {
  if (level === "critical") return "critical";
  if (level === "attention") return "moderate";
  return "positive";
}

export function calculateGoalProgress(currentValue: number, goalValue: number) {
  if (!Number.isFinite(goalValue) || goalValue <= 0) return 0;
  return Math.max(0, Math.min((currentValue / goalValue) * 100, 999));
}

export function estimateDaysToGoal(remainingValue: number, dailyContribution: number) {
  if (!Number.isFinite(remainingValue) || remainingValue <= 0) return 0;
  if (!Number.isFinite(dailyContribution) || dailyContribution <= 0) return null;
  return Math.ceil(remainingValue / dailyContribution);
}

export function generateGoalInsights(params: { pots: Pot[]; transactions: Transaction[] }) {
  const { pots, transactions } = params;
  const reservePot = pots.find((pot) => pot.type === PotType.RESERVE) ?? pots.find((pot) => pot.name.toLowerCase().includes("reserv"));
  if (!reservePot || !reservePot.goalValue || reservePot.goalValue <= 0) {
    return ["Você ainda não configurou metas. Quer criar uma meta de reserva de emergência?"];
  }

  const progress = calculateGoalProgress(reservePot.balance, reservePot.goalValue);
  const remaining = Math.max(0, reservePot.goalValue - reservePot.balance);
  const net30 = estimateNet30(transactions);
  const estimatedDays = estimateDaysToGoal(remaining, Math.max(0, net30 / 30));

  const insights = [`Você já atingiu ${progress.toFixed(0)}% da sua reserva de emergência.`];
  if (remaining > 0) insights.push(`Faltam ${formatCurrency(remaining)} para bater sua meta.`);
  if (estimatedDays && Number.isFinite(estimatedDays)) {
    insights.push(`Se guardar o ritmo atual, você alcança em aproximadamente ${estimatedDays} dias.`);
  }
  return insights;
}

export function generateCashRiskAlerts(params: InsightParams): ProactiveInsight[] {
  const { transactions, pots, paymentAccounts = [], fixedExpenses = [] } = params;
  if (transactions.length < 2 && fixedExpenses.length === 0 && paymentAccounts.length === 0) return [];

  const currentBalance = pots.reduce((sum, pot) => sum + (Number.isFinite(pot.balance) ? pot.balance : 0), 0);
  const forecast = calculateCashflowForecast({
    transactions,
    currentBalance,
    periodDays: 30,
    fixedExpenses,
    pendingBills: buildPendingBills(paymentAccounts),
  });

  if (!forecast.dataSufficient) return [];
  const risk = getCashRiskLevel(forecast);
  const insights: ProactiveInsight[] = [];

  if (risk === "critical" && forecast.riskDay) {
    insights.push({
      id: "cash-risk-critical",
      kind: "cashRisk",
      title: "Risco real de caixa apertado",
      message: `Alerta real: sua projeção indica risco de saldo negativo ${formatDaysLabel(forecast.riskDay)}.`,
      level: "critical",
      impactEstimate: `Saldo projetado em 30 dias: ${formatCurrency(forecast.projectedBalance)}.`,
      suggestedAction: "Segure gastos não essenciais e priorize contas fixas dos próximos dias.",
      actionLabel: "Ver risco de caixa",
      actionQuestion: "Tenho risco de ficar negativo?",
    });
  } else if (risk === "moderate" && forecast.riskDay) {
    insights.push({
      id: "cash-risk-moderate",
      kind: "cashRisk",
      title: "Atenção ao ritmo do caixa",
      message: `Seu caixa tende a enfraquecer nos próximos ${forecast.riskDay} dias se nada mudar.`,
      level: "attention",
      impactEstimate: `Saldo projetado em 30 dias: ${formatCurrency(forecast.projectedBalance)}.`,
      suggestedAction: "Revise despesas recorrentes e aumente entradas de curto prazo.",
      actionLabel: "Montar plano de 14 dias",
      actionQuestion: "Monte um plano rápido para os próximos 14 dias.",
    });
  } else {
    insights.push({
      id: "cash-risk-positive",
      kind: "cashRisk",
      title: "Caixa saudável no curto prazo",
      message: "Boa: sua projeção não indica saldo negativo nos próximos 30 dias.",
      level: "positive",
      impactEstimate: `Saldo projetado em 30 dias: ${formatCurrency(forecast.projectedBalance)}.`,
      suggestedAction: "Mantenha o padrão e evite comprometer a reserva com gastos impulsivos.",
      actionLabel: "Como proteger esse cenário?",
      actionQuestion: "Como manter meu caixa saudável por mais tempo?",
    });
  }

  const today = new Date();
  const nextDue = paymentAccounts
    .filter((item) => item.status !== "pago")
    .map((item) => {
      const due = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(28, item.dueDate)));
      const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      return { item, diff };
    })
    .filter((entry) => entry.diff >= 0 && entry.diff <= 5)
    .sort((a, b) => a.diff - b.diff)[0];

  if (nextDue) {
    insights.push({
      id: `bill-due-${nextDue.item.id}`,
      kind: "cashRisk",
      title: "Conta próxima do vencimento",
      message: `${nextDue.item.name} vence ${formatDaysLabel(nextDue.diff)}.`,
      level: nextDue.diff <= 1 ? "critical" : "attention",
      impactEstimate: `Compromisso de ${formatCurrency(nextDue.item.amount)}.`,
      suggestedAction: "Deixe o valor separado hoje para evitar atraso e juros.",
      actionLabel: "Organizar pagamento",
      actionQuestion: "Como organizar os próximos vencimentos?",
    });
  }

  return insights;
}

export function generateExpenseIncreaseAlerts(params: InsightParams): ProactiveInsight[] {
  const { transactions } = params;
  if (transactions.length < 6) return [];

  const monthly = getMonthlyComparison(transactions, 3);
  if (monthly.rows.length < 2) return [];
  const current = monthly.rows[monthly.rows.length - 1];
  const previous = monthly.rows[monthly.rows.length - 2];
  const insights: ProactiveInsight[] = [];

  if (previous.expense > 0) {
    const delta = ((current.expense - previous.expense) / previous.expense) * 100;
    if (delta >= 10) {
      insights.push({
        id: "expense-rise-general",
        kind: "expenseIncrease",
        title: "Gastos em alta neste mês",
        message: `Seus gastos subiram ${delta.toFixed(0)}% em relação ao mês anterior.`,
        level: delta >= 20 ? "critical" : "attention",
        impactEstimate: `Você gastou ${formatCurrency(current.expense)} neste mês.`,
        suggestedAction: "Corte uma categoria de baixo impacto hoje para travar essa subida.",
        actionLabel: "Onde estou gastando mais?",
        actionQuestion: "Onde estou gastando mais?",
      });
    }
  }

  const currentCategories = monthCategoryTotals(transactions, 0);
  const previousCategories = monthCategoryTotals(transactions, 1);
  const topCategoryCandidates = Array.from(currentCategories.entries())
    .map(([name, value]) => {
      const before = previousCategories.get(name) ?? 0;
      if (value < 30 || before <= 0) return null;
      const delta = ((value - before) / before) * 100;
      if (delta < 15) return null;
      return { name, delta, currentValue: value };
    })
    .filter((item): item is { name: string; delta: number; currentValue: number } => item !== null)
    .sort((a, b) => b.delta - a.delta);

  const topCategory = topCategoryCandidates[0];

  if (topCategory !== undefined) {
    const categoryLabel = topCategory.name.charAt(0).toUpperCase() + topCategory.name.slice(1);
    insights.push({
      id: `expense-rise-category-${topCategory.name}`,
      kind: "expenseIncrease",
      title: "Categoria puxando seu orçamento",
      message: `${categoryLabel} subiu ${topCategory.delta.toFixed(0)}% e já soma ${formatCurrency(topCategory.currentValue)} no mês.`,
      level: topCategory.delta >= 25 ? "critical" : "attention",
      impactEstimate: `${categoryLabel} ficou acima do padrão recente.`,
      suggestedAction: "Defina um teto semanal para essa categoria até estabilizar.",
      actionLabel: "Definir limite de gasto",
      actionQuestion: "Qual limite seguro eu posso usar para essa categoria?",
    });
  }

  const monthStart = startOfMonth();
  const personalExpenses = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .filter((tx) => {
      const date = toDate(tx.date);
      return !!date && date >= monthStart;
    })
    .filter((tx) => normalizeText(tx.pot ?? tx.accountTypeLink ?? "").includes("pessoal") || tx.accountTypeLink === "pf")
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (current.expense > 0) {
    const personalShare = (personalExpenses / current.expense) * 100;
    if (personalShare >= 65) {
      insights.push({
        id: "expense-personal-overload",
        kind: "expenseIncrease",
        title: "Excesso de gastos pessoais",
        message: `${personalShare.toFixed(0)}% das suas saídas do mês estão no pessoal.`,
        level: personalShare >= 75 ? "critical" : "attention",
        impactEstimate: `Saídas pessoais: ${formatCurrency(personalExpenses)}.`,
        suggestedAction: "Segure compras não urgentes e proteja a parte do negócio.",
        actionLabel: "Posso tirar dinheiro hoje?",
        actionQuestion: "Posso tirar dinheiro hoje?",
      });
    }
  }

  return insights;
}

export function generateRevenueDropAlerts(params: InsightParams): ProactiveInsight[] {
  const { transactions } = params;
  const monthly = getMonthlyComparison(transactions, 3);
  if (monthly.rows.length < 2) return [];
  const current = monthly.rows[monthly.rows.length - 1];
  const previous = monthly.rows[monthly.rows.length - 2];
  if (previous.income <= 0) return [];

  const delta = ((current.income - previous.income) / previous.income) * 100;
  if (delta <= -10) {
    return [
      {
        id: "revenue-drop",
        kind: "revenueDrop",
        title: "Queda de faturamento detectada",
        message: `Seu faturamento caiu ${Math.abs(delta).toFixed(0)}% em relação ao mês anterior.`,
        level: delta <= -20 ? "critical" : "attention",
        impactEstimate: `Entradas do mês: ${formatCurrency(current.income)}.`,
        suggestedAction: "Ative retomada com clientes antigos e priorize serviços de maior retorno.",
        actionLabel: "Como recuperar o faturamento?",
        actionQuestion: "Me ajude com um plano para recuperar faturamento este mês.",
      },
    ];
  }

  if (delta >= 12) {
    return [
      {
        id: "revenue-up-opportunity",
        kind: "opportunity",
        title: "Boa janela para fortalecer caixa",
        message: `Sua receita subiu ${delta.toFixed(0)}% neste mês. Ótimo momento para reforçar reserva.`,
        level: "positive",
        impactEstimate: `Entradas do mês: ${formatCurrency(current.income)}.`,
        suggestedAction: "Separe parte desse ganho extra para reserva e despesas futuras.",
        actionLabel: "Quanto posso guardar agora?",
        actionQuestion: "Quanto posso guardar sem apertar meu caixa?",
      },
    ];
  }

  return [];
}

export function generateClientRetentionAlerts(params: InsightParams): ProactiveInsight[] {
  const { transactions, clients = [] } = params;
  const incomeByClient = new Map<string, { name: string; total: number; lastDate: Date }>();

  transactions.forEach((tx) => {
    if (tx.type !== TransactionType.INCOME) return;
    const clientName = tx.clientName?.trim();
    if (!clientName) return;
    const date = toDate(tx.date);
    if (!date) return;
    const key = normalizeText(clientName);
    const prev = incomeByClient.get(key);
    if (!prev) {
      incomeByClient.set(key, { name: clientName, total: tx.amount, lastDate: date });
      return;
    }
    prev.total += tx.amount;
    if (date > prev.lastDate) prev.lastDate = date;
  });

  clients.forEach((client) => {
    const key = normalizeText(client.name);
    if (!incomeByClient.has(key)) return;
    const existing = incomeByClient.get(key);
    if (!existing) return;
    const fallbackDate = toDate(client.lastService) ?? existing.lastDate;
    existing.lastDate = fallbackDate > existing.lastDate ? fallbackDate : existing.lastDate;
  });

  const items = Array.from(incomeByClient.values());
  if (items.length === 0) return [];

  const sortedByValue = [...items].sort((a, b) => b.total - a.total);
  const vipThreshold = sortedByValue[Math.min(2, sortedByValue.length - 1)]?.total ?? 0;
  const today = new Date();
  const insights: ProactiveInsight[] = [];

  sortedByValue.slice(0, 5).forEach((item) => {
    const daysAway = Math.floor((today.getTime() - item.lastDate.getTime()) / 86400000);
    if (daysAway < 45) return;

    const isVip = item.total >= Math.max(500, vipThreshold);
    insights.push({
      id: `client-retention-${normalizeText(item.name)}`,
      kind: "clientRetention",
      title: isVip ? "Cliente importante sumido" : "Cliente sem retorno recente",
      message: `${item.name} não volta há ${daysAway} dias.${isVip ? " Vale agir antes de esfriar." : ""}`,
      level: isVip && daysAway >= 60 ? "critical" : "attention",
      impactEstimate: `Esse cliente já gerou ${formatCurrency(item.total)} para você.`,
      suggestedAction: "Envie uma mensagem curta de retomada com oferta de horário.",
      actionLabel: "Gerar mensagem",
      actionQuestion: `Me ajude a criar mensagem para reativar o cliente ${item.name}.`,
    });
  });

  return insights.slice(0, 2);
}

export function generateGoalProgressAlerts(params: InsightParams): ProactiveInsight[] {
  const { pots, transactions } = params;
  const insights: ProactiveInsight[] = [];
  const reservePot = pots.find((pot) => pot.type === PotType.RESERVE) ?? pots.find((pot) => normalizeText(pot.name).includes("reserv"));
  if (!reservePot || !reservePot.goalValue || reservePot.goalValue <= 0) return [];

  const progress = calculateGoalProgress(reservePot.balance, reservePot.goalValue);
  const remaining = Math.max(0, reservePot.goalValue - reservePot.balance);
  const estimatedDays = estimateDaysToGoal(remaining, Math.max(0, estimateNet30(transactions) / 30));

  if (progress < 20) {
    insights.push({
      id: "goal-reserve-low",
      kind: "goalProgress",
      title: "Reserva ainda insuficiente",
      message: `Sua reserva está em ${progress.toFixed(0)}% da meta. Ainda é pouco para imprevistos.`,
      level: "attention",
      impactEstimate: `Faltam ${formatCurrency(remaining)} para a meta.`,
      suggestedAction: "Comece com um aporte pequeno e constante toda semana.",
      actionLabel: "Criar plano de reserva",
      actionQuestion: "Me passa um plano simples para fortalecer minha reserva.",
    });
  } else if (progress >= 70 && progress < 100) {
    insights.push({
      id: "goal-reserve-near",
      kind: "goalProgress",
      title: "Meta de reserva quase lá",
      message: `Boa: você já chegou em ${progress.toFixed(0)}% da reserva.`,
      level: "positive",
      impactEstimate: estimatedDays ? `Mantendo o ritmo, faltam cerca de ${estimatedDays} dias.` : `Faltam ${formatCurrency(remaining)}.`,
      suggestedAction: "Evite sacar da reserva agora para bater a meta sem atrasos.",
      actionLabel: "Quanto falta para minha meta?",
      actionQuestion: "Quanto falta para minha meta?",
    });
  } else if (progress >= 100) {
    insights.push({
      id: "goal-reserve-hit",
      kind: "goalProgress",
      title: "Meta de reserva atingida",
      message: "Excelente: sua reserva já bateu a meta configurada.",
      level: "positive",
      impactEstimate: `Saldo da reserva: ${formatCurrency(reservePot.balance)}.`,
      suggestedAction: "Defina um novo alvo para continuar evoluindo com segurança.",
      actionLabel: "Definir nova meta",
      actionQuestion: "Me ajude a definir a próxima meta de reserva.",
    });
  }

  return insights;
}

export function generateLowMarginAlerts(params: InsightParams): ProactiveInsight[] {
  const { transactions } = params;
  const monthStart = startOfMonth();
  const monthIncome = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .filter((tx) => {
      const date = toDate(tx.date);
      return !!date && date >= monthStart;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthNetIncome = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .filter((tx) => {
      const date = toDate(tx.date);
      return !!date && date >= monthStart;
    })
    .reduce((sum, tx) => sum + getTransactionNetAmount(tx), 0);
  const monthExpense = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .filter((tx) => {
      const date = toDate(tx.date);
      return !!date && date >= monthStart;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (monthIncome <= 0) return [];
  const marginPct = (monthNetIncome / monthIncome) * 100;
  if (marginPct >= 20) return [];

  return [
    {
      id: "low-margin",
      kind: "lowMargin",
      title: "Margem baixa neste mês",
      message: `Sua margem está em ${marginPct.toFixed(0)}%. Você está trabalhando bastante para sobrar pouco.`,
      level: marginPct < 10 ? "critical" : "attention",
      impactEstimate: `Receita ${formatCurrency(monthIncome)} vs despesas ${formatCurrency(monthExpense)}.`,
      suggestedAction: "Reveja preço ou custo dos serviços com maior saída.",
      actionLabel: "Me ajuda a ajustar preço",
      actionQuestion: "Qual gasto posso reduzir sem afetar meu trabalho?",
    },
  ];
}

export function generateLowStockAlerts(params: InsightParams): ProactiveInsight[] {
  const { salesItems = [], costs = [] } = params;
  const lowItems = salesItems
    .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 0)
    .filter((item) => item.quantity <= 2)
    .sort((a, b) => a.quantity - b.quantity);

  const insights: ProactiveInsight[] = lowItems.slice(0, 2).map((item) => ({
    id: `low-stock-${item.id}`,
    kind: "lowStock",
    title: "Estoque baixo",
    message: `${item.name} está com estoque em ${item.quantity} unidade(s).`,
    level: item.quantity === 0 ? "critical" : "attention",
    impactEstimate: `Preço médio atual: ${formatCurrency(item.price)}.`,
    suggestedAction: "Programe reposição antes de faltar no próximo atendimento.",
    actionLabel: "Planejar reposição",
    actionQuestion: `Me ajuda a planejar reposição de ${item.name}.`,
  }));

  if (insights.length > 0) return insights;

  const recurringSupplyCosts = costs
    .filter((cost) => normalizeText(cost.category).includes("fornecedor") || normalizeText(cost.category).includes("ferramenta"))
    .slice(-3);

  if (recurringSupplyCosts.length >= 2) {
    return [
      {
        id: "supply-cost-opportunity",
        kind: "opportunity",
        title: "Oportunidade de economizar em reposição",
        message: "Seus custos de reposição apareceram com frequência recente.",
        level: "attention",
        impactEstimate: `Últimos custos somam ${formatCurrency(
          recurringSupplyCosts.reduce((sum, item) => sum + item.amount, 0)
        )}.`,
        suggestedAction: "Negocie compra em lote ou compare fornecedor antes da próxima reposição.",
        actionLabel: "Onde posso economizar?",
        actionQuestion: "Qual gasto posso reduzir?",
      },
    ];
  }

  return [];
}

export function generateProactiveInsights(params: InsightParams): ProactiveInsight[] {
  const merged = [
    ...generateCashRiskAlerts(params),
    ...generateExpenseIncreaseAlerts(params),
    ...generateRevenueDropAlerts(params),
    ...generateClientRetentionAlerts(params),
    ...generateGoalProgressAlerts(params),
    ...generateLowMarginAlerts(params),
    ...generateLowStockAlerts(params),
  ];

  const seen = new Set<string>();
  const deduped = merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const critical = deduped.filter((item) => item.level === "critical");
  const attention = deduped.filter((item) => item.level === "attention");
  const positive = deduped.filter((item) => item.level === "positive");

  return [...critical, ...attention, ...positive].slice(0, 8);
}

export function markInsightAsRead(current: Record<string, boolean>, insightId: string) {
  if (!insightId) return current;
  if (current[insightId]) return current;
  return { ...current, [insightId]: true };
}

export function generateSmartNotifications(params: InsightParams) {
  const notifications: SmartNotification[] = generateProactiveInsights(params).map((insight) => ({
    id: `smart-${insight.id}`,
    title: insight.title,
    message: insight.message,
    level: toInsightLevelNotification(insight.level),
    read: false,
  }));

  return notifications.slice(0, 6);
}
