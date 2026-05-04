import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  PieChart,
  ShieldAlert,
  Target,
  WalletCards,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { getUserOnboardingData } from "@/lib/auth";
import {
  calculateTotals,
  getTransactionNetAmount,
  isInCurrentMonth,
  parseDateSafe,
} from "@/lib/finance";
import { generateProactiveInsights } from "@/lib/consultorInsights";
import { PotType, TransactionType, type Transaction } from "@/lib/types";
import type { DashboardIntelligence } from "@/lib/dashboardIntelligence";
import { getPersonalFreeMoneyDetails } from "@/lib/personalFreeMoney";
import { formatCurrency } from "@/lib/utils";

type InicioModuleProps = {
  userName?: string;
  intelligence: DashboardIntelligence;
};

type BucketKey = "personal" | "business" | "reserve";
type EvolutionRange = "7d" | "30d" | "month";

type EvolutionRow = {
  date: Date;
  key: string;
  label: string;
  income: number;
  expense: number;
  reserve: number;
  periodBalance: number;
};

type ChartPoint = {
  x: number;
  y: number;
  value: number;
  row: EvolutionRow;
};

type ProjectionPoint = {
  x: number;
  y: number;
  value: number;
  label: string;
};

type EvolutionSeries = {
  rows: EvolutionRow[];
  width: number;
  height: number;
  baseY: number;
  incomePoints: ChartPoint[];
  expensePoints: ChartPoint[];
  reservePoints: ChartPoint[];
  projectionPoints: ProjectionPoint[];
  periodTotals: {
    income: number;
    expense: number;
    balance: number;
  };
  reserveCurrent: number;
  projectedNext7Days: number;
  hasForecastData: boolean;
  insight: string;
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const EVOLUTION_COLORS = {
  income: "#22c55e",
  expense: "#fb7185",
  reserve: "#22d3ee",
  projection: "#e2e8f0",
} as const;

const EVOLUTION_RANGE_LABEL: Record<EvolutionRange, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Mês",
};

const EVOLUTION_RANGES: EvolutionRange[] = ["7d", "30d", "month"];

