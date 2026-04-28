import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import type { AdjustmentAccount, Client, Pot, Service, Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

import { answerConsultorQuestion, type ConsultorQuestionAnswer } from "./consultorQuestionEngine";
import {
  chooseFluxTone,
  detectUserMood,
  generateHumanizedResponse,
  humanizeFinancialMessage,
  type FluxTone,
} from "./humanizedResponse";
import { buildScenarioResponse } from "./consultorScenarioSimulator";
import { buildGrowthResponse } from "./consultorGrowthAdvisor";
import { buildGoalMentorResponse } from "./consultorGoalMentor";
import { validateFinancialDataAvailability } from "@/lib/consultorSafety";

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
  pots?: Pot[];
  adjustmentAccounts?: AdjustmentAccount[];
  clients?: Client[];
  services?: Service[];
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

type HumanizedDecision = {
  scenarioReading: string;
  practicalGuidance: string;
  clearLimit: string;
  conversationClosing: string;
  card?: ConsultorRichCard;
  contextKey: string;
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
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opcoes"];
    case "gastos":
      return ["Ver valor sugerido", "Entender o risco", "Montar plano", "Mais opcoes"];
    case "retirada_pessoal":
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opcoes"];
    case "reserva":
      return ["Ver valor sugerido", "Montar plano", "Entender o risco", "Mais opcoes"];
    default:
      return ["Montar plano", "Entender o risco", "Ver valor sugerido", "Mais opcoes"];
  }
}

function containsAny(base: string, terms: string[]) {
  return terms.some((term) => base.includes(term));
}

function isGrowthQuestion(question: string) {
  return containsAny(question, [
    "ganhar mais dinheiro",
    "vender mais",
    "aumentar faturamento",
    "crescer",
    "negocio travou",
    "faturando pouco",
  ]);
}

