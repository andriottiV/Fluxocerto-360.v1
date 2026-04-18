export type ConsultorQuestionIntent =
  | "investir"
  | "gastos"
  | "fluxo_caixa"
  | "retirada_pessoal"
  | "reserva"
  | "saude_negocio"
  | "guardar"
  | "aperto"
  | "geral";

export type ParsedConsultorQuestion = {
  originalQuestion: string;
  normalizedQuestion: string;
  intent: ConsultorQuestionIntent;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INTENT_KEYWORDS: Array<{ intent: ConsultorQuestionIntent; keywords: string[] }> = [
  { intent: "investir", keywords: ["investir", "investimento", "aportar", "aplicacao"] },
  { intent: "gastos", keywords: ["gasto", "gastos", "despesa", "despesas", "cortar", "vazamento", "viajar", "viagem"] },
  { intent: "fluxo_caixa", keywords: ["fluxo", "caixa", "faturamento", "entradas", "saidas"] },
  { intent: "retirada_pessoal", keywords: ["tirando", "retirada", "retirar", "pro labore", "pessoal"] },
  { intent: "reserva", keywords: ["reserva", "emergencia", "seguranca"] },
  { intent: "saude_negocio", keywords: ["negocio", "empresa", "saudavel", "saude"] },
  { intent: "guardar", keywords: ["guardar", "economizar", "poupar"] },
  { intent: "aperto", keywords: ["aperto", "faltando", "sufoco", "divida", "quebrado"] },
];

export function parseConsultorQuestion(question: string): ParsedConsultorQuestion {
  const normalizedQuestion = normalize(question);
  const matched = INTENT_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => normalizedQuestion.includes(keyword))
  );

  return {
    originalQuestion: question.trim(),
    normalizedQuestion,
    intent: matched?.intent ?? "geral",
  };
}
