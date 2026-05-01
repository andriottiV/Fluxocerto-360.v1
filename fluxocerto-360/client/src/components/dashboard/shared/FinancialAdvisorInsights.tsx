import { useMemo } from "react";

import { runFinancialAdvisorEngine } from "@/lib/financialAdvisor";
import { formatCurrency } from "@/lib/utils";
import type { Pot, Transaction } from "@/lib/types";
import { TransactionType } from "@/lib/types";

type AdvisorCard = {
  id: string;
  title: string;
  explanation: string;
  action: string;
  tone: "positive" | "attention" | "critical";
};

type FinancialAdvisorInsightsProps = {
  transactions: Transaction[];
  pots: Pot[];
};

function toneClass(tone: AdvisorCard["tone"]) {
  if (tone === "critical") return "critical";
  if (tone === "attention") return "attention";
  return "positive";
}

function buildLargestLeak(transactions: Transaction[]) {
  const byCategory = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.type === TransactionType.EXPENSE)
    .forEach((transaction) => {
      const category = transaction.category?.trim() || "outros";
      byCategory.set(category, (byCategory.get(category) ?? 0) + transaction.amount);
    });

  const [category = "outros", amount = 0] = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
  return { category, amount };
}

export default function FinancialAdvisorInsights({
  transactions,
  pots,
}: FinancialAdvisorInsightsProps) {
  const advisorResult = useMemo(
    () => runFinancialAdvisorEngine({ transactions, pots }),
    [transactions, pots]
  );

  const cards = useMemo<AdvisorCard[]>(() => {
    const { snapshot } = advisorResult;
    const strongestDay = snapshot.financialSummary.strongestDays[0] ?? "sem dados";
    const weakestDay = snapshot.financialSummary.weakestDays[0] ?? "sem dados";
    const leak = buildLargestLeak(transactions);
    const reserveCoverage =
      snapshot.financialSummary.totalExpense > 0
        ? snapshot.reserveSummary.currentBalance / snapshot.financialSummary.totalExpense
        : 0;
    const businessShare =
      snapshot.financialSummary.totalIncome > 0
        ? snapshot.businessSummary.income / snapshot.financialSummary.totalIncome
        : 0;
    const personalShare =
      snapshot.financialSummary.totalIncome > 0
        ? snapshot.personalSummary.income / snapshot.financialSummary.totalIncome
        : 0;

    return [
      {
        id: "leak",
        title: "Maior vazamento financeiro",
        explanation: `Categoria com maior saida: ${leak.category} (${formatCurrency(leak.amount)}).`,
        action: advisorResult.acaoImediata,
        tone: leak.amount > 0 ? "attention" : "positive",
      },
      {
        id: "strongest-day",
        title: "Dia mais forte de faturamento",
        explanation: `Melhor dia da semana: ${strongestDay}. Frequencia media de entradas: ${snapshot.financialSummary.incomeFrequency}/dia ativo.`,
        action: "Priorize campanhas e ofertas nos dias com maior tracao.",
        tone: "positive",
      },
      {
        id: "weakest-day",
        title: "Dia mais fraco",
        explanation: `Ponto de atencao em ${weakestDay}, com menor saldo de desempenho.`,
        action: "Agende cobrancas e recuperacao de vendas antes desse dia.",
        tone: "attention",
      },
      {
        id: "cash-squeeze",
        title: "Alerta de aperto",
        explanation: advisorResult.riscoPrincipal,
        action: advisorResult.acaoImediata,
        tone: snapshot.riskProfile.level === "high" ? "critical" : "attention",
      },
      {
        id: "reserve-guidance",
        title: "Recomendacao de reserva",
        explanation: `Cobertura atual da reserva: ${(reserveCoverage * 100).toFixed(0)}% das saidas do periodo.`,
        action: advisorResult.metaDaSemana,
        tone: reserveCoverage >= 0.8 ? "positive" : "attention",
      },
      {
        id: "investment-guidance",
        title: "Investir agora ou não",
        explanation: snapshot.investmentReadiness.reason,
        action: advisorResult.proximoPassoRecomendado,
        tone: snapshot.investmentReadiness.level === "ready" ? "positive" : "attention",
      },
      {
        id: "personal-business-balance",
        title: "Equilibrio pessoal x negocio",
        explanation: `Receitas: negocio ${(businessShare * 100).toFixed(0)}% vs pessoal ${(personalShare * 100).toFixed(0)}%.`,
        action:
          snapshot.businessSummary.net < 0
            ? "Revisar margem do negocio para proteger o caixa pessoal."
            : "Manter transferencia planejada do negocio para fortalecer PF e reserva.",
        tone: snapshot.businessSummary.net < 0 ? "critical" : "positive",
      },
    ];
  }, [advisorResult, transactions]);

  return (
    <article className="fd-panel fd-glass">
      <div className="fd-panel-head">
        <h2>Insights Inteligentes</h2>
        <p>{advisorResult.diagnostico}</p>
      </div>

      <div className="fd-advisor-grid">
        {cards.map((card) => (
          <section key={card.id} className="fd-advisor-card">
            <span className={`fd-advisor-chip ${toneClass(card.tone)}`} />
            <h3>{card.title}</h3>
            <p>{card.explanation}</p>
            <strong>{card.action}</strong>
          </section>
        ))}
      </div>
    </article>
  );
}