function buildDecisionMessage(params: {
  answer: ConsultorQuestionAnswer;
  advisor: FinancialAdvisorResult;
  metrics: ContextMetrics;
}): { message: string; card?: ConsultorRichCard; tone: FluxTone } {
  const { answer, advisor, metrics } = params;
  const question = answer.normalizedQuestion;

  const asksTravel = containsAny(question, ["viagem", "viajar"]);
  const asksWithdraw = answer.intent === "retirada_pessoal" || containsAny(question, ["tirar", "retirada", "pro labore"]);
  const asksInvest = answer.intent === "investir" || containsAny(question, ["invest", "aportar"]);
  const asksSpend = answer.intent === "gastos" || containsAny(question, ["gastar", "gasto", "compra"]);
  const asksSave = answer.intent === "guardar" || answer.intent === "reserva" || containsAny(question, ["guardar", "poupar", "reserva"]);

  const safeTone =
    advisor.snapshot.riskProfile.level === "high"
      ? "seu caixa esta sensivel e pede cautela"
      : "voce tem margem, mas precisa de disciplina";

  let decision: HumanizedDecision;

  if (asksTravel) {
    const canTravel = metrics.travelLimit > 0;
    decision = {
      contextKey: "travel",
      scenarioReading: canTravel
        ? `da para planejar essa viagem com controle, porque ${safeTone}`
        : `hoje nao e o melhor momento para viagem, porque ${safeTone}`,
      practicalGuidance: canTravel
        ? "separe so o valor da viagem e mantenha folga para o giro da semana"
        : "segure gasto opcional e recupere previsibilidade primeiro",
      clearLimit: canTravel
        ? `nao passar de ${toMoney(metrics.travelLimit)} agora`
        : `preservar pelo menos ${toMoney(metrics.protectedBase)} antes desse passo`,
      conversationClosing: "Me diz o plano da viagem que eu te falo se vale fazer agora.",
      card: {
        title: "Faixa segura para viagem",
        description: `${toMoney(metrics.travelLimit)}`,
      },
    };
  } else if (asksWithdraw) {
    decision = {
      contextKey: "withdraw",
      scenarioReading:
        metrics.withdrawLimit > 0
          ? `ha espaco para retirada pessoal sem baguncar o fluxo, mas ${safeTone}`
          : `hoje nao ha folga para retirada sem apertar os proximos dias`,
      practicalGuidance:
        metrics.withdrawLimit > 0
          ? "retire com teto e deixe reserva operacional"
          : "segure retirada agora e recomponha caixa",
      clearLimit:
        metrics.withdrawLimit > 0
          ? `retirada de ate ${toMoney(metrics.withdrawLimit)}`
          : `nenhuma retirada ate recuperar ${toMoney(metrics.protectedBase)} de protecao`,
      conversationClosing: "Se quiser, eu monto um teto semanal de retirada para voce.",
      card: {
        title: "Retirada segura agora",
        description: `${toMoney(metrics.withdrawLimit)}`,
      },
    };
  } else if (asksInvest) {
    decision = {
      contextKey: "invest",
      scenarioReading:
        metrics.prudentInvest > 0
          ? `da para investir com controle e proteger o dia a dia`
          : `ainda nao e hora de investir sem risco de aperto`,
      practicalGuidance:
        metrics.prudentInvest > 0
          ? "comeca pequeno e mede impacto por 7 dias"
          : "fortalece reserva antes de aumentar risco",
      clearLimit:
        metrics.prudentInvest > 0
          ? `faixa prudente entre ${toMoney(metrics.investFloor)} e ${toMoney(metrics.investCeil)}`
          : `manter pelo menos ${toMoney(metrics.protectedBase)} protegido`,
      conversationClosing: "Quer que eu te passe um plano de aporte em etapas?",
      card: {
        title: "Faixa prudente de investimento",
        description: `${toMoney(metrics.investFloor)} a ${toMoney(metrics.investCeil)}`,
      },
    };
  } else if (asksSpend) {
    decision = {
      contextKey: "spend",
      scenarioReading:
        metrics.safeSpend > 0
          ? `hoje da para movimentar sem quebrar o fluxo, se tiver controle`
          : "o cenario esta apertado e gasto impulsivo pode te prender",
      practicalGuidance:
        metrics.safeSpend > 0
          ? "prioriza essencial e adia o que nao traz retorno"
          : "segura opcional e protege operacao",
      clearLimit:
        metrics.safeSpend > 0
          ? `gasto seguro de ate ${toMoney(metrics.safeSpend)}`
          : "limite curto hoje, foco total em preservar caixa",
      conversationClosing: "Me fala o gasto que voce quer fazer e eu te digo se vale.",
      card: {
        title: "Limite de gasto seguro hoje",
        description: `${toMoney(metrics.safeSpend)}`,
      },
    };
  } else if (asksSave) {
    decision = {
      contextKey: "save",
      scenarioReading:
        metrics.saveTarget > 0
          ? "ha espaco para guardar com consistencia"
          : "vale comecar pequeno para nao travar seu mes",
      practicalGuidance:
        metrics.saveTarget > 0
          ? "automatiza um valor simples toda semana"
          : "inicia com valor minimo e sobe depois",
      clearLimit:
        metrics.saveTarget > 0
          ? `meta recomendada de ${toMoney(metrics.saveTarget)} no ritmo atual`
          : "nao comprometer despesas essenciais",
      conversationClosing: "Quer que eu monte sua meta de 14 dias agora?",
      card: {
        title: "Valor recomendado para reserva",
        description: `${toMoney(metrics.saveTarget)}`,
      },
    };
  } else {
    decision = {
      contextKey: "general",
      scenarioReading:
        advisor.snapshot.riskProfile.level === "low"
          ? `seu momento esta mais estavel e ${safeTone}`
          : `seu momento pede atencao para nao perder folga`,
      practicalGuidance: "protege caixa primeiro e decide com objetivo",
      clearLimit: `referencia segura de movimentacao hoje: ${toMoney(metrics.safeSpend)}`,
      conversationClosing: "Me diz a decisao de agora que eu te dou o caminho mais seguro.",
      card: {
        title: "Folga financeira de referencia",
        description: `${toMoney(metrics.safeSpend)}`,
      },
    };
  }

  const mood = detectUserMood(answer.question);
  const tone = chooseFluxTone({
    question: answer.question,
    mood,
    riskTone: inferRiskTone(advisor),
    intent: answer.intent,
    hasGrowthIntent: isGrowthQuestion(question),
  });

  return {
    message: generateHumanizedResponse({
      contextKey: `${decision.contextKey}-${answer.intent}`,
      scenarioReading: decision.scenarioReading,
      practicalGuidance: decision.practicalGuidance,
      clearLimit: decision.clearLimit,
      conversationClosing: decision.conversationClosing,
    }),
    card: decision.card,
    tone,
  };
}

