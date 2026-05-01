import { useEffect, useMemo } from "react";
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
  TrendingUp,
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
import { formatCurrency } from "@/lib/utils";

type InicioModuleProps = {
  userName?: string;
  intelligence: DashboardIntelligence;
};

type BucketKey = "personal" | "business" | "reserve";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  } = useApp();
  const [, setLocation] = useLocation();

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
  const metaMensal = Number(onboardingData.metaMensal ?? 0);
  const lucroLiquido = hasRealIncome ? Number((dashboardTotals.income - dashboardTotals.fees - dashboardCosts).toFixed(2)) : 0;
  const dinheiroLivre = hasRealIncome
    ? Number(Math.max(0, realPotBalances.personal + realPotBalances.business - fixedCommitments).toFixed(2))
    : 0;

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
    const latestTransactionDate = realTransactions.reduce<Date | null>((latest, tx) => {
      const parsed = parseTransactionDate(tx);
      if (!parsed) return latest;
      return !latest || parsed.getTime() > latest.getTime() ? parsed : latest;
    }, null);
    const now = hasAnyRealMovement && latestTransactionDate ? latestTransactionDate : new Date();
    const days = Array.from({ length: 7 }).map((_, offset) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - offset));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const rows = days.map((date) => {
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
      const dayTx = realTransactions.filter((tx) => {
        const parsed = parseTransactionDate(tx);
        if (!parsed) return false;
        const time = parsed.getTime();
        return time >= dayStart && time <= dayEnd;
      });
      const totals = calculateTotals(dayTx);
      return {
        label: DAY_LABELS[date.getDay()],
        income: totals.netIncome,
        expense: totals.expense,
        net: totals.periodBalance,
      };
    });

    const cumulative: number[] = [];
    rows.reduce((sum, row, index) => {
      const next = sum + row.net;
      cumulative[index] = next;
      return next;
    }, 0);

    const values = [...rows.map((row) => row.income), ...rows.map((row) => row.expense), ...cumulative];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const width = 620;
    const height = 250;
    const paddingX = 26;
    const paddingY = 24;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;
    const yFor = (value: number) => paddingY + ((max - value) / Math.max(max - min, 1)) * usableH;
    const xFor = (index: number) => paddingX + (usableW / Math.max(rows.length - 1, 1)) * index;
    const balancePoints = cumulative.map((value, index) => ({ x: xFor(index), y: yFor(value) }));

    return {
      rows,
      width,
      height,
      baseY: yFor(0),
      balancePath: pointsPath(balancePoints),
      balanceAreaPath: areaPath(balancePoints, yFor(min)),
      latest: cumulative[cumulative.length - 1] ?? 0,
      best: rows.reduce((best, row) => (row.net > best.net ? row : best), rows[0] ?? { label: "-", net: 0 }),
      dailyAverage: rows.reduce((sum, row) => sum + row.net, 0) / Math.max(rows.length, 1),
    };
  }, [hasAnyRealMovement, realTransactions]);

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
    });
  }, [dashboardTotals, dashboardTransactions.length, realPotBalances, realTransactions]);

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
      value: formatCurrency(dinheiroLivre),
      helper: hasRealIncome
        ? "Valor seguro para usar sem comprometer sua meta."
        : "Registre entradas reais para calcular seu dinheiro livre.",
      icon: WalletCards,
      tone: "info",
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
              <span>Últimos 7 dias</span>
            </div>
            {!hasAnyRealMovement ? (
              <div className="fd-home-empty">
                <BarChart3 className="h-8 w-8" />
                <strong>Sem movimentações ainda.</strong>
                <p>Registre sua primeira entrada para gerar o gráfico.</p>
              </div>
            ) : (
              <>
                <div className="fd-home-chart">
                  <svg viewBox={`0 0 ${evolutionSeries.width} ${evolutionSeries.height}`} role="img" aria-label="Evolução financeira">
                    <defs>
                      <linearGradient id="fd-home-balance-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34,197,94,0.26)" />
                        <stop offset="100%" stopColor="rgba(34,197,94,0.02)" />
                      </linearGradient>
                    </defs>
                    {[0.2, 0.4, 0.6, 0.8].map((line) => (
                      <line
                        key={line}
                        x1="26"
                        x2={evolutionSeries.width - 26}
                        y1={evolutionSeries.height * line}
                        y2={evolutionSeries.height * line}
                        stroke="rgba(148,163,184,0.12)"
                        strokeDasharray="4 6"
                      />
                    ))}
                    <line x1="26" x2={evolutionSeries.width - 26} y1={evolutionSeries.baseY} y2={evolutionSeries.baseY} stroke="rgba(148,163,184,0.22)" />
                    <path d={evolutionSeries.balanceAreaPath} fill="url(#fd-home-balance-fill)" />
                    <path d={evolutionSeries.balancePath} fill="none" stroke="#6ee75f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="fd-home-axis">
                    {evolutionSeries.rows.map((row) => (
                      <span key={row.label}>{row.label}</span>
                    ))}
                  </div>
                </div>
                <div className="fd-home-chart-stats">
                  <div>
                    <TrendingUp className="h-5 w-5" />
                    <span>Melhor dia</span>
                    <strong>{evolutionSeries.best.label}</strong>
                  </div>
                  <div>
                    <span>Média diária</span>
                    <strong>{formatCurrency(evolutionSeries.dailyAverage)}</strong>
                  </div>
                </div>
              </>
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

