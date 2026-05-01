export type FluxTone =
  | "safe"
  | "warning"
  | "critical"
  | "growth"
  | "emotional"
  | "educational"
  | "celebration";

export type UserMood = "calm" | "worried" | "confused" | "ambitious" | "frustrated" | "hopeful";

export type HumanizedResponseData = {
  contextKey: string;
  scenarioReading: string;
  practicalGuidance: string;
  clearLimit: string;
  conversationClosing: string;
};

type ToneSelectionInput = {
  question: string;
  riskTone?: "positive" | "attention" | "critical";
  intent?: string;
  mood?: UserMood;
  hasGrowthIntent?: boolean;
  isEducational?: boolean;
  isCelebration?: boolean;
};

type HumanizeInput = {
  contextKey: string;
  question: string;
  tone: FluxTone;
  scenarioReading?: string;
  practicalGuidance?: string;
  clearLimit?: string;
  reason?: string;
  nextAction: string;
  baseMessage?: string;
};

const lastVariantByContext = new Map<string, number>();

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function ensureEndingAction(text: string, nextAction: string) {
  const safeNext = nextAction.trim();
  if (!safeNext) return text.trim();
  const cleaned = text.trim();
  if (cleaned.endsWith("?") || cleaned.endsWith("!")) return `${cleaned}\n${safeNext}`;
  return `${cleaned}\n${safeNext}`;
}

export function detectUserMood(question: string): UserMood {
  const normalized = normalizeText(question);

  if (/\b(preocup|medo|ansioso|ansiedade|apert|quebrad|desespero)\b/.test(normalized)) return "worried";
  if (/\b(travou|nao sei|confuso|perdido|entendi)\b/.test(normalized)) return "confused";
  if (/\b(vender mais|crescer|faturar mais|ganhar mais)\b/.test(normalized)) return "ambitious";
  if (/\b(faturando pouco|nao da certo|cansado|desanimado)\b/.test(normalized)) return "frustrated";
  if (/\b(boa|consegui|bati meta|avancei|deu certo)\b/.test(normalized)) return "hopeful";
  return "calm";
}

export function chooseFluxTone(input: ToneSelectionInput): FluxTone {
  if (input.isCelebration) return "celebration";
  if (input.hasGrowthIntent) return "growth";
  if (input.isEducational || /\b(o que|como funciona|explica|entender)\b/.test(normalizeText(input.question))) {
    return "educational";
  }
  if (input.riskTone === "critical") return "critical";
  if (input.riskTone === "attention") return "warning";
  if (input.mood === "worried" || input.mood === "frustrated") return "emotional";
  if (input.mood === "confused") return "educational";
  return "safe";
}

export function generateResponseVariation(params: {
  tone: FluxTone;
  scenarioReading?: string;
  practicalGuidance?: string;
  clearLimit?: string;
  reason?: string;
  nextAction: string;
  baseMessage?: string;
}) {
  const reading = params.scenarioReading?.trim() || "Olhando seus numeros, da para agir com clareza.";
  const guidance = params.practicalGuidance?.trim() || "Vamos no movimento mais simples e seguro agora.";
  const limit = params.clearLimit?.trim() || "Sem estourar seu caixa no impulso.";
  const reason = params.reason?.trim() || "Isso protege sua margem e te da consistencia.";
  const action = params.nextAction.trim();

  const introsByTone: Record<FluxTone, string[]> = {
    safe: [
      "Dá para respirar. Seu caixa não está no aperto agora.",
      "Seu momento esta mais estavel. Boa noticia.",
      "Hoje o cenario esta controlado, sem susto imediato.",
    ],
    warning: [
      "Tem sinal de alerta, mas da para ajustar cedo.",
      "Aqui pede atencao. Nada de panico, so controle.",
      "Esse ponto merece cuidado agora, antes de virar problema.",
    ],
    critical: [
      "Vou ser direto: aqui tem risco real.",
      "Alerta importante. Se não agir agora, aperta.",
      "Esse cenário pede decisão hoje, sem adiar.",
    ],
    growth: [
      "Boa pergunta. Aqui o foco e crescer com margem.",
      "Crescer dá, mas com estratégia, não no volume cego.",
      "Para ganhar mais, vamos atacar alavanca certa.",
    ],
    emotional: [
      "Eu entendo a pressao. Quem trabalha por conta sente isso na pele.",
      "Respira. Você não está sozinho nisso.",
      "Faz sentido você estar preocupado. Vamos organizar com calma.",
    ],
    educational: [
      "Vamos simplificar isso.",
      "Sem termo complicado: o ponto principal e este.",
      "Te explico de forma direta para ficar facil de decidir.",
    ],
    celebration: [
      "Boa! Esse resultado mostra evolucao real.",
      "Excelente avancar assim. Isso e consistencia.",
      "Mandou bem. Isso prova que seu controle melhorou.",
    ],
  };

  const middleBlocks = [
    `${reading}\n${guidance}\nLimite claro: ${limit}\nMotivo: ${reason}`,
    `${reading}\nPlano simples: ${guidance}\nRegra de protecao: ${limit}\nPor que: ${reason}`,
    `${reading}\nAjuste pratico agora: ${guidance}\nNao passa desse ponto: ${limit}\nIsso importa porque ${reason.toLowerCase()}`,
  ];

  const introPool = introsByTone[params.tone];
  const introLines = introPool.map((intro) => `${intro}\n${middleBlocks[0]}`);
  const baseBlock = params.baseMessage?.trim() ? `${params.baseMessage.trim()}\n` : "";

  return [
    `${baseBlock}${introPool[0]}\n${middleBlocks[0]}\n${action}`,
    `${baseBlock}${introPool[1]}\n${middleBlocks[1]}\n${action}`,
    `${baseBlock}${introPool[2]}\n${middleBlocks[2]}\n${action}`,
    ...introLines.map((line) => `${baseBlock}${line}\n${action}`),
  ];
}

export function avoidRepetitiveResponse(contextKey: string, candidates: string[]) {
  if (candidates.length === 0) return "";
  const daySalt = new Date().getDate();
  const baseIndex = hashString(`${contextKey}|${daySalt}`) % candidates.length;
  const previousIndex = lastVariantByContext.get(contextKey);
  let selected = baseIndex;
  if (previousIndex !== undefined && previousIndex === selected && candidates.length > 1) {
    selected = (selected + 1) % candidates.length;
  }
  lastVariantByContext.set(contextKey, selected);
  return candidates[selected];
}

export function humanizeFinancialMessage(input: HumanizeInput) {
  const variants = generateResponseVariation({
    tone: input.tone,
    scenarioReading: input.scenarioReading,
    practicalGuidance: input.practicalGuidance,
    clearLimit: input.clearLimit,
    reason: input.reason,
    nextAction: input.nextAction,
    baseMessage: input.baseMessage,
  });
  const selected = avoidRepetitiveResponse(`${input.contextKey}:${input.tone}`, variants);
  return ensureEndingAction(selected, input.nextAction);
}

export function generateHumanizedResponse(data: HumanizedResponseData) {
  const mood = detectUserMood(data.scenarioReading);
  const tone = chooseFluxTone({
    question: `${data.scenarioReading} ${data.practicalGuidance} ${data.conversationClosing}`,
    mood,
  });
  return humanizeFinancialMessage({
    contextKey: data.contextKey,
    question: data.scenarioReading,
    tone,
    scenarioReading: data.scenarioReading,
    practicalGuidance: data.practicalGuidance,
    clearLimit: data.clearLimit,
    reason: "você decide melhor quando protege caixa e margem ao mesmo tempo",
    nextAction: data.conversationClosing,
  });
}