export function answerConsultorConversation(input: BuildConversationInput): ConsultorConversationReply {
  const answer = answerConsultorQuestion(input);
  const dataAvailability = validateFinancialDataAvailability({
    transactions: input.transactions,
    pots: input.pots ?? [],
    adjustmentAccounts: input.adjustmentAccounts ?? [],
  });

  if (!dataAvailability.ok && (isGrowthQuestion(input.question) || containsAny(answer.normalizedQuestion, ["meta", "cenario", "simular", "invest"]))) {
    return {
      answer,
      message: `${dataAvailability.message}\n\n${dataAvailability.fallback}`,
      riskTone: "attention",
      quickActions: [
        "Registrar entrada rápida",
        "Registrar saída rápida",
        "Configurar meta de reserva",
      ],
      richCards: [],
    };
  }

  const growthReply = buildGrowthResponse({
    question: input.question,
    advisor: input.advisor,
    transactions: input.transactions,
    clients: input.clients,
    services: input.services,
  });

  if (growthReply.matched) {
    const risk = growthReply.riskTone ?? inferRiskTone(input.advisor);
    const tone = chooseFluxTone({
      question: input.question,
      mood: detectUserMood(input.question),
      riskTone: risk,
      hasGrowthIntent: true,
    });
    const primaryAction = growthReply.quickActions?.[0] ?? "Me diz por onde voce quer comecar.";

    return {
      answer,
      message: humanizeFinancialMessage({
        contextKey: "growth-advisor",
        question: input.question,
        tone,
        baseMessage: growthReply.message ?? "Nao consegui montar a estrategia de crescimento agora.",
        scenarioReading: "Aqui o foco e crescer sem sacrificar caixa.",
        practicalGuidance: "Ticket medio, recorrencia e margem precisam andar juntos.",
        clearLimit: "Nao aumentar custo fixo sem demanda validada.",
        reason: "crescimento bom e o que cabe no caixa e dura no tempo",
        nextAction: primaryAction,
      }),
      riskTone: risk,
      quickActions: growthReply.quickActions ?? actionByIntent(answer.intent),
      richCards: growthReply.cards ?? [],
    };
  }

  const scenarioReply = buildScenarioResponse({
    question: input.question,
    advisor: input.advisor,
    transactions: input.transactions,
  });

  if (scenarioReply.matched) {
    const risk = scenarioReply.riskTone ?? inferRiskTone(input.advisor);
    const tone = chooseFluxTone({
      question: input.question,
      mood: detectUserMood(input.question),
      riskTone: risk,
      isEducational: true,
    });
    const primaryAction = scenarioReply.quickActions?.[0] ?? "Quer que eu compare com outro cenario?";

    return {
      answer,
      message: humanizeFinancialMessage({
        contextKey: "scenario-simulator",
        question: input.question,
        tone,
        baseMessage: scenarioReply.missingPrompt ?? scenarioReply.message ?? "Nao consegui concluir a simulacao agora.",
        scenarioReading: "Simular antes evita erro caro depois.",
        practicalGuidance: "Compare impacto de 3, 6 e 12 meses antes de decidir.",
        clearLimit: "Estimativa nao e promessa de resultado.",
        reason: "clareza de risco melhora sua decisao",
        nextAction: primaryAction,
      }),
      riskTone: risk,
      quickActions: scenarioReply.quickActions ?? actionByIntent(answer.intent),
      richCards: scenarioReply.cards ?? [],
    };
  }

  const goalReply = buildGoalMentorResponse({
    question: input.question,
    pots: input.pots ?? [],
    transactions: input.transactions,
    adjustmentAccounts: input.adjustmentAccounts ?? [],
  });

  if (goalReply.matched) {
    const risk = goalReply.riskTone ?? inferRiskTone(input.advisor);
    const tone = chooseFluxTone({
      question: input.question,
      mood: detectUserMood(input.question),
      riskTone: risk,
      isEducational: true,
      isCelebration: risk === "positive",
    });
    const primaryAction = goalReply.quickActions?.[0] ?? "Quer que eu acompanhe essa meta com voce dia a dia?";

    return {
      answer,
      message: humanizeFinancialMessage({
        contextKey: "goal-mentor",
        question: input.question,
        tone,
        baseMessage: goalReply.message ?? "Nao consegui ler suas metas agora.",
        scenarioReading: "Meta sem acompanhamento vira desejo. Meta com plano vira resultado.",
        practicalGuidance: "Divida em hoje, 7 dias e 30 dias para reduzir friccao.",
        clearLimit: "Nao acelerar de um jeito que aperte seu caixa.",
        reason: "constancia com seguranca e o que leva ate o fim da meta",
        nextAction: primaryAction,
      }),
      riskTone: risk,
      quickActions: goalReply.quickActions ?? actionByIntent(answer.intent),
      richCards: goalReply.cards ?? [],
    };
  }

  const metrics = computeMetrics(input.advisor);
  const decision = buildDecisionMessage({
    answer,
    advisor: input.advisor,
    metrics,
  });
  const risk = inferRiskTone(input.advisor);
  const primaryAction = actionByIntent(answer.intent)[0] ?? "Me diz o que voce quer fazer agora.";

  return {
    answer,
    message: humanizeFinancialMessage({
      contextKey: `general-${answer.intent}`,
      question: input.question,
      tone: decision.tone,
      baseMessage: decision.message,
      scenarioReading: "Seu momento pede clareza e ritmo, nao impulso.",
      practicalGuidance: "Protege caixa primeiro e acelera no que da retorno.",
      clearLimit: "Nao sacrificar o essencial por ansiedade do curto prazo.",
      reason: "disciplina no caixa abre espaco para crescer com menos pressao",
      nextAction: primaryAction,
    }),
    riskTone: risk,
    quickActions: actionByIntent(answer.intent),
    richCards: decision.card ? [decision.card] : [],
  };
}
