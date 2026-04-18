import { useMemo } from "react";

import { useApp } from "@/contexts/AppContext";
import SummaryCard from "@/components/dashboard/shared/SummaryCard";
import { calculateTotals, isInCurrentMonth, parseDateSafe } from "@/lib/finance";
import type { DashboardIntelligence } from "@/lib/dashboardIntelligence";
import { formatCurrency } from "@/lib/utils";

type InicioModuleProps = {
  userName?: string;
  intelligence: DashboardIntelligence;
};

function greetingForHour(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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

export default function InicioModule({ userName, intelligence }: InicioModuleProps) {
  const { pots, transactions } = useApp();

  const monthTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const date = parseDateSafe(tx.date);
        return date ? isInCurrentMonth(date) : false;
      }),
    [transactions]
  );

  const monthTotals = useMemo(() => calculateTotals(monthTransactions), [monthTransactions]);

  const [personalPot, businessPot, reservePot] = useMemo(() => {
    const pf = pots.find((pot) => pot.name.toLowerCase().includes("pess"));
    const pj = pots.find((pot) => pot.name.toLowerCase().includes("neg"));
    const reserve = pots.find((pot) => pot.name.toLowerCase().includes("reserv"));
    return [pf, pj, reserve];
  }, [pots]);

  const consultorHint = useMemo(() => {
    if (intelligence.greetingTone === "warning") {
      return "Seu caixa merece atenção hoje. Foque no essencial e reduza gastos recorrentes.";
    }
    return "Seu caixa está estável hoje, mas vale manter atenção aos pequenos gastos recorrentes.";
  }, [intelligence.greetingTone]);

  const evolutionSeries = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }).map((_, offset) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - offset));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const rows = days.map((date) => {
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

      const dayTx = transactions.filter((tx) => {
        const parsed = parseDateSafe(tx.date);
        if (!parsed) return false;
        const time = parsed.getTime();
        return time >= dayStart && time <= dayEnd;
      });

      const totals = calculateTotals(dayTx);
      return {
        label: DAY_LABELS[date.getDay()],
        income: totals.income,
        expense: totals.expense,
        net: totals.net,
      };
    });

    const cumulative: number[] = [];
    rows.reduce((sum, row, index) => {
      const next = sum + row.net;
      cumulative[index] = next;
      return next;
    }, 0);

    const values = [
      ...rows.map((row) => row.income),
      ...rows.map((row) => row.expense),
      ...cumulative,
    ];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);

    const width = 640;
    const height = 220;
    const paddingX = 24;
    const paddingY = 20;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    const yFor = (value: number) => {
      const range = Math.max(max - min, 1);
      return paddingY + ((max - value) / range) * usableH;
    };

    const xFor = (index: number) =>
      rows.length <= 1 ? width / 2 : paddingX + (usableW / (rows.length - 1)) * index;

    const incomePoints = rows.map((row, index) => ({ x: xFor(index), y: yFor(row.income) }));
    const expensePoints = rows.map((row, index) => ({ x: xFor(index), y: yFor(row.expense) }));
    const balancePoints = cumulative.map((value, index) => ({ x: xFor(index), y: yFor(value) }));

    return {
      rows,
      width,
      height,
      baseY: yFor(0),
      incomePath: pointsPath(incomePoints),
      expensePath: pointsPath(expensePoints),
      balancePath: pointsPath(balancePoints),
      balanceAreaPath: areaPath(balancePoints, yFor(min)),
    };
  }, [transactions]);

  const potDistribution = useMemo(() => {
    const entries = [
      { key: "pessoal", label: "Pessoal", value: personalPot?.balance ?? 0, color: "#38bdf8" },
      { key: "negocio", label: "Negócio", value: businessPot?.balance ?? 0, color: "#22c55e" },
      { key: "reserva", label: "Reserva", value: reservePot?.balance ?? 0, color: "#fbbf24" },
    ];
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);

    let cursor = 0;
    const stops = entries.map((entry) => {
      const ratio = total > 0 ? entry.value / total : 1 / entries.length;
      const start = cursor * 100;
      cursor += ratio;
      const end = cursor * 100;
      return `${entry.color} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
    });

    return {
      total,
      entries,
      gradient: `conic-gradient(${stops.join(", ")})`,
    };
  }, [personalPot?.balance, businessPot?.balance, reservePot?.balance]);

  return (
    <>
      <section className="fd-topline">
        <h2 className="fd-topline-title">
          {greetingForHour()}, {userName ?? "empreendedor"}.
        </h2>
        <p className={intelligence.greetingTone === "warning" ? "fd-topline-message warning" : "fd-topline-message positive"}>
          {intelligence.greetingMessage}
        </p>
        <strong className={intelligence.greetingTone === "warning" ? "fd-topline-value warning" : "fd-topline-value positive"}>
          {formatCurrency(intelligence.pfBalance || personalPot?.balance || 0)}
        </strong>
      </section>

      <section className="fd-consultor-brief">
        <p>{consultorHint}</p>
      </section>

      <section className="fd-summary-v2-grid fd-summary-v2-grid-compact">
        <SummaryCard label="Entradas" value={formatCurrency(monthTotals.income)} tone="success" />
        <SummaryCard label="Saidas" value={formatCurrency(monthTotals.expense)} tone="danger" />
        <SummaryCard label="Lucro liquido" value={formatCurrency(monthTotals.net)} helper="Entradas - Saidas" />
      </section>

      <section className="fd-grid-two fd-home-visual-grid">
        <article className="fd-panel fd-glass fd-home-chart-card">
          <div className="fd-panel-head">
            <h2>Evolucao financeira (7 dias)</h2>
            <p>Entradas, saídas e saldo acumulado recente</p>
          </div>
          <div className="fd-wallet-chart fd-home-wallet-chart">
            <svg viewBox={`0 0 ${evolutionSeries.width} ${evolutionSeries.height}`} role="img" aria-label="Evolução financeira">
              <defs>
                <linearGradient id="fd-balance-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.25)" />
                  <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
                </linearGradient>
              </defs>
              <line x1="24" x2={evolutionSeries.width - 24} y1={evolutionSeries.baseY} y2={evolutionSeries.baseY} stroke="rgba(148,163,184,0.25)" strokeDasharray="4 4" />
              <path d={evolutionSeries.balanceAreaPath} fill="url(#fd-balance-area)" />
              <path d={evolutionSeries.incomePath} fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" />
              <path d={evolutionSeries.expensePath} fill="none" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
              <path d={evolutionSeries.balancePath} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="5 4" />
            </svg>
            <div className="fd-wallet-axis">
              {evolutionSeries.rows.map((row) => (
                <span key={`axis-${row.label}`}>{row.label}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="fd-panel fd-glass fd-pot-distribution-card fd-home-chart-card">
          <div className="fd-panel-head">
            <h2>Distribuicao de potes</h2>
            <p>PF, PJ e Reserva</p>
          </div>
          <div className="fd-donut-wrap">
            <div className="fd-donut" style={{ background: potDistribution.gradient }} />
            <div className="fd-donut-legend">
              {potDistribution.entries.map((entry) => (
                <div key={entry.key}>
                  <span className="dot" style={{ background: entry.color }} />
                  <p>{entry.label}</p>
                  <strong>{formatCurrency(entry.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
