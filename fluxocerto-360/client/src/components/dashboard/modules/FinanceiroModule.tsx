import { useMemo } from "react";

import { useApp } from "@/contexts/AppContext";
import {
  buildDailyTotals,
  calculateTotals,
  isInCurrentMonth,
  parseDateSafe,
  sortTransactionsByDateDesc,
} from "@/lib/finance";
import { TransactionType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

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
              <small>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</small>
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

export default function FinanceiroModule() {
  const { transactions, costs } = useApp();

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

  return (
    <section className="fd-finance-section">
      <header className="fd-finance-titleblock">
        <h2 className="fd-finance-title">Fluxo de Caixa</h2>
        <p className="fd-finance-subtitle">Leitura consolidada de entradas e saidas com dados reativos</p>
      </header>

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
                          {formatDate(row.date)} • {row.category}
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
                          {formatDate(row.date)} • {row.category}
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
            {chartRows.length === 0 ? (
              <p className="fd-empty">Sem dados suficientes para o grafico</p>
            ) : (
              <FlowBarsChart data={chartRows} />
            )}
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
              <strong>{formatCurrency(monthTotals.net)}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Dia com maior faturamento</span>
              <strong>{bestDay ? `${bestDay.date} • ${formatCurrency(bestDay.value)}` : "-"}</strong>
            </div>
            <div className="fd-insight-item">
              <span>Dia mais fraco</span>
              <strong>{worstDay ? `${worstDay.date} • ${formatCurrency(worstDay.value)}` : "-"}</strong>
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
    </section>
  );
}
