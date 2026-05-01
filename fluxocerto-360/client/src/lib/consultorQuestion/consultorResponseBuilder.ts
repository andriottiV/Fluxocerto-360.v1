import { type FinancialAdvisorResult } from "@/lib/financialAdvisor";
import { calculateTotals, parseDateSafe } from "@/lib/finance";
import { TransactionType, type Transaction } from "@/lib/types";

import type { ConsultorQuestionIntent } from "./consultorIntentParser";

export type ConsultorStructuredAnswer = {
  leituraAtual: string;
  principalRisco: string;
  oQueFazerAgora: string;
  proximoPasso: string;
  dadosChave: string[];
};

type BuildAnswerInput = {
  intent: ConsultorQuestionIntent;
  advisor: FinancialAdvisorResult;
  transactions: Transaction[];
};

function topExpenseCategory(transactions: Transaction[]) {
  const map = new Map<string, number>();
  transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .forEach((tx) => {
      const category = tx.category?.trim() || "outros";
      map.set(category, (map.get(category) ?? 0) + tx.amount);
    });

  const [category = "outros"] = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
  return category;
}

function reserveCoverageMonths(advisor: FinancialAdvisorResult) {
  const totalExpense = advisor.snapshot.financialSummary.totalExpense;
  if (totalExpense <= 0) return 0;
  return advisor.snapshot.reserveSummary.currentBalance / totalExpense;
}

function currentMonthNet(transactions: Transaction[]) {
  const now = new Date();
  const sameMonth = transactions.filter((tx) => {
    const parsed = parseDateSafe(tx.date);
    return parsed && parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
  });

  return calculateTotals(sameMonth).periodBalance;
}

function buildContext(input: BuildAnswerInput) {
  const { advisor, transactions } = input;
  const summary = advisor.snapshot.financialSummary;
  const reserveCoverage = reserveCoverageMonths(advisor);
  const topCategory = topExpenseCategory(transactions);
  const monthNet = currentMonthNet(transactions);
  const personalShare =
    summary.totalIncome > 0 ? advisor.snapshot.personalSummary.income / summary.totalIncome : 0;

  return {
    summary,
    reserveCoverage,
    topCategory,
    monthNet,
    personalShare,
  };
}

function baseAnswer(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const { advisor } = input;
  const { summary, reserveCoverage, topCategory } = buildContext(input);
  const strongest = summary.strongestDays.length > 0 ? summary.strongestDays.join(", ") : "sem padrao claro";
  const weakest = summary.weakestDays.length > 0 ? summary.weakestDays.join(", ") : "sem alerta forte";

  return {
    leituraAtual:
      summary.netProfit >= 0
        ? "Seu momento esta controlado e com boa chance de manter estabilidade."
        : "Seu momento pede mais atencao, mas da para recuperar com ajustes simples.",
    principalRisco: advisor.riscoPrincipal,
    oQueFazerAgora: advisor.acaoImediata,
    proximoPasso: advisor.proximoPassoRecomendado,
    dadosChave: [
      `Maior pressao de gasto hoje: ${topCategory}.`,
      `Dias mais fortes: ${strongest}.`,
      `Dias mais fracos: ${weakest}.`,
      reserveCoverage < 0.5
        ? "Sua reserva ainda esta curta para imprevistos."
        : "Sua reserva ja ajuda a proteger seu caixa.",
    ],
  };
}

function answerForInvest(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const { advisor } = input;
  const { reserveCoverage } = buildContext(input);
  const readiness = advisor.snapshot.investmentReadiness;

  if (readiness.level === "ready") {
    return {
      ...base,
      leituraAtual: "Você pode investir, desde que mantenha uma parte protegida para o dia a dia.",
      principalRisco: "O risco e investir demais e perder folga para o caixa rodar com tranquilidade.",
      oQueFazerAgora: "Comece com aporte pequeno e recorrente, sem comprometer sua operacao.",
      proximoPasso: "Revise semanalmente e aumente os aportes so se o fluxo seguir estavel.",
    };
  }

  return {
    ...base,
    leituraAtual:
      reserveCoverage < 0.5
        ? "Hoje ainda não é o melhor momento para investir com segurança."
        : "Você pode investir com cautela, sem forçar o caixa.",
    principalRisco: "Sem uma reserva mais consistente, qualquer imprevisto pode apertar o seu mês.",
    oQueFazerAgora: "Priorize fortalecer reserva e manter previsibilidade nas saidas.",
    proximoPasso: "Assim que o caixa estiver mais folgado, inicie aportes graduais.",
  };
}

