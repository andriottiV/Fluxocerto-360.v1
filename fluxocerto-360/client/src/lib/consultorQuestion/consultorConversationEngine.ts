import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import type { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

import { answerConsultorQuestion, type ConsultorQuestionAnswer } from "./consultorQuestionEngine";

export type ConsultorRichCard = {
  title: string;
  description: string;
};

export type ConsultorConversationReply = {
  answer: ConsultorQuestionAnswer;
  message: string;
  riskTone: "positive" | "attention" | "critical";
  quickActions: string[];
  richCards: ConsultorRichCard[];
};

type BuildConversationInput = {
  question: string;
  advisor: FinancialAdvisorResult;
  transactions: Transaction[];
};

type ContextMetrics = {
  currentBalance: number;
  netProfit: number;
  reserveBalance: number;
  totalExpense: number;
  projectedBalance: number;
  dailyExpense: number;
  protectedBase: number;
  available: number;
  safeSpend: number;
  prudentInvest: number;
  investFloor: number;
  investCeil: number;
  withdrawLimit: number;
  saveTarget: number;
  travelLimit: number;
};

function toMoney(value: number) {
  return formatCurrency(Math.max(0, value));
}

function roundStep(value: number, step = 10) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value / step) * step);
}

function computeMetrics(advisor: FinancialAdvisorResult): ContextMetrics {
  const summary = advisor.snapshot.financialSummary;
  const reserveBalance = advisor.snapshot.reserveSummary.currentBalance;
  const dailyExpense = summary.totalExpense > 0 ? summary.totalExpense / 30 : 0;
  const protectedBase = Math.max(dailyExpense * 7, summary.totalExpense * 0.25, 200);
  const available = Math.max(0, summary.currentBalance - protectedBase);

  const prudentInvest = roundStep(available * 0.35);
  const investFloor = roundStep(prudentInvest * 0.7);
  const investCeil = roundStep(prudentInvest * 1.2);
  const safeSpend = roundStep(available * 0.45);
  const withdrawLimit = roundStep(available * 0.3);
  const saveTarget = roundStep(Math.max(available * 0.25, summary.netProfit > 0 ? summary.netProfit * 0.2 : 0));
  const travelLimit = roundStep(available * 0.4);

  return {
    currentBalance: summary.currentBalance,
    netProfit: summary.netProfit,
    reserveBalance,
    totalExpense: summary.totalExpense,
    projectedBalance: summary.projectedBalance,
    dailyExpense,
    protectedBase,
    available,
    safeSpend,
    prudentInvest,
    investFloor,
    investCeil,
    withdrawLimit,
    saveTarget,
    travelLimit,
  };
}

function inferRiskTone(advisor: FinancialAdvisorResult): "positive" | "attention" | "critical" {
  const level = advisor.snapshot.riskProfile.level;
  if (level === "high") return "critical";
  if (level === "medium") return "attention";
  return "positive";
}

function actionByIntent(intent: ConsultorQuestionAnswer["intent"]) {
  switch (intent) {
    case "investir":
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opções"];
    case "gastos":
      return ["Ver valor sugerido", "Entender o risco", "Montar plano", "Mais opções"];
    case "retirada_pessoal":
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opções"];
    case "reserva":
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opções"];
    default:
      return ["Montar plano", "Entender o risco", "Ver valor sugerido", "Mais opções"];
  }
}

function containsAny(base: string, terms: string[]) {
  return terms.some((term) => base.includes(term));
}

