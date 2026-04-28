import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, Gauge, TrendingUp } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { getUserOnboardingData } from "@/lib/auth";
import {
  calculateCashflowForecast,
  formatCurrency,
  formatPercentage,
  getCashRiskLevel,
  getMonthlyComparison,
} from "@/lib/cashflowForecast";
import {
  buildDailyTotals,
  calculateTotals,
  isInCurrentMonth,
  parseDateSafe,
  sortTransactionsByDateDesc,
} from "@/lib/finance";
import { TransactionType } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function FlowBarsChart({ data }: { data: Array<{ date: string; value: number }> }) {
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="fd-flow-chart">
      <div className="fd-flow-bars">
        {data.map((item) => {
          const percent = Math.max(8, Math.round((Math.abs(item.value) / maxAbs) * 100));
          return (
            <div key={item.date} className="fd-flow-bar-col">
              <span className={item.value >= 0 ? "positive" : "negative"}>
                {item.value >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(item.value))}
              </span>
              <div className="fd-flow-bar-track">
                <div className={item.value >= 0 ? "positive" : "negative"} style={{ height: `${percent}%` }} />
              </div>
              <small>
                {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsDonut({ income, expense, costs }: { income: number; expense: number; costs: number }) {
  const total = Math.max(1, income + expense + costs);
  const incomePct = Math.round((income / total) * 100);
  const expensePct = Math.round((expense / total) * 100);
  const costsPct = Math.max(0, 100 - incomePct - expensePct);

  return (
    <div className="fd-analytics-donut-wrap">
      <div
        className="fd-analytics-donut"
        style={{
          background: `conic-gradient(#22c55e 0 ${incomePct}%, #f97316 ${incomePct}% ${
            incomePct + expensePct
          }%, #38bdf8 ${incomePct + expensePct}% 100%)`,
        }}
      />
      <div className="fd-analytics-donut-legend">
        <div>
          <span className="dot income" />
          <p>Entradas</p>
          <strong>{incomePct}%</strong>
        </div>
        <div>
          <span className="dot expense" />
          <p>Saidas</p>
          <strong>{expensePct}%</strong>
        </div>
        <div>
          <span className="dot costs" />
          <p>Custos</p>
          <strong>{costsPct}%</strong>
        </div>
      </div>
    </div>
  );
}

function ForecastLineChart({
  points,
}: {
  points: Array<{ day: number; balance: number; conservativeBalance: number; bestBalance: number }>;
}) {
  if (points.length === 0) return null;

  const values = points.flatMap((point) => [point.balance, point.conservativeBalance, point.bestBalance]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 960;
  const height = 220;
  const padX = 24;
  const padY = 18;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const toX = (index: number) => padX + (index / Math.max(1, points.length - 1)) * usableW;
  const toY = (value: number) => padY + (1 - (value - min) / range) * usableH;
  const toPath = (list: number[]) => list.map((value, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(value)}`).join(" ");

  const projectedPath = toPath(points.map((item) => item.balance));
  const conservativePath = toPath(points.map((item) => item.conservativeBalance));
  const bestPath = toPath(points.map((item) => item.bestBalance));

  return (
    <div className="fd-forecast-chart-wrap">
      <svg className="fd-forecast-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de projecao de caixa">
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padY + usableH * ratio}
            y2={padY + usableH * ratio}
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth="1"
          />
        ))}
        <path d={conservativePath} className="fd-forecast-line conservative" />
        <path d={bestPath} className="fd-forecast-line best" />
        <path d={projectedPath} className="fd-forecast-line projected" />
      </svg>
      <div className="fd-forecast-legend">
        <span>
          <i className="projected" /> Cenario estimado
        </span>
        <span>
          <i className="best" /> Melhor cenario
        </span>
        <span>
          <i className="conservative" /> Cenario conservador
        </span>
      </div>
    </div>
  );
}

function MonthlyComparisonChart({
  rows,
}: {
  rows: Array<{ monthKey: string; label: string; income: number; expense: number; net: number }>;
}) {
  if (rows.length === 0) return null;
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [Math.abs(row.income), Math.abs(row.expense)])
  );

  return (
    <div className="fd-monthly-bars">
      {rows.map((row) => {
        const incomePct = Math.max(8, Math.round((row.income / maxValue) * 100));
        const expensePct = Math.max(8, Math.round((row.expense / maxValue) * 100));
        return (
          <div key={row.monthKey} className="fd-monthly-bar-row">
            <header>
              <strong>{row.label}</strong>
              <small>Saldo {formatCurrency(row.net)}</small>
            </header>
            <div className="fd-monthly-bar-track income">
              <div style={{ width: `${incomePct}%` }} />
              <span>Receitas {formatCurrency(row.income)}</span>
            </div>
            <div className="fd-monthly-bar-track expense">
              <div style={{ width: `${expensePct}%` }} />
              <span>Despesas {formatCurrency(row.expense)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FinanceiroModule() {
  const { transactions, costs, adjustmentAccounts, paymentAccounts, pots, user } = useApp();
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(30);

  const monthTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const date = parseDateSafe(tx.date);
        return date ? isInCurrentMonth(date) : false;
      }),
    [transactions]
  );

  const monthTotals = useMemo(() => calculateTotals(monthTransactions), [monthTransactions]);
  const dailySeries = useMemo(() => buildDailyTotals(monthTransactions), [monthTransactions]);
  const bestDay = useMemo(() => [...dailySeries].sort((a, b) => b.value - a.value)[0], [dailySeries]);
  const worstDay = useMemo(() => [...dailySeries].sort((a, b) => a.value - b.value)[0], [dailySeries]);
  const recent = useMemo(() => sortTransactionsByDateDesc(monthTransactions).slice(0, 20), [monthTransactions]);
  const totalCosts = useMemo(() => costs.reduce((sum, cost) => sum + cost.amount, 0), [costs]);

  const incomeRows = useMemo(
    () => recent.filter((tx) => tx.type === TransactionType.INCOME).slice(0, 8),
    [recent]
  );
  const expenseRows = useMemo(
    () => recent.filter((tx) => tx.type === TransactionType.EXPENSE).slice(0, 8),
    [recent]
  );
  const chartRows = useMemo(() => dailySeries.slice(-7), [dailySeries]);

  const onboardingData = useMemo(() => (user?.id ? getUserOnboardingData(user.id) : {}), [user?.id]);
  const currentBalance = useMemo(() => {
    const potsTotal = pots.reduce((sum, pot) => sum + (Number.isFinite(pot.balance) ? pot.balance : 0), 0);
    if (Number.isFinite(potsTotal) && Math.abs(potsTotal) > 0) return potsTotal;
    return monthTotals.periodBalance;
  }, [monthTotals.periodBalance, pots]);

  const forecast = useMemo(
    () =>
      calculateCashflowForecast({
        transactions,
        currentBalance,
        periodDays: forecastDays,
        fixedExpenses: onboardingData.fixedExpenses ?? [],
        recurringExpenses: adjustmentAccounts.map((account) => ({
          amount: account.amount,
          dueDate: account.dueDate,
          status: account.status,
        })),
        pendingBills: paymentAccounts.map((account) => ({
          amount: account.amount,
          status: account.status,
          dueDate: (() => {
            const today = new Date();
            const due = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(28, account.dueDate)));
            if (due < today) due.setMonth(due.getMonth() + 1);
            return due.toISOString().slice(0, 10);
          })(),
        })),
      }),
    [transactions, currentBalance, forecastDays, onboardingData.fixedExpenses, adjustmentAccounts, paymentAccounts]
  );

  const riskLevel = useMemo(() => getCashRiskLevel(forecast), [forecast]);
  const monthlyComparison = useMemo(() => getMonthlyComparison(transactions, 6), [transactions]);

  const riskMessage = useMemo(() => {
    if (!forecast.dataSufficient) {
      return {
        level: "empty",
        title: "Cadastre algumas entradas e saidas para liberar sua projecao de caixa.",
        subtitle: "Estimativa baseada na sua media de entradas e despesas cadastradas.",
      };
    }
    if (forecast.riskDay !== null && forecast.riskDay <= 30) {
      return {
        level: "critical",
        title: `Atencao: sua projecao indica risco de saldo negativo em ${forecast.riskDay} dias.`,
        subtitle: "Revise despesas fixas e priorize entradas dos proximos dias.",
      };
    }
    if (forecast.riskDay !== null && forecast.riskDay <= 60) {
      return {
        level: "moderate",
        title: `Cuidado: existe risco de saldo negativo em ${forecast.riskDay} dias.`,
        subtitle: "Ajustar custos agora pode evitar pressao de caixa no proximo ciclo.",
      };
    }
    if (forecast.fixedCommitmentMonthly > forecast.estimatedDailyIncome * 30 * 0.7) {
      return {
        level: "moderate",
        title: "Revise suas despesas fixas: elas estao consumindo boa parte da sua media de entradas.",
        subtitle: "Seu caixa segue estavel, mas com pouca margem para imprevistos.",
      };
    }
    return {
      level: "positive",
      title: "Seu caixa se mantem saudavel pelos proximos 30 dias.",
      subtitle: "Continue monitorando entradas e mantendo o ritmo de controle.",
    };
  }, [forecast]);

  const monthlyInsights = useMemo(() => {
    if (monthlyComparison.rows.length < 2) return null;
    return [
      `Este mes sua receita esta ${formatPercentage(monthlyComparison.incomeVariationPct)} em relacao ao mes anterior.`,
      `Suas despesas variaram ${formatPercentage(monthlyComparison.expenseVariationPct)} no mesmo periodo.`,
      `Lucro liquido mensal: ${formatPercentage(monthlyComparison.netVariationPct)} vs mes anterior.`,
    ];
  }, [monthlyComparison]);

  return (
    <section className="fd-finance-section">
      <header className="fd-finance-titleblock">
        <h2 className="fd-finance-title">Fluxo de Caixa</h2>
        <p className="fd-finance-subtitle">Leitura consolidada de entradas e saidas com dados reativos</p>
      </header>

      <article className="fd-panel fd-glass fd-forecast-card">
        <div className="fd-forecast-head">
          <div>
            <h3>Projecao dos proximos dias</h3>
            <p>Estimativa baseada na sua media de entradas e despesas cadastradas.</p>
          </div>
          <div className="fd-forecast-periods">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                className={`fd-mini-btn ${forecastDays === days ? "active" : ""}`}
                onClick={() => setForecastDays(days as 30 | 60 | 90)}
              >
                {days} dias
              </button>
            ))}
          </div>
        </div>

        <div className={`fd-forecast-alert ${riskMessage.level}`}>
          {riskMessage.level === "critical" ? <AlertTriangle className="h-4 w-4" /> : null}
          {riskMessage.level === "moderate" ? <Gauge className="h-4 w-4" /> : null}
          {riskMessage.level === "positive" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {riskMessage.level === "empty" ? <CalendarRange className="h-4 w-4" /> : null}
          <div>
            <strong>{riskMessage.title}</strong>
            <p>{riskMessage.subtitle}</p>
          </div>
        </div>

        {forecast.dataSufficient ? (
          <>
            <div className="fd-forecast-kpis">
              <div className="fd-insight-item">
                <span>Saldo projetado ({forecast.periodDays} dias)</span>
                <strong>{formatCurrency(forecast.projectedBalance)}</strong>
              </div>
              <div className="fd-insight-item">
                <span>Melhor cenario estimado</span>
                <strong>{formatCurrency(forecast.bestCaseBalance)}</strong>
              </div>
              <div className="fd-insight-item">
                <span>Cenario conservador</span>
                <strong>{formatCurrency(forecast.conservativeBalance)}</strong>
              </div>
              <div className="fd-insight-item">
                <span>Data provavel de risco</span>
                <strong>{forecast.riskDate ? formatDate(forecast.riskDate) : "Sem risco no periodo"}</strong>
              </div>
            </div>
            <ForecastLineChart points={forecast.points} />
          </>
        ) : (
          <div className="fd-empty-state-card">
            <p>Cadastre algumas entradas e saidas para liberar sua projecao de caixa.</p>
          </div>
        )}
      </article>

      <div className="fd-grid-two">
        <article className="fd-panel fd-glass fd-finance-primary-card">
          <div className="fd-flow-columns">
            <section className="fd-flow-column">
              <div className="fd-flow-column-head">
                <h3>Entradas</h3>
                <strong className="positive">{formatCurrency(monthTotals.income)}</strong>
              </div>
              <div className="fd-list">
                {incomeRows.length === 0 ? (
                  <p className="fd-empty">Sem entradas no periodo</p>
                ) : (
                  incomeRows.map((row) => (
                    <div key={row.id} className="fd-list-row">
                      <div>
                        <p>{row.description}</p>
                        <small>
                          {formatDate(row.date)} - {row.category}
                        </small>
                      </div>
                      <strong className="fd-positive">+{formatCurrency(row.amount)}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="fd-flow-column">
              <div className="fd-flow-column-head">
                <h3>Saidas</h3>
                <strong className="negative">{formatCurrency(monthTotals.expense)}</strong>
              </div>
              <div className="fd-list">
                {expenseRows.length === 0 ? (
                  <p className="fd-empty">Sem saidas no periodo</p>
                ) : (
                  expenseRows.map((row) => (
                    <div key={row.id} className="fd-list-row">
                      <div>
                        <p>{row.description}</p>
                        <small>
                          {formatDate(row.date)} - {row.category}
                        </small>
                      </div>
                      <strong className="fd-negative">-{formatCurrency(row.amount)}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="fd-subsection">
            <h3>Evolucao do fluxo</h3>
            {chartRows.length === 0 ? <p className="fd-empty">Sem dados suficientes para o grafico</p> : <FlowBarsChart data={chartRows} />}
          </div>
        </article>

        <article className="fd-panel fd-glass">
          <div className="fd-panel-head">
            <h2>Painel analitico</h2>
            <p>Resumo financeiro consolidado</p>
          </div>

          <div className="fd-insights-grid">
            <div className="fd-insight-item">
              <span>Entradas</span>
              <strong>{formatCurrency(monthTotals.income)}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Saidas</span>
              <strong>{formatCurrency(monthTotals.expense)}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Saldo do periodo</span>
              <strong>{formatCurrency(monthTotals.periodBalance)}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Dia com maior faturamento</span>
              <strong>{bestDay ? `${bestDay.date} - ${formatCurrency(bestDay.value)}` : "-"}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Dia mais fraco</span>
              <strong>{worstDay ? `${worstDay.date} - ${formatCurrency(worstDay.value)}` : "-"}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Total de custos</span>
              <strong>{formatCurrency(totalCosts)}</strong>
            </div>
          </div>

          <div className="fd-subsection">
            <h3>Distribuicao financeira</h3>
            <AnalyticsDonut income={monthTotals.income} expense={monthTotals.expense} costs={totalCosts} />
          </div>
        </article>
      </div>

      <article className="fd-panel fd-glass fd-monthly-comparison-card">
        <div className="fd-panel-head">
          <h2>Comparativo mensal</h2>
          <p>Receitas, despesas e saldo liquido dos ultimos meses</p>
        </div>
        {monthlyComparison.rows.length === 0 ? (
          <div className="fd-empty-state-card">
            <p>Quando voce tiver mais historico, o FluxoCerto vai comparar seus meses automaticamente.</p>
          </div>
        ) : (
          <>
            <MonthlyComparisonChart rows={monthlyComparison.rows} />
            {monthlyInsights ? (
              <div className="fd-monthly-insights">
                {monthlyInsights.map((insight) => (
                  <p key={insight}>
                    <TrendingUp className="h-4 w-4" />
                    <span>{insight}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </>
        )}
      </article>

      {riskLevel === "empty" ? (
        <article className="fd-panel fd-glass fd-empty-state-card">
          <p>Cadastre algumas entradas e saidas para liberar sua projecao de caixa.</p>
        </article>
      ) : null}
    </section>
  );
}