function answerForSpending(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const { topCategory } = buildContext(input);

  return {
    ...base,
    leituraAtual: `Seu maior vazamento hoje esta em ${topCategory}.`,
    principalRisco: "Gastos sem teto nessa frente podem corroer sua margem sem você perceber.",
    oQueFazerAgora: `Defina limite claro para ${topCategory} e acompanhe dia a dia.`,
    proximoPasso: "Reveja essa categoria toda semana ate estabilizar.",
  };
}

function answerForCashFlow(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const { summary, monthNet } = buildContext(input);

  return {
    ...base,
    leituraAtual:
      monthNet >= 0
        ? "Seu fluxo atual esta respirando melhor, mas ainda exige disciplina diaria."
        : "Seu fluxo esta pressionado neste ciclo e pede acao rapida.",
    principalRisco:
      summary.projectedBalance < summary.currentBalance
        ? "A tendencia para as proximas semanas e de perder folga de caixa."
        : "Se relaxar no controle, a estabilidade pode cair rapido.",
    oQueFazerAgora: "Antecipe recebimentos e segure gastos variaveis nos dias mais fracos.",
    proximoPasso: "Mantenha previsao semanal simples e ajuste limites sempre que necessario.",
  };
}

function answerForPersonalWithdrawal(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const { personalShare } = buildContext(input);

  return {
    ...base,
    leituraAtual:
      personalShare > 0.65
        ? "Sua retirada pessoal esta alta para o momento do negocio."
        : "Sua retirada pessoal esta em faixa mais equilibrada.",
    principalRisco:
      personalShare > 0.65
        ? "Retirar sem regra pode enfraquecer seu caixa operacional."
        : "Mesmo com equilibrio, saques sem teto podem desorganizar o fluxo.",
    oQueFazerAgora: "Trabalhe com pro-labore fixo para evitar decisoes por impulso.",
    proximoPasso: "Revise o valor da retirada por ciclo, com base no resultado real.",
  };
}

function answerForReserve(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const { reserveCoverage } = buildContext(input);

  return {
    ...base,
    leituraAtual:
      reserveCoverage >= 1
        ? "Sua reserva ja da uma boa base de seguranca."
        : "Sua reserva ainda precisa de reforco para trazer tranquilidade.",
    principalRisco: "Sem reserva consistente, qualquer oscilacao vira aperto no caixa.",
    oQueFazerAgora: "Automatize aportes pequenos e constantes para ganhar ritmo.",
    proximoPasso: "Mantenha a reserva como prioridade antes de novos compromissos maiores.",
  };
}

function answerForBusinessHealth(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);
  const business = input.advisor.snapshot.businessSummary;

  return {
    ...base,
    leituraAtual:
      business.net >= 0
        ? "Seu negócio mostra sinais de saúde, com espaço para evoluir com segurança."
        : "Seu negocio esta sob pressao e precisa de ajuste para ganhar folego.",
    principalRisco:
      business.net < 0
        ? "Se mantiver esse ritmo, o caixa tende a apertar nos proximos ciclos."
        : "Sem rotina de controle, a margem pode cair sem aviso.",
    oQueFazerAgora: "Priorize receita recorrente e corte custos que não trazem retorno.",
    proximoPasso: "Acompanhe semanalmente margem e caixa para corrigir desvios cedo.",
  };
}

function answerForSaving(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);

  return {
    ...base,
    leituraAtual: "Você consegue guardar, mas o segredo é constância e não valor alto de uma vez.",
    principalRisco: "Poupar sem regra clara costuma perder prioridade no meio do mês.",
    oQueFazerAgora: "Defina um valor fixo e transfira primeiro para a reserva.",
    proximoPasso: "Aumente esse valor aos poucos sempre que seu fluxo estiver mais estavel.",
  };
}

function answerForCashSqueeze(input: BuildAnswerInput): ConsultorStructuredAnswer {
  const base = baseAnswer(input);

  return {
    ...base,
    leituraAtual: "Agora o foco e simples: recuperar folga de caixa rapido.",
    principalRisco: "Se nada mudar agora, o aperto tende a continuar no proximo ciclo.",
    oQueFazerAgora: "Corte gastos variaveis de impacto baixo e acelere entradas pendentes.",
    proximoPasso: "Trabalhe um plano curto de 14 dias com metas diarias de caixa.",
  };
}

export function buildConsultorStructuredAnswer(input: BuildAnswerInput): ConsultorStructuredAnswer {
  switch (input.intent) {
    case "investir":
      return answerForInvest(input);
    case "gastos":
      return answerForSpending(input);
    case "fluxo_caixa":
      return answerForCashFlow(input);
    case "retirada_pessoal":
      return answerForPersonalWithdrawal(input);
    case "reserva":
      return answerForReserve(input);
    case "saude_negocio":
      return answerForBusinessHealth(input);
    case "guardar":
      return answerForSaving(input);
    case "aperto":
      return answerForCashSqueeze(input);
    case "geral":
    default:
      return baseAnswer(input);
  }
}
