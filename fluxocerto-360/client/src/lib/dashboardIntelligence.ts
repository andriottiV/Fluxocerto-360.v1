import { Client, PaymentAccount, Pot, Transaction, TransactionType } from "@/lib/types";
import { parseDateSafe } from "@/lib/finance";

type HeaderState = "alert" | "positive" | "incentive" | "attention";

type IntelligenceConfig = {
  billsWindowDays: number;
  urgentBillsDays: number;
  goalNearStart: number;
  perfDropFactor: number;
  perfDropMinDelta: number;
  inactiveClientRatioThreshold: number;
  inactiveClientMinCount: number;
  pfAbsoluteFloor: number;
  pfExpenseCoverageDays: number;
  notificationMaxItems: number;
};

const CFG: IntelligenceConfig = {
  billsWindowDays: 10,
  urgentBillsDays: 3,
  goalNearStart: 0.9,
  perfDropFactor: 0.8,
  perfDropMinDelta: 250,
  inactiveClientRatioThreshold: 0.4,
  inactiveClientMinCount: 3,
  pfAbsoluteFloor: 500,
  pfExpenseCoverageDays: 5,
  notificationMaxItems: 5,
};

export type DashboardNotification = {
  id: string;
  type: "warning" | "positive" | "info";
  message: string;
};