function monthLabel(now = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(now)
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function isOnboardingSeed(transaction: Transaction) {
  return (
    transaction.notes === "onboarding-seed-income" ||
    (transaction.origin === "Onboarding" &&
      transaction.category === "onboarding" &&
      transaction.description === "Saldo inicial configurado no onboarding")
  );
}

function isCostInCurrentMonth(cost: { date: string }) {
  const date = parseDateSafe(cost.date);
  return date ? isInCurrentMonth(date) : false;
}

function parseTransactionDate(transaction: Transaction) {
  return parseDateSafe(transaction.date) ?? (transaction.createdAt ? parseDateSafe(transaction.createdAt) : null);
}

function getFixedExpenseTotal(items: Array<{ amount: number }>) {
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

function pointsPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function areaPath(points: Array<{ x: number; y: number }>, baseY: number) {
  if (points.length === 0) return "";
  const line = pointsPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x},${baseY} L${first.x},${baseY} Z`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(date: Date, compact = false) {
  if (compact) return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  return DAY_LABELS[date.getDay()];
}

function getLatestTransactionDate(transactions: Transaction[]) {
  return transactions.reduce<Date | null>((latest, tx) => {
    const parsed = parseTransactionDate(tx);
    if (!parsed) return latest;
    return !latest || parsed.getTime() > latest.getTime() ? parsed : latest;
  }, null);
}

function buildPeriodDays(range: EvolutionRange, anchorDate: Date) {
  const anchor = startOfDay(anchorDate);
  if (range === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const days: Date[] = [];
    for (let day = first; day.getTime() <= anchor.getTime(); day = addDays(day, 1)) {
      days.push(startOfDay(day));
    }
    return days;
  }

  const length = range === "30d" ? 30 : 7;
  return Array.from({ length }).map((_, offset) => startOfDay(addDays(anchor, offset - (length - 1))));
}

function clampChartValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function potBucketForTransaction(transaction: Transaction, pots: ReturnType<typeof useApp>["pots"]): BucketKey {
  const pot = transaction.potId ? pots.find((item) => item.id === transaction.potId) : undefined;
  if (pot?.type === PotType.BUSINESS) return "business";
  if (pot?.type === PotType.RESERVE) return "reserve";
  return "personal";
}

function buildRealPotBalances(transactions: Transaction[], pots: ReturnType<typeof useApp>["pots"], distribution: ReturnType<typeof useApp>["potDistribution"]) {
  const balances: Record<BucketKey, number> = {
    personal: 0,
    business: 0,
    reserve: 0,
  };

  transactions.forEach((transaction) => {
    if (transaction.type === TransactionType.INCOME) {
      const net = getTransactionNetAmount(transaction);
      balances.personal += (net * distribution.personal) / 100;
      balances.business += (net * distribution.business) / 100;
      balances.reserve += (net * distribution.reserve) / 100;
      return;
    }

    if (transaction.type === TransactionType.EXPENSE) {
      const bucket = potBucketForTransaction(transaction, pots);
      balances[bucket] -= Math.max(0, transaction.amount);
    }
  });

  return {
    personal: Number(Math.max(0, balances.personal).toFixed(2)),
    business: Number(Math.max(0, balances.business).toFixed(2)),
    reserve: Number(Math.max(0, balances.reserve).toFixed(2)),
  };
}

export default function InicioModule({ userName, intelligence }: InicioModuleProps) {
  const {
    pots,
    transactions,
    potDistribution,
    user,
    paymentAccounts,
    clients,
    salesItems,
    costs,
    adjustmentAccounts,
  } = useApp();
  const [, setLocation] = useLocation();
  const [evolutionRange, setEvolutionRange] = useState<EvolutionRange>("7d");
  const [activeChartKey, setActiveChartKey] = useState<string | null>(null);

  const onboardingData = useMemo(() => (user?.id ? getUserOnboardingData(user.id) : {}), [user?.id]);
  const realTransactions = useMemo(() => transactions.filter((tx) => !isOnboardingSeed(tx)), [transactions]);
  const monthTransactions = useMemo(
    () =>
      realTransactions.filter((tx) => {
        const date = parseTransactionDate(tx);
        return date ? isInCurrentMonth(date) : false;
      }),
    [realTransactions]
  );
  const dashboardTransactions = useMemo(
    () => (monthTransactions.length > 0 ? monthTransactions : realTransactions),
    [monthTransactions, realTransactions]
  );
  const dashboardUsesCurrentMonth = monthTransactions.length > 0 || realTransactions.length === 0;
  const dashboardTotals = useMemo(() => calculateTotals(dashboardTransactions), [dashboardTransactions]);
  const monthCosts = useMemo(
    () => costs.filter(isCostInCurrentMonth).reduce((sum, cost) => sum + Math.max(0, cost.amount), 0),
    [costs]
  );
  const dashboardCosts = useMemo(
    () =>
      dashboardUsesCurrentMonth
        ? monthCosts
        : costs.reduce((sum, cost) => sum + Math.max(0, cost.amount), 0),
    [costs, dashboardUsesCurrentMonth, monthCosts]
  );
  const fixedCommitments = useMemo(
    () => getFixedExpenseTotal(onboardingData.fixedExpenses ?? []),
    [onboardingData.fixedExpenses]
  );
  const hasRealIncome = dashboardTransactions.some((tx) => tx.type === TransactionType.INCOME);
  const hasAnyRealMovement = dashboardTransactions.length > 0;
  const realPotBalances = useMemo(
    () => buildRealPotBalances(realTransactions, pots, potDistribution),
    [potDistribution, pots, realTransactions]
  );
  const personalFreeMoneyDetails = useMemo(
    () => getPersonalFreeMoneyDetails(pots, adjustmentAccounts),
    [adjustmentAccounts, pots]
  );
  const metaMensal = Number(onboardingData.metaMensal ?? 0);
  const estimatedGrossMonthlyRevenue = useMemo(() => {
    const savedProjection = Number(onboardingData.estimatedGrossMonthlyRevenue ?? onboardingData.projectedMonthlyGrossRevenue ?? 0);
    if (Number.isFinite(savedProjection) && savedProjection > 0) return savedProjection;
    if (metaMensal <= 0 || potDistribution.personal <= 0) return 0;
    return Number((metaMensal / (potDistribution.personal / 100)).toFixed(2));
  }, [metaMensal, onboardingData.estimatedGrossMonthlyRevenue, onboardingData.projectedMonthlyGrossRevenue, potDistribution.personal]);
  const dailyRevenueTarget = useMemo(() => {
    const savedProjection = Number(onboardingData.dailyRevenueTarget ?? onboardingData.projectedDailyGrossRevenue ?? 0);
    if (Number.isFinite(savedProjection) && savedProjection > 0) return savedProjection;
    return Number((estimatedGrossMonthlyRevenue / 22).toFixed(2));
  }, [estimatedGrossMonthlyRevenue, onboardingData.dailyRevenueTarget, onboardingData.projectedDailyGrossRevenue]);
  const lucroLiquido = hasRealIncome ? Number((dashboardTotals.income - dashboardTotals.fees - dashboardCosts).toFixed(2)) : 0;
  const personalFreeMoney = personalFreeMoneyDetails.personalFreeMoney;
  const hasPersonalDeficit = personalFreeMoneyDetails.deficit > 0;

  const proactiveInsights = useMemo(
    () =>
      generateProactiveInsights({
        transactions: realTransactions,
        pots,
        paymentAccounts,
        fixedExpenses: onboardingData.fixedExpenses ?? [],
        clients,
        salesItems,
        costs,
      }),
    [realTransactions, pots, paymentAccounts, onboardingData.fixedExpenses, clients, salesItems, costs]
  );

  const health = useMemo(() => {
    if (!hasRealIncome) {
      return {
        index: 0,
        status: "Comece registrando sua primeira entrada.",
        helper: "Comece registrando sua primeira entrada para ver seu dinheiro real.",
        tone: "empty" as const,
      };
    }

    const positiveResult = lucroLiquido >= 0;
    const reserveBase = Math.max(dashboardCosts, fixedCommitments, 1);
    const reserveScore = Math.min(realPotBalances.reserve / reserveBase, 1);
    const index = Math.round(35 + (positiveResult ? 35 : 10) + reserveScore * 30);

    if (realPotBalances.reserve <= reserveBase * 0.2) {
      return {
        index: Math.max(0, Math.min(index, 100)),
        status: "Atenção: sua reserva ainda precisa crescer.",
        helper: "Seu caixa já tem movimento real. Agora proteja a reserva.",
        tone: "warning" as const,
      };
    }

    return {
      index: Math.max(0, Math.min(index, 100)),
      status: "Boa! Você está no caminho certo.",
      helper: "Continue registrando entradas e saídas para manter clareza.",
      tone: "positive" as const,
    };
  }, [dashboardCosts, fixedCommitments, hasRealIncome, lucroLiquido, realPotBalances.reserve]);

  const evolutionSeries = useMemo(() => {
    const latestTransactionDate = getLatestTransactionDate(realTransactions);
    const anchorDate = hasAnyRealMovement && latestTransactionDate ? latestTransactionDate : new Date();
    const days = buildPeriodDays(evolutionRange, anchorDate);
    const firstDay = days[0] ?? startOfDay(anchorDate);
    const lastDay = days[days.length - 1] ?? startOfDay(anchorDate);
    const reservePot = pots.find((pot) => pot.type === PotType.RESERVE);
    const sortedTransactions = [...realTransactions].sort((a, b) => {
      const aTime = parseTransactionDate(a)?.getTime() ?? 0;
      const bTime = parseTransactionDate(b)?.getTime() ?? 0;
      return aTime - bTime;
    });

    let reserveBalance = 0;
    let transactionCursor = 0;

    const applyReserveMovement = (transaction: Transaction) => {
      if (transaction.type === TransactionType.INCOME) {
        const distribution = transaction.potDistribution ?? potDistribution;
        reserveBalance = Number((reserveBalance + (getTransactionNetAmount(transaction) * Number(distribution.reserve ?? 0)) / 100).toFixed(2));
        return;
      }

      if (transaction.type === TransactionType.EXPENSE && potBucketForTransaction(transaction, pots) === "reserve") {
        reserveBalance = Number((reserveBalance - Math.max(0, transaction.amount)).toFixed(2));
      }
    };

    while (transactionCursor < sortedTransactions.length) {
      const parsed = parseTransactionDate(sortedTransactions[transactionCursor]);
      if (!parsed || parsed.getTime() >= firstDay.getTime()) break;
      applyReserveMovement(sortedTransactions[transactionCursor]);
      transactionCursor += 1;
    }

    const rows: EvolutionRow[] = days.map((date) => {
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();
      const dayTx = realTransactions.filter((tx) => {
        const parsed = parseTransactionDate(tx);
        if (!parsed) return false;
        const time = parsed.getTime();
        return time >= dayStart && time <= dayEnd;
      });
      const totals = calculateTotals(dayTx);

      while (transactionCursor < sortedTransactions.length) {
        const parsed = parseTransactionDate(sortedTransactions[transactionCursor]);
        if (!parsed || parsed.getTime() > dayEnd) break;
        applyReserveMovement(sortedTransactions[transactionCursor]);
        transactionCursor += 1;
      }

      return {
        date,
        key: dateKey(date),
        label: shortDateLabel(date, evolutionRange !== "7d"),
        income: Number(totals.income.toFixed(2)),
        expense: Number(totals.expense.toFixed(2)),
        reserve: Number(Math.max(0, reserveBalance).toFixed(2)),
        periodBalance: Number((totals.netIncome - totals.expense).toFixed(2)),
      };
    });

    const lastSevenRows = rows.slice(-7);
    const dailyNetAverage =
      lastSevenRows.length > 0
        ? Number((lastSevenRows.reduce((sum, row) => sum + row.periodBalance, 0) / lastSevenRows.length).toFixed(2))
        : 0;
    const hasForecastData = rows.some((row) => row.income > 0 || row.expense > 0);
    const projectedNext7Days = hasForecastData ? Number((dailyNetAverage * 7).toFixed(2)) : 0;
    const lastRealRow = rows[rows.length - 1];
    const projectionRows = hasForecastData && lastRealRow
      ? Array.from({ length: 8 }).map((_, index) => ({
          label: index === 0 ? lastRealRow.label : shortDateLabel(addDays(lastDay, index), true),
          value: Number((lastRealRow.reserve + dailyNetAverage * index).toFixed(2)),
        }))
      : [];

    const values = [
      0,
      ...rows.flatMap((row) => [row.income, row.expense, row.reserve]),
      ...projectionRows.map((row) => row.value),
    ].map(clampChartValue);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const width = Math.max(720, rows.length * 48 + projectionRows.length * 30);
    const height = 280;
    const paddingX = 42;
    const paddingY = 24;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;
    const totalSlots = Math.max(rows.length + Math.max(projectionRows.length - 1, 0) - 1, 1);
    const yFor = (value: number) => paddingY + ((max - value) / Math.max(max - min, 1)) * usableH;
    const xForSlot = (index: number) => paddingX + (usableW / totalSlots) * index;
    const toPoints = (key: "income" | "expense" | "reserve"): ChartPoint[] =>
      rows.map((row, index) => ({
        x: xForSlot(index),
        y: yFor(row[key]),
        value: row[key],
        row,
      }));
    const projectionPoints: ProjectionPoint[] = projectionRows.map((row, index) => ({
      x: xForSlot(rows.length - 1 + index),
      y: yFor(row.value),
      value: row.value,
      label: row.label,
    }));
    const periodTotals = rows.reduce(
      (totals, row) => ({
        income: totals.income + row.income,
        expense: totals.expense + row.expense,
        balance: totals.balance + row.periodBalance,
      }),
      { income: 0, expense: 0, balance: 0 }
    );
    const reserveStarted = rows[0]?.reserve ?? 0;
    const reserveCurrent = reservePot?.balance ?? rows[rows.length - 1]?.reserve ?? 0;
    const reserveGrew = reserveCurrent > reserveStarted + 0.01;
    const insight = !hasForecastData
      ? "Adicione seus primeiros lançamentos para acompanhar sua evolução."
      : periodTotals.expense > periodTotals.income
        ? "Suas saídas passaram das entradas neste período."
        : reserveGrew
          ? "Sua reserva está crescendo."
          : "Você está fechando o período positivo.";

    return {
      rows,
      width,
      height,
      baseY: yFor(0),
      yFor,
      incomePoints: toPoints("income"),
      expensePoints: toPoints("expense"),
      reservePoints: toPoints("reserve"),
      projectionPoints,
      periodTotals: {
        income: Number(periodTotals.income.toFixed(2)),
        expense: Number(periodTotals.expense.toFixed(2)),
        balance: Number(periodTotals.balance.toFixed(2)),
      },
      reserveCurrent,
      projectedNext7Days,
      hasForecastData,
      insight,
    };
  }, [evolutionRange, hasAnyRealMovement, potDistribution, pots, realTransactions]);

  const potDistributionChart = useMemo(() => {
    const entries = [
      {
        key: "personal",
        label: "Pessoal",
        percent: potDistribution.personal,
        value: realPotBalances.personal,
        color: "#38bdf8",
      },
      {
        key: "business",
        label: "Negócio",
        percent: potDistribution.business,
        value: realPotBalances.business,
        color: "#22c55e",
      },
      {
        key: "reserve",
        label: "Reserva",
        percent: potDistribution.reserve,
        value: realPotBalances.reserve,
        color: "#fbbf24",
      },
    ];
    let cursor = 0;
    const stops = entries.map((entry) => {
      const start = cursor;
      cursor += entry.percent;
      return `${entry.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
    });
    return {
      entries,
      total: entries.reduce((sum, entry) => sum + entry.value, 0),
      gradient: stops.length ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#1f2937 0% 100%)",
    };
  }, [potDistribution.business, potDistribution.personal, potDistribution.reserve, realPotBalances]);

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (onboardingData.flag_separacao) list.push("Separação ativada: lembre de tirar sua parte.");
    if (onboardingData.focus === "precificacao") list.push("Foco em precificação: acompanhe sua margem por serviço.");
    if (onboardingData.focus === "seguranca") list.push("Foco em segurança: fortaleça sua reserva.");
    if (list.length === 0) list.push(hasAnyRealMovement ? "Nenhum alerta crítico por enquanto." : "Nenhum alerta crítico por enquanto.");
    return list;
  }, [hasAnyRealMovement, onboardingData.flag_separacao, onboardingData.focus]);

  const fluxMessage = !hasRealIncome
    ? "Registre sua primeira entrada para eu analisar seu dinheiro."
    : proactiveInsights[0]?.message ?? intelligence.greetingMessage;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[FluxoCerto Dashboard]", {
      officialTransactions: realTransactions.length,
      dashboardTransactions: dashboardTransactions.length,
      firstTransaction: realTransactions[0],
      lastTransaction: realTransactions[realTransactions.length - 1],
      totals: dashboardTotals,
      realPotBalances,
      personalFreeMoneyDetails,
    });
  }, [dashboardTotals, dashboardTransactions.length, personalFreeMoneyDetails, realPotBalances, realTransactions]);

  const summaryCards = [
    {
      label: "Entradas",
      value: formatCurrency(dashboardTotals.income),
      helper: hasRealIncome ? "Entradas reais no mês" : "Sem entradas reais",
      icon: ArrowDownCircle,
      tone: "success",
    },
    {
      label: "Saídas",
      value: formatCurrency(dashboardTotals.expense),
      helper: "Saídas reais no mês",
      icon: ArrowUpCircle,
      tone: "danger",
    },
    {
      label: "Lucro líquido",
      value: formatCurrency(lucroLiquido),
      helper: "Entradas brutas - taxas - custos",
      icon: CircleDollarSign,
      tone: hasRealIncome && lucroLiquido < 0 ? "danger" : "success",
    },
    {
      label: "Dinheiro livre",
      value: formatCurrency(personalFreeMoney),
      helper: hasPersonalDeficit
        ? "Compromissos pessoais passam do saldo pessoal."
        : personalFreeMoneyDetails.personalBalance > 0
          ? "Valor pessoal seguro para usar sem comprometer contas."
          : "Saldo pessoal ainda zerado.",
      icon: WalletCards,
      tone: "info",
    },
    {
      label: "Sua meta diária inteligente",
      value: formatCurrency(dailyRevenueTarget),
      helper: "Essa é a média diária estimada para aproximar você da sua meta mensal.",
      icon: Target,
      tone: "info",
    },
    {
      label: "Meta mensal de faturamento bruto",
      value: formatCurrency(estimatedGrossMonthlyRevenue),
      helper: "Meta de faturamento bruto mensal. Não é saldo disponível.",
      icon: PieChart,
      tone: "success",
    },
  ];

  return (
    <>
      <section className="fd-home-premium">
        <header className="fd-home-premium-header">
          <div>
            <h2>Olá, {userName ?? "empreendedor"}!</h2>
            <p>Aqui está a saúde do seu dinheiro hoje.</p>
          </div>
          <div className="fd-home-header-actions">
            <button type="button" className="fd-home-month">
              <CalendarDays className="h-4 w-4" />
              {monthLabel()}
            </button>
          </div>
        </header>

        <div className="fd-home-hero-grid">
          <article className="fd-home-health-card">
            <div>
              <div className="fd-card-kicker">
                <span>Sua saúde financeira</span>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h3>{health.status}</h3>
              <p>{health.helper}</p>
              <strong>{hasRealIncome ? `${health.index}%` : "Em construção"}</strong>
              <div className="fd-health-bar">
                <div style={{ width: `${health.index}%` }} />
              </div>
            </div>
            <div className="fd-health-ring" style={{ "--value": `${health.index}%` } as React.CSSProperties}>
              <div>
                <span>Índice de controle</span>
                <strong>{health.index}%</strong>
              </div>
            </div>
          </article>

          <article className="fd-home-flux-card">
            <img src="/mascoteprincipal.png" alt="Flux" />
            <div>
              <strong>Flux diz:</strong>
              <p>{fluxMessage}</p>
              <button type="button" onClick={() => setLocation("/consultor")}>
                Ver análise completa
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        </div>

        <section className="fd-home-summary-strip">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className={`fd-home-summary-card ${card.tone}`}>
                <span>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p>{card.label}</p>
                  <h3>{card.value}</h3>
                  <small>{card.helper}</small>
                </div>
              </article>
            );
          })}
        </section>

        <section className="fd-home-main-grid">
          <article className="fd-home-panel fd-home-chart-panel">
            <div className="fd-home-panel-head">
              <h3>Evolução financeira</h3>
              <div className="fd-evolution-head-actions">
                <span>Baseado nos seus lançamentos</span>
                <div className="fd-evolution-range-tabs" aria-label="Filtro de período da evolução financeira">
                  {EVOLUTION_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={evolutionRange === range ? "active" : ""}
                      onClick={() => setEvolutionRange(range)}
                    >
                      {EVOLUTION_RANGE_LABEL[range]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {!hasAnyRealMovement ? (
              <div className="fd-home-empty">
                <BarChart3 className="h-8 w-8" />
                <strong>Adicione seus primeiros lançamentos.</strong>
                <p>Assim você acompanha entradas, saídas, reserva e previsão sem misturar meta com saldo real.</p>
              </div>
            ) : (
              <FinancialEvolutionContent
                series={evolutionSeries}
                activeKey={activeChartKey}
                onActivate={setActiveChartKey}
              />
            )}
          </article>

          <article className="fd-home-panel fd-home-pots-panel">
            <div className="fd-home-panel-head">
              <h3>Distribuição dos potes</h3>
            </div>
            <div className="fd-home-donut-wrap">
              <div className="fd-home-donut" style={{ background: potDistributionChart.gradient }}>
                <div>
                  <span>Total real</span>
                  <strong>{formatCurrency(potDistributionChart.total)}</strong>
                </div>
              </div>
            </div>
            <div className="fd-home-pot-list">
              {potDistributionChart.entries.map((entry) => (
                <div key={entry.key}>
                  <span className="dot" style={{ background: entry.color }} />
                  <p>{entry.label}</p>
                  <strong>{entry.percent.toFixed(0)}%</strong>
                  <small>{formatCurrency(entry.value)}</small>
                </div>
              ))}
            </div>
          </article>

          <aside className="fd-home-side-stack">
            <article className="fd-home-panel">
              <div className="fd-home-panel-head">
                <h3>Alertas importantes</h3>
                <span>Hoje</span>
              </div>
              <div className="fd-home-alert-list">
                {alerts.map((alert, index) => (
                  <div key={`${alert}-${index}`} className={index === 0 && !hasRealIncome ? "neutral" : "warning"}>
                    <ShieldAlert className="h-5 w-5" />
                    <p>{alert}</p>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                ))}
              </div>
            </article>

          </aside>
        </section>

        <section className="fd-home-panel fd-home-insights-panel">
          <div className="fd-home-panel-head">
            <h3>Insights para você</h3>
          </div>
          <div className="fd-home-insights-grid">
            {proactiveInsights.length > 0 ? (
              proactiveInsights.slice(0, 3).map((insight) => (
                <article key={insight.id}>
                  <Target className="h-6 w-6" />
                  <strong>{insight.title}</strong>
                  <p>{insight.message}</p>
                </article>
              ))
            ) : (
              <article>
                <Target className="h-6 w-6" />
                <strong>Seu primeiro insight aparece após registrar entradas e saídas.</strong>
                <p>{metaMensal > 0 ? `Meta mensal: ${formatCurrency(metaMensal)}. Objetivo que você quer tirar livre por mês.` : "Comece registrando sua primeira movimentação real."}</p>
              </article>
            )}
            {metaMensal > 0 ? (
              <article>
                <PieChart className="h-6 w-6" />
                <strong>Meta mensal: {formatCurrency(metaMensal)}</strong>
                <p>Objetivo que você quer tirar livre por mês. Não entra como saldo real.</p>
              </article>
            ) : null}
          </div>
        </section>

        <footer className="fd-home-security-note">
          Seus dados estáo protegidos com criptografia de ponta a ponta.
        </footer>
      </section>

    </>
  );
}

