import type { AdjustmentAccount, Pot, Transaction } from "@/lib/types";
import { PotType, TransactionType } from "@/lib/types";
import { getTransactionNetAmount } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";

type GoalType =
  | "reserva_emergencia"
  | "quitar_divida"
  | "comprar_equipamento"
  | "reformar_espaco"
  | "faturamento_mensal"
  | "economia_mensal"
  | "viagem"
  | "investimento"
  | "lucro_negocio";

type UserGoal = {
  id: string;
  type: GoalType;
  title: string;
  targetValue: number;
  currentValue: number;
  progress: number;
  status: "near" | "far" | "stagnant" | "completed";
  stagnantDays: number;
  estimatedDays: number | null;
  dailyPace: number;
  rationale: string;
};

type GoalMentorInput = {
  question: string;
  pots: Pot[];
  transactions: Transaction[];
  adjustmentAccounts?: AdjustmentAccount[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function withinLastDays(dateString: string, days: number) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return parsed >= limit;
}

function mapGoalTypeByName(name: string, potType: PotType): GoalType {
  const normalized = normalizeText(name);
  if (potType === PotType.RESERVE || normalized.includes("reserva") || normalized.includes("emergencia")) {
    return "reserva_emergencia";
  }
  if (normalized.includes("viagem")) return "viagem";
  if (normalized.includes("invest")) return "investimento";
  if (normalized.includes("equip")) return "comprar_equipamento";
  if (normalized.includes("reform")) return "reformar_espaco";
  if (normalized.includes("fatur")) return "faturamento_mensal";
  if (normalized.includes("econom")) return "economia_mensal";
  if (normalized.includes("lucro")) return "lucro_negocio";
  return potType === PotType.BUSINESS ? "lucro_negocio" : "economia_mensal";
}

function inferGoalTitle(type: GoalType) {
  if (type === "reserva_emergencia") return "Reserva de emergencia";
  if (type === "quitar_divida") return "Quitar divida";
  if (type === "comprar_equipamento") return "Comprar equipamento";
  if (type === "reformar_espaco") return "Reformar espaco";
  if (type === "faturamento_mensal") return "Faturamento mensal";
  if (type === "economia_mensal") return "Economia mensal";
  if (type === "viagem") return "Viagem";
  if (type === "investimento") return "Investimento";
  return "Meta de lucro do negocio";
}

export function calculateGoalProgress(currentValue: number, targetValue: number) {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0;
  return Math.max(0, Math.min((currentValue / targetValue) * 100, 999));
}

export function estimateDaysToGoal(remainingValue: number, dailyContribution: number) {
  if (!Number.isFinite(remainingValue) || remainingValue <= 0) return 0;
  if (!Number.isFinite(dailyContribution) || dailyContribution <= 0) return null;
  return Math.ceil(remainingValue / dailyContribution);
}

function resolveDebtGoal(adjustmentAccounts: AdjustmentAccount[] = []): UserGoal | null {
  const debtAccounts = adjustmentAccounts.filter((item) => {
    const isDebtLike = item.type === "fixa" || Number.isFinite(item.totalDebt);
    return isDebtLike && item.status !== "pago";
  });
  if (debtAccounts.length === 0) return null;

  const target = debtAccounts.reduce((sum, item) => {
    if (Number.isFinite(item.totalDebt) && (item.totalDebt ?? 0) > 0) return sum + (item.totalDebt ?? 0);
    if (Number.isFinite(item.amount) && item.amount > 0) return sum + item.amount;
    return sum;
  }, 0);

  const outstanding = debtAccounts.reduce((sum, item) => {
    if ((item.totalDebt ?? 0) > 0 && (item.installmentsTotal ?? 0) > 0 && (item.installmentsRemaining ?? 0) >= 0) {
      return sum + (item.totalDebt ?? 0) * ((item.installmentsRemaining ?? 0) / Math.max(1, item.installmentsTotal ?? 1));
    }
    return sum + Math.max(0, item.amount);
  }, 0);

  const paid = Math.max(0, target - outstanding);
  const progress = calculateGoalProgress(paid, Math.max(target, 1));
  const dailyPace = Math.max(0, target * 0.02 / 30);
  const estimatedDays = estimateDaysToGoal(Math.max(0, target - paid), dailyPace);

  return {
    id: "goal-debt",
    type: "quitar_divida",
    title: "Quitar divida",
    targetValue: target,
    currentValue: paid,
    progress,
    status: progress >= 100 ? "completed" : progress >= 75 ? "near" : "far",
    stagnantDays: 0,
    estimatedDays,
    dailyPace,
    rationale: "Divida ativa detectada nas contas do seu fluxo.",
  };
}

function resolveReserveDailyPace(transactions: Transaction[]) {
  const reserveMovements = transactions
    .filter((tx) => tx.pot === PotType.RESERVE || normalizeText(tx.category).includes("reserva"))
    .filter((tx) => withinLastDays(tx.date, 30));
  const net = reserveMovements.reduce(
    (sum, tx) => sum + (tx.type === TransactionType.INCOME ? getTransactionNetAmount(tx) : -tx.amount),
    0
  );
  return Math.max(0, net / 30);
}

function inferStagnantDaysForGoal(goalType: GoalType, transactions: Transaction[]) {
  if (goalType === "reserva_emergencia") {
    const lastMove = transactions
      .filter((tx) => tx.pot === PotType.RESERVE || normalizeText(tx.category).includes("reserva"))
      .map((tx) => new Date(tx.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastMove) return 999;
    return Math.floor((Date.now() - lastMove.getTime()) / 86400000);
  }
  if (goalType === "faturamento_mensal" || goalType === "lucro_negocio") {
    const lastIncome = transactions
      .filter((tx) => tx.type === TransactionType.INCOME)
      .map((tx) => new Date(tx.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastIncome) return 999;
    return Math.floor((Date.now() - lastIncome.getTime()) / 86400000);
  }
  return 0;
}

export function getUserGoals(input: {
  pots: Pot[];
  transactions: Transaction[];
  adjustmentAccounts?: AdjustmentAccount[];
}) {
  const { pots, transactions, adjustmentAccounts = [] } = input;
  const monthStart = startOfMonth();
  const monthIncome = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .filter((tx) => {
      const date = new Date(tx.date);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthExpense = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .filter((tx) => {
      const date = new Date(tx.date);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthNet = Math.max(0, monthIncome - monthExpense);
  const goals: UserGoal[] = [];

  pots.forEach((pot) => {
    const targetFromPot = Number.isFinite(pot.goalValue) && pot.goalValue > 0 ? pot.goalValue : 0;
    const type = mapGoalTypeByName(pot.name, pot.type);

    let targetValue = targetFromPot;
    let currentValue = Math.max(0, pot.balance);
    let rationale = "Meta configurada no seu pote financeiro.";

    if (!targetValue && type === "reserva_emergencia") {
      targetValue = Math.max(monthExpense * 3, 1500);
      rationale = "Meta sugerida de reserva baseada no seu custo mensal.";
    }
    if (!targetValue && type === "faturamento_mensal") {
      targetValue = Math.max(monthIncome * 1.12, 2000);
      currentValue = monthIncome;
      rationale = "Meta sugerida de faturamento baseada no seu ritmo atual.";
    }
    if (!targetValue && type === "economia_mensal") {
      targetValue = Math.max(monthIncome * 0.2, 300);
      currentValue = monthNet;
      rationale = "Meta sugerida de economia mensal com base no seu lucro atual.";
    }
    if (!targetValue) return;

    const progress = calculateGoalProgress(currentValue, targetValue);
    const dailyPace =
      type === "reserva_emergencia"
        ? resolveReserveDailyPace(transactions)
        : type === "faturamento_mensal"
        ? monthIncome / Math.max(1, new Date().getDate())
        : Math.max(0, monthNet / 30);
    const remaining = Math.max(0, targetValue - currentValue);
    const estimatedDays = estimateDaysToGoal(remaining, dailyPace);
    const stagnantDays = inferStagnantDaysForGoal(type, transactions);

    const status: UserGoal["status"] =
      progress >= 100 ? "completed" : stagnantDays >= 7 ? "stagnant" : progress >= 75 ? "near" : "far";

    goals.push({
      id: `goal-pot-${pot.id}`,
      type,
      title: inferGoalTitle(type),
      targetValue,
      currentValue,
      progress,
      status,
      stagnantDays,
      estimatedDays,
      dailyPace,
      rationale,
    });
  });

  const debtGoal = resolveDebtGoal(adjustmentAccounts);
  if (debtGoal) goals.push(debtGoal);

  return goals.sort((a, b) => {
    const statusWeight = { critical: 3, stagnant: 2, far: 1, near: 0, completed: -1 };
    const aWeight =
      a.status === "stagnant" ? statusWeight.stagnant : a.status === "far" ? statusWeight.far : a.status === "near" ? statusWeight.near : statusWeight.completed;
    const bWeight =
      b.status === "stagnant" ? statusWeight.stagnant : b.status === "far" ? statusWeight.far : b.status === "near" ? statusWeight.near : statusWeight.completed;
    return bWeight - aWeight;
  });
}

export function generateGoalEncouragement(goal: UserGoal) {
  if (goal.status === "completed") return "Meta batida. Agora e manter consistencia e subir o proximo nivel.";
  if (goal.status === "near") {
    return `Boa, você já chegou em ${goal.progress.toFixed(0)}% da meta. Agora é mais constância do que esforço gigante.`;
  }
  if (goal.status === "stagnant") {
    return "Sua meta ficou sem evolucao nos ultimos dias. Quer que eu monte um plano leve para destravar?";
  }
  return `Você ainda está longe, mas dá para quebrar em partes menores. Primeiro alvo: ${formatCurrency(
    Math.max(0, goal.currentValue + Math.max(1, goal.targetValue - goal.currentValue) * 0.2)
  )} nos proximos 15 dias.`;
}

export function suggestDailyActionForGoal(goal: UserGoal) {
  if (goal.type === "reserva_emergencia") return "Separe hoje um valor pequeno e automatico para a reserva antes dos outros gastos.";
  if (goal.type === "quitar_divida") return "Hoje, bloqueie no caixa o valor mínimo da próxima parcela para não perder ritmo.";
  if (goal.type === "faturamento_mensal") return "Hoje, acione clientes de retorno rapido e preencha um horario ocioso.";
  if (goal.type === "economia_mensal") return "Hoje, corte uma saida de baixo impacto e direcione o valor para a meta.";
  if (goal.type === "viagem") return "Hoje, reserve um valor fixo e evite mexer nesse montante.";
  if (goal.type === "investimento") return "Hoje, defina um aporte pequeno que caiba no seu caixa sem apertar.";
  if (goal.type === "comprar_equipamento") return "Hoje, separe um fundo especifico para o equipamento e mantenha aportes semanais.";
  if (goal.type === "reformar_espaco") return "Hoje, priorize orcamento e cronograma para evitar estouro de custo.";
  return "Hoje, proteja margem e direcione um valor real para sua meta principal.";
}

export function generateGoalStrategy(goal: UserGoal) {
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  const firstMilestone = goal.currentValue + Math.max(remaining * 0.2, remaining > 0 ? Math.min(remaining, goal.targetValue * 0.08) : 0);

  const statusText =
    goal.status === "completed"
      ? "Você bateu a meta e agora entra em fase de manutenção."
      : goal.status === "near"
      ? `Você está perto: ${goal.progress.toFixed(0)}% concluído.`
      : goal.status === "stagnant"
      ? `Meta parada ha ${goal.stagnantDays} dias.`
      : `Você está em ${goal.progress.toFixed(0)}% da meta e ainda há espaço para acelerar.`;

  const estimateText = goal.estimatedDays
    ? `No ritmo atual, a previsao e de cerca de ${goal.estimatedDays} dias para concluir.`
    : "Sem ritmo consistente nos últimos dias, ainda não dá para estimar prazo com segurança.";

  return {
    statusText,
    estimateText,
    nextMilestone: firstMilestone,
  };
}

export function buildGoalActionPlan(goal: UserGoal) {
  const dailyAction = suggestDailyActionForGoal(goal);
  const weeklyTarget = Math.max(0, Math.min(goal.targetValue - goal.currentValue, goal.dailyPace * 7 || goal.targetValue * 0.08));
  const monthlyTarget = Math.max(0, Math.min(goal.targetValue - goal.currentValue, goal.dailyPace * 30 || goal.targetValue * 0.25));

  return {
    today: [dailyAction],
    next7Days: [
      `Meta de 7 dias: avancar ${formatCurrency(weeklyTarget)} nesta meta.`,
      "Revisar gastos e entradas no fim de cada dia por 5 minutos.",
      "Ajustar rota no dia 4 se o ritmo estiver abaixo do planejado.",
    ],
    next30Days: [
      `Meta de 30 dias: avancar ${formatCurrency(monthlyTarget)} mantendo caixa protegido.`,
      "Consolidar uma rotina semanal fixa de acompanhamento da meta.",
      "Reavaliar teto de gastos e alavancas de receita para acelerar o proximo ciclo.",
    ],
  };
}

function detectGoalQuestion(question: string) {
  const normalized = normalizeText(question);
  const triggers = [
    "meta",
    "objetivo",
    "reserva",
    "quitar divida",
    "comprar equipamento",
    "reformar espaco",
    "faturamento",
    "economia",
    "viagem",
    "investimento",
    "lucro",
  ];
  return triggers.some((term) => normalized.includes(term));
}

function pickGoalByQuestion(goals: UserGoal[], question: string) {
  const normalized = normalizeText(question);
  const findByType = (type: GoalType) => goals.find((goal) => goal.type === type);

  if (normalized.includes("reserva")) return findByType("reserva_emergencia");
  if (normalized.includes("divida")) return findByType("quitar_divida");
  if (normalized.includes("equip")) return findByType("comprar_equipamento");
  if (normalized.includes("reform")) return findByType("reformar_espaco");
  if (normalized.includes("fatur")) return findByType("faturamento_mensal");
  if (normalized.includes("econom")) return findByType("economia_mensal");
  if (normalized.includes("viagem")) return findByType("viagem");
  if (normalized.includes("invest")) return findByType("investimento");
  if (normalized.includes("lucro")) return findByType("lucro_negocio");

  return goals.find((goal) => goal.status !== "completed") ?? goals[0];
}

export function buildGoalMentorResponse(input: GoalMentorInput): {
  matched: boolean;
  message?: string;
  riskTone?: "positive" | "attention" | "critical";
  quickActions?: string[];
  cards?: Array<{ title: string; description: string }>;
} {
  if (!detectGoalQuestion(input.question)) return { matched: false };

  const goals = getUserGoals({
    pots: input.pots,
    transactions: input.transactions,
    adjustmentAccounts: input.adjustmentAccounts ?? [],
  });

  if (goals.length === 0) {
    return {
      matched: true,
      riskTone: "attention",
      message:
        "Ainda não encontrei metas financeiras configuradas para acompanhar. Se quiser, eu te ajudo a criar uma meta simples agora e quebrar em passos de hoje, 7 dias e 30 dias.",
      quickActions: ["Criar meta de reserva", "Criar meta de faturamento", "Criar meta para quitar divida"],
      cards: [{ title: "Status de metas", description: "Sem metas ativas no momento" }],
    };
  }

  const goal = pickGoalByQuestion(goals, input.question) ?? goals[0];
  const strategy = generateGoalStrategy(goal);
  const encouragement = generateGoalEncouragement(goal);
  const plan = buildGoalActionPlan(goal);

  const progressLabel = `${goal.progress.toFixed(0)}%`;
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  const riskTone: "positive" | "attention" | "critical" =
    goal.status === "completed" ? "positive" : goal.status === "near" ? "positive" : goal.status === "stagnant" ? "attention" : "critical";

  const message = `Meta acompanhada: ${goal.title}

${encouragement}
${strategy.statusText}
Progresso atual: ${progressLabel} (${formatCurrency(goal.currentValue)} de ${formatCurrency(goal.targetValue)}).
Falta: ${formatCurrency(remaining)}.
${strategy.estimateText}

Plano de acao
Hoje:
- ${plan.today.join("\n- ")}

Proximos 7 dias:
- ${plan.next7Days.join("\n- ")}

Proximos 30 dias:
- ${plan.next30Days.join("\n- ")}

Proximo passo sugerido: ${goal.status === "near" ? "manter ritmo diario sem quebrar consistencia." : `buscar o primeiro alvo de ${formatCurrency(strategy.nextMilestone)} para ganhar tracao.`}`;

  return {
    matched: true,
    message,
    riskTone,
    quickActions: [
      "Me da o plano de hoje",
      "Como acelerar em 7 dias?",
      "Qual meta devo priorizar agora?",
      "Revisar progresso da meta",
    ],
    cards: [
      { title: "Meta ativa", description: goal.title },
      { title: "Progresso", description: progressLabel },
      { title: "Falta para concluir", description: formatCurrency(remaining) },
    ],
  };
}