export type DashboardIntelligence = {
  headerState: HeaderState;
  headerMessage: string;
  pfBalance: number;
  hasUpcomingBills: boolean;
  isAllGood: boolean;
  greetingMessage: string;
  greetingTone: "warning" | "positive";
  notifications: DashboardNotification[];
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function shiftDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getDaysUntilDue(dueDay: number, now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = startOfDay(now);

  let due = new Date(year, month, dueDay);
  if (Number.isNaN(due.getTime())) return 999;

  if (due.getTime() < today.getTime()) {
    due = new Date(year, month + 1, dueDay);
  }

  return Math.ceil((startOfDay(due).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function sumBetween(
  transactions: Transaction[],
  start: Date,
  end: Date,
  type?: TransactionType
) {
  return transactions
    .filter((tx) => (type ? tx.type === type : true))
    .filter((tx) => {
      const date = parseDateSafe(tx.date);
      if (!date) return false;
      return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function getPfPot(pots: Pot[]) {
  return (
    pots.find((pot) => pot.name.toLowerCase().includes("pess")) ??
    pots.find((pot) => pot.type === "pessoal")
  );
}

function getUpcomingBills(paymentAccounts: PaymentAccount[], now: Date) {
  return paymentAccounts.filter((account) => {
    if (account.status === "pago") return false;
    if (account.status === "atrasado") return true;
    return getDaysUntilDue(account.dueDate, now) <= CFG.billsWindowDays;
  });
}

function getGoalsNear(pots: Pot[]) {
  return pots.filter((pot) => {
    if (!pot.limit || pot.limit <= 0) return false;
    const progress = pot.balance / pot.limit;
    return progress >= CFG.goalNearStart && progress < 1;
  });
}

function isPerformanceDrop(transactions: Transaction[], now: Date) {
  const currentEnd = endOfDay(now);
  const currentStart = startOfDay(shiftDays(now, -6));
  const prevEnd = endOfDay(shiftDays(currentStart, -1));
  const prevStart = startOfDay(shiftDays(prevEnd, -6));

  const incomeCurrent = sumBetween(transactions, currentStart, currentEnd, TransactionType.INCOME);
  const incomePrevious = sumBetween(transactions, prevStart, prevEnd, TransactionType.INCOME);

  if (incomePrevious <= 0) return false;

  const droppedByFactor = incomeCurrent < incomePrevious * CFG.perfDropFactor;
  const delta = incomePrevious - incomeCurrent;

  return droppedByFactor && delta >= CFG.perfDropMinDelta;
}

function buildNotifications(params: {
  clients: Client[];
  paymentAccounts: PaymentAccount[];
  transactions: Transaction[];
  now: Date;
  hasUpcomingBills: boolean;
  goalsNear: Pot[];
  pfLow: boolean;
  performanceDrop: boolean;
}) {
  const {
    clients,
    paymentAccounts,
    transactions,
    now,
    hasUpcomingBills,
    goalsNear,
    pfLow,
    performanceDrop,
  } = params;
  const list: DashboardNotification[] = [];

  const inactiveClients = clients.filter((client) => client.status === "inativo").length;
  const inactiveRatio = inactiveClients / Math.max(1, clients.length);
  if (inactiveClients >= CFG.inactiveClientMinCount && inactiveRatio >= CFG.inactiveClientRatioThreshold) {
    list.push({
      id: "client-frequency",
      type: "warning",
      message: "Retorno de clientes caiu. Ative campanha de reativacao.",
    });
  } else if (inactiveClients === 0 && clients.length > 0) {
    list.push({
      id: "client-positive",
      type: "positive",
      message: "Clientes engajados. Frequencia de retorno esta saudavel.",
    });
  }

  if (pfLow) {
    list.push({
      id: "low-pf",
      type: "warning",
      message: "PF abaixo do recomendado para os proximos dias.",
    });
  }

  if (hasUpcomingBills) {
    const urgentCount = paymentAccounts
      .filter((account) => account.status !== "pago")
      .filter((account) => account.status === "atrasado" || getDaysUntilDue(account.dueDate, now) <= CFG.urgentBillsDays)
      .length;

    list.push({
      id: "bills-window",
      type: urgentCount > 0 ? "warning" : "info",
      message:
        urgentCount > 0
          ? `${urgentCount} conta(s) exigem acao imediata.`
          : "Contas proximas no radar. Planejamento recomendado.",
    });
  }

  if (goalsNear.length > 0) {
    list.push({
      id: "goal-near",
      type: "info",
      message: `Meta de ${goalsNear[0].name} esta quase concluida.`,
    });
  }

  if (performanceDrop) {
    list.push({
      id: "performance-drop",
      type: "warning",
      message: "Receita da semana recuou. Ajuste sua agenda comercial.",
    });
  } else {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = endOfDay(now);
    const monthIncome = sumBetween(transactions, monthStart, monthEnd, TransactionType.INCOME);
    const monthExpense = sumBetween(transactions, monthStart, monthEnd, TransactionType.EXPENSE);

    if (monthIncome > monthExpense) {
      list.push({
        id: "result-positive",
        type: "positive",
        message: "Resultado liquido positivo no periodo atual.",
      });
    }
  }

  if (list.length === 0) {
    list.push({
      id: "stable",
      type: "positive",
      message: "Cenario estavel. Operacao no trilho certo.",
    });
  }

  return list.slice(0, CFG.notificationMaxItems);
}

export function buildDashboardIntelligence(params: {
  clients: Client[];
  pots: Pot[];
  paymentAccounts: PaymentAccount[];
  transactions: Transaction[];
  now?: Date;
}): DashboardIntelligence {
  const { clients, pots, paymentAccounts, transactions } = params;
  const now = params.now ?? new Date();

  const upcomingBills = getUpcomingBills(paymentAccounts, now);
  const hasUpcomingBills = upcomingBills.length > 0;
  const goalsNear = getGoalsNear(pots);
  const performanceDrop = isPerformanceDrop(transactions, now);

  const pfPot = getPfPot(pots);
  const pfBalance = pfPot?.balance ?? 0;

  const last30Start = startOfDay(shiftDays(now, -29));
  const last30End = endOfDay(now);
  const expense30 = sumBetween(transactions, last30Start, last30End, TransactionType.EXPENSE);
  const avgDailyExpense = expense30 / 30;
  const dynamicPfFloor = Math.max(
    CFG.pfAbsoluteFloor,
    avgDailyExpense * CFG.pfExpenseCoverageDays
  );
  const pfLow = pfBalance < dynamicPfFloor;

  const isAllGood = !hasUpcomingBills && goalsNear.length === 0 && !performanceDrop;

  let headerState: HeaderState = "positive";
  let headerMessage = "Tudo em dia. Fluxo saudavel e operacao estavel.";

  if (hasUpcomingBills) {
    headerState = "alert";
    headerMessage = "Alerta: existem contas proximas do vencimento.";
  } else if (performanceDrop) {
    headerState = "attention";
    headerMessage = "Atencao: houve queda de desempenho na ultima semana.";
  } else if (goalsNear.length > 0) {
    headerState = "incentive";
    headerMessage = "Incentivo: metas proximas de conclusao.";
  }

  const greetingTone: "warning" | "positive" = hasUpcomingBills ? "warning" : "positive";
  const greetingMessage = hasUpcomingBills
    ? "Atencao: priorize as contas proximas e preserve seu caixa PF."
    : "Tudo em dia, esse dinheiro e seu.";

  const notifications = buildNotifications({
    clients,
    paymentAccounts,
    transactions,
    now,
    hasUpcomingBills,
    goalsNear,
    pfLow,
    performanceDrop,
  });

  return {
    headerState,
    headerMessage,
    pfBalance,
    hasUpcomingBills,
    isAllGood,
    greetingMessage,
    greetingTone,
    notifications,
  };
}
