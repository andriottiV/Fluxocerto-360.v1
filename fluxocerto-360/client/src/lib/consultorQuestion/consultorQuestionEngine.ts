import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import type { Transaction } from "@/lib/types";

import { parseConsultorQuestion, type ConsultorQuestionIntent } from "./consultorIntentParser";
import { buildConsultorStructuredAnswer, type ConsultorStructuredAnswer } from "./consultorResponseBuilder";

export type ConsultorQuestionAnswer = {
  id: string;
  question: string;
  normalizedQuestion: string;
  intent: ConsultorQuestionIntent;
  generatedAt: string;
  resposta: ConsultorStructuredAnswer;
};

type ConsultorQuestionEngineInput = {
  question: string;
  advisor: FinancialAdvisorResult;
  transactions: Transaction[];
};

export function answerConsultorQuestion(input: ConsultorQuestionEngineInput): ConsultorQuestionAnswer {
  const parsed = parseConsultorQuestion(input.question);
  const resposta = buildConsultorStructuredAnswer({
    intent: parsed.intent,
    advisor: input.advisor,
    transactions: input.transactions,
  });

  return {
    id: `cq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: parsed.originalQuestion,
    normalizedQuestion: parsed.normalizedQuestion,
    intent: parsed.intent,
    generatedAt: new Date().toISOString(),
    resposta,
  };
}

