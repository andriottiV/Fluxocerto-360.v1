import { useMemo } from "react";
import { useLocation } from "wouter";

import { runFinancialAdvisorEngine } from "@/lib/financialAdvisor";
import type { Pot, Transaction } from "@/lib/types";

type FinancialAdvisorSummaryProps = {
  transactions: Transaction[];
  pots: Pot[];
};

export default function FinancialAdvisorSummary({
  transactions,
  pots,
}: FinancialAdvisorSummaryProps) {
  const [, setLocation] = useLocation();

  const advisor = useMemo(
    () => runFinancialAdvisorEngine({ transactions, pots }),
    [transactions, pots]
  );

  const topInsights = advisor.insights.slice(0, 3);

  return (
    <article className="fd-panel fd-glass">
      <div className="fd-panel-head">
        <h2>Consultor Fluxo</h2>
        <p>{advisor.diagnostico}</p>
      </div>

      <div className="fd-consultor-summary-quick">
        <div className="fd-consultor-block">
          <span>Diagnostico curto</span>
          <strong>{advisor.diagnostico}</strong>
        </div>
        <div className="fd-consultor-block">
          <span>Risco principal</span>
          <strong>{advisor.riscoPrincipal}</strong>
        </div>
        <div className="fd-consultor-block">
          <span>Acao imediata</span>
          <strong>{advisor.acaoImediata}</strong>
        </div>
      </div>

      <div className="fd-consultor-summary-insights">
        {topInsights.map((insight) => (
          <section key={insight.id} className="fd-advisor-card">
            <h3>{insight.title}</h3>
            <p>{insight.description}</p>
            <strong>{insight.action}</strong>
          </section>
        ))}
      </div>

      <div className="fd-consultor-summary-action">
        <button
          type="button"
          className="fd-primary-btn"
          onClick={() => setLocation("/consultor")}
        >
          Ver analise completa
        </button>
      </div>
    </article>
  );
}