function buildDecisionMessage(params: {
  answer: ConsultorQuestionAnswer;
  advisor: FinancialAdvisorResult;
  metrics: ContextMetrics;
}): { message: string; card?: ConsultorRichCard } {
  const { answer, advisor, metrics } = params;
  const question = answer.normalizedQuestion;

  const asksTravel = containsAny(question, ["viagem", "viajar"]);
  const asksWithdraw = answer.intent === "retirada_pessoal" || containsAny(question, ["tirar", "retirada", "pro labore"]);
  const asksInvest = answer.intent === "investir" || containsAny(question, ["invest", "aportar"]);
  const asksSpend = answer.intent === "gastos" || containsAny(question, ["gastar", "gasto", "compra"]);
  const asksSave = answer.intent === "guardar" || answer.intent === "reserva" || containsAny(question, ["guardar", "poupar", "reserva"]);

  const safeTone = advisor.snapshot.riskProfile.level === "high" ? "Hoje o cenário pede cautela." : "Hoje você tem espaço para decidir com segurança, desde que mantenha equilíbrio.";

  if (asksTravel) {
    const canTravel = metrics.travelLimit > 0;
    const direct = canTravel
      ? `Hoje você consegue viajar sem se prejudicar, mas o ideal é não passar de ${toMoney(metrics.travelLimit)}.`
      : "Hoje ainda não é o melhor momento para viagem sem apertar seu caixa.";

    return {
      message: `${direct}\n\n${safeTone}\n\nSe eu fosse te orientar agora, eu diria para preservar pelo menos ${toMoney(metrics.protectedBase)} como proteção do caixa diário.\n\nSe quiser, eu posso te sugerir um plano rápido para fazer essa viagem com mais tranquilidade.`,
      card: {
        title: "Valor prudente para viagem hoje",
        description: `${toMoney(metrics.travelLimit)}`,
      },
    };
  }

  if (asksWithdraw) {
    const direct = metrics.withdrawLimit > 0
      ? `Hoje o valor mais seguro para retirada seria em torno de ${toMoney(metrics.withdrawLimit)}.`
      : "Hoje não há folga segura para retirada sem pressionar os próximos dias.";

    return {
      message: `${direct}\n\nAcima disso, você começa a perder folga e pode sentir no fluxo dos próximos dias.\n\nSe eu estivesse te orientando agora, eu manteria uma retirada controlada e deixaria o restante como proteção operacional.\n\nSe quiser, eu te ajudo a definir um teto de retirada por semana.`,
      card: {
        title: "Retirada segura agora",
        description: `${toMoney(metrics.withdrawLimit)}`,
      },
    };
  }

  if (asksInvest) {
    const direct = metrics.prudentInvest > 0
      ? `Hoje você pode investir, mas com equilíbrio. O mais prudente é ficar entre ${toMoney(metrics.investFloor)} e ${toMoney(metrics.investCeil)}.`
      : "Hoje ainda não é o melhor momento para investir sem comprometer sua proteção de caixa.";

    return {
      message: `${direct}\n\nO ideal é proteger primeiro o dinheiro do dia a dia e investir apenas o excedente real.\n\nSe eu fosse te orientar agora, eu manteria pelo menos ${toMoney(metrics.protectedBase)} preservados para evitar aperto.\n\nSe quiser, eu monto um plano de investimento gradual para você começar sem risco desnecessário.`,
      card: {
        title: "Faixa prudente de investimento",
        description: `${toMoney(metrics.investFloor)} a ${toMoney(metrics.investCeil)}`,
      },
    };
  }

  if (asksSpend) {
    const direct = metrics.safeSpend > 0
      ? `Hoje você pode gastar até ${toMoney(metrics.safeSpend)} sem comprometer seu caixa de forma importante.`
      : "Hoje o cenário está mais apertado, então o ideal é segurar gastos não essenciais.";

    return {
      message: `${direct}\n\nSe eu estivesse te orientando agora, eu focaria no essencial e manteria uma reserva mínima para os próximos dias.\n\nSeu ponto de atenção é não deixar o gasto de hoje virar pressão no fluxo da semana.\n\nSe quiser, posso te mostrar como dividir esse valor com mais segurança.`,
      card: {
        title: "Limite de gasto seguro hoje",
        description: `${toMoney(metrics.safeSpend)}`,
      },
    };
  }

  if (asksSave) {
    const direct = metrics.saveTarget > 0
      ? `Hoje você consegue guardar em torno de ${toMoney(metrics.saveTarget)} com segurança.`
      : "Neste momento, vale começar com uma meta menor para não pressionar seu caixa.";

    return {
      message: `${direct}\n\nO caminho mais forte é constância: guardar um valor possível toda semana.\n\nSe eu fosse te orientar agora, eu começaria com esse valor e revisaria em 7 dias, conforme seu fluxo real.\n\nSe quiser, eu te ajudo a transformar isso em uma meta simples de curto prazo.`,
      card: {
        title: "Valor de reserva recomendado",
        description: `${toMoney(metrics.saveTarget)}`,
      },
    };
  }

  return {
    message: `Pelo seu momento atual, você está em ${advisor.snapshot.riskProfile.level === "low" ? "uma faixa mais segura" : "um ponto que exige mais atenção"}.\n\nSe eu fosse te orientar agora, eu focaria em proteger caixa e tomar decisões com limite claro.\n\nHoje, o valor que você consegue movimentar com menos risco está perto de ${toMoney(metrics.safeSpend)}.\n\nSe quiser, me diga a decisão que você quer tomar e eu te passo um valor exato para isso.`,
    card: {
      title: "Folga financeira de referência hoje",
      description: `${toMoney(metrics.safeSpend)}`,
    },
  };
}

export function answerConsultorConversation(input: BuildConversationInput): ConsultorConversationReply {
  const answer = answerConsultorQuestion(input);
  const metrics = computeMetrics(input.advisor);
  const decision = buildDecisionMessage({
    answer,
    advisor: input.advisor,
    metrics,
  });

  return {
    answer,
    message: decision.message,
    riskTone: inferRiskTone(input.advisor),
    quickActions: actionByIntent(answer.intent),
    richCards: decision.card ? [decision.card] : [],
  };
}