function FinancialEvolutionContent({
  series,
  activeKey,
  onActivate,
}: {
  series: EvolutionSeries;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}) {
  const activeRow = series.rows.find((row) => row.key === activeKey) ?? series.rows[series.rows.length - 1];
  const legend = [
    { label: "Entradas", color: EVOLUTION_COLORS.income },
    { label: "Saídas", color: EVOLUTION_COLORS.expense },
    { label: "Reserva", color: EVOLUTION_COLORS.reserve },
    { label: "Previsão", color: EVOLUTION_COLORS.projection, dashed: true },
  ];
  const summary = [
    { label: "Entradas", value: formatCurrency(series.periodTotals.income), tone: "success" },
    { label: "Saídas", value: formatCurrency(series.periodTotals.expense), tone: "danger" },
    { label: "Reserva", value: formatCurrency(series.reserveCurrent), tone: "info" },
    { label: "Saldo do período (não é lucro líquido)", value: formatCurrency(series.periodTotals.balance), tone: "neutral" },
  ];

  return (
    <div className="fd-evolution">
      <div className="fd-evolution-chart-scroll">
        <div className="fd-evolution-chart" style={{ minWidth: series.width }}>
          <svg
            viewBox={`0 0 ${series.width} ${series.height}`}
            role="img"
            aria-label="Evolução financeira com entradas, saídas, reserva e previsão"
            onMouseLeave={() => onActivate(null)}
          >
            {[0.2, 0.4, 0.6, 0.8].map((line) => (
              <line
                key={line}
                x1="42"
                x2={series.width - 42}
                y1={series.height * line}
                y2={series.height * line}
                stroke="rgba(148,163,184,0.13)"
                strokeDasharray="4 8"
              />
            ))}
            <line x1="42" x2={series.width - 42} y1={series.baseY} y2={series.baseY} stroke="rgba(226,255,242,0.24)" />
            <EvolutionPolyline points={series.incomePoints} color={EVOLUTION_COLORS.income} />
            <EvolutionPolyline points={series.expensePoints} color={EVOLUTION_COLORS.expense} />
            <EvolutionPolyline points={series.reservePoints} color={EVOLUTION_COLORS.reserve} />
            <EvolutionProjection points={series.projectionPoints} />
            {series.rows.map((row, index) => {
              const point = series.reservePoints[index];
              if (!point) return null;
              return (
                <g key={row.key}>
                  <rect
                    x={point.x - 18}
                    y="0"
                    width="36"
                    height={series.height}
                    fill="transparent"
                    onMouseEnter={() => onActivate(row.key)}
                    onFocus={() => onActivate(row.key)}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={activeRow?.key === row.key ? 5 : 3}
                    fill={EVOLUTION_COLORS.reserve}
                    stroke="#020617"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
          <div className="fd-evolution-axis" style={{ gridTemplateColumns: `repeat(${series.rows.length}, minmax(34px, 1fr))` }}>
            {series.rows.map((row) => (
              <span key={row.key}>{row.label}</span>
            ))}
          </div>
        </div>
      </div>

      {activeRow ? (
        <div className="fd-evolution-tooltip">
          <strong>{activeRow.label}</strong>
          <span>Entradas: {formatCurrency(activeRow.income)}</span>
          <span>Saídas: {formatCurrency(activeRow.expense)}</span>
          <span>Reserva: {formatCurrency(activeRow.reserve)}</span>
        </div>
      ) : null}

      <div className="fd-evolution-legend">
        {legend.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color, borderStyle: item.dashed ? "dashed" : "solid" }} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="fd-evolution-summary">
        {summary.map((item) => (
          <article key={item.label} className={item.tone}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="fd-evolution-insight">
        <strong>{series.insight}</strong>
        <p>
          {series.hasForecastData
            ? `Previsão para os próximos 7 dias: ${formatCurrency(series.projectedNext7Days)}. Use como tendência, não como valor garantido.`
            : "Previsão disponível após alguns lançamentos."}
        </p>
      </div>
    </div>
  );
}

function EvolutionPolyline({ points, color }: { points: ChartPoint[]; color: string }) {
  if (points.length === 0) return null;
  return (
    <path
      d={pointsPath(points)}
      fill="none"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function EvolutionProjection({ points }: { points: ProjectionPoint[] }) {
  if (points.length < 2) return null;
  return (
    <>
      <path
        d={pointsPath(points)}
        fill="none"
        stroke={EVOLUTION_COLORS.projection}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="7 9"
        opacity="0.92"
      />
      <text
        x={points[points.length - 1].x}
        y={Math.max(18, points[points.length - 1].y - 12)}
        fill={EVOLUTION_COLORS.projection}
        fontSize="12"
        fontWeight="800"
        textAnchor="end"
      >
        Previsão
      </text>
    </>
  );
}

