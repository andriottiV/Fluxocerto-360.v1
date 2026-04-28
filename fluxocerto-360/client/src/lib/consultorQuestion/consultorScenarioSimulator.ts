import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import { parseDateSafe } from "@/lib/finance";
import type { Transaction } from "@/lib/types";
import { TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export type ScenarioRiskLevel = "baixo" | "medio" | "alto";

export type ScenarioType =
  | "monthlySavings"
  | "priceIncrease"
  | "debtPayment"
  | "investmentGrowth"
  | "revenueLoss"
  | "hiringImpact";

export type ScenarioInput = {
  question: string;
  advisor: FinancialAdvisorResult;
  transactions: Transaction[];
};

export type ScenarioDetection = {
  isScenarioQuestion: boolean;
  scenarioTypes: ScenarioType[];
  amount: number | null;
  percentage: number | null;
  missingData: string[];
};

export type ScenarioSimulation = {
  id: string;
  type: ScenarioType;
  title: string;
  summary: string;
  currentMonthly: number;
  simulatedMonthly: number;
  impactMonthly: number;
  impact3Months: number;
  impact6Months: number;
  impact12Months: number;
  risk: ScenarioRiskLevel;
  pros: string[];
  cons: string[];
  recommendation: string;
  assumption: string;
};

export type ScenarioComparison = {
  bestScenarioId: string | null;
  ranking: Array<{ id: string; title: string; score: number }>;
  conclusion: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractCurrencyAmount(question: string): number | null {
  const normalized = normalizeText(question).replace(/r\$/g, "r$");
  const match = normalized.match(/(?:r\$|r\s*)?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/);
  if (!match?.[1]) return null;
  const raw = match[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractPercentage(question: string): number | null {
  const normalized = normalizeText(question);
  const pctMatch = normalized.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);
  if (pctMatch?.[1]) {
    const value = Number(pctMatch[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const gainMatch = normalized.match(/aumentar.*?(\d{1,3}(?:[.,]\d{1,2})?)/);
  if (!gainMatch?.[1]) return null;
  const value = Number(gainMatch[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function toRiskTone(risk: ScenarioRiskLevel): "positive" | "attention" | "critical" {
  if (risk === "alto") return "critical";
  if (risk === "medio") return "attention";
  return "positive";
}

function getMonthlyBaseline(advisor: FinancialAdvisorResult, transactions: Transaction[]) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 30);

  const recent = transactions.filter((tx) => {
    const parsed = parseDateSafe(tx.date);
    return parsed ? parsed >= from : false;
  });

  const recentIncome = recent
    .filter((tx) => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const recentExpense = recent
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const baselineIncome = recentIncome > 0 ? recentIncome : advisor.snapshot.financialSummary.totalIncome;
  const baselineExpense = recentExpense > 0 ? recentExpense : advisor.snapshot.financialSummary.totalExpense;
  const baselineNet = baselineIncome - baselineExpense;

  return {
    income: baselineIncome,
    expense: baselineExpense,
    net: baselineNet,
    reserveBalance: advisor.snapshot.reserveSummary.currentBalance,
  };
}

export function detectScenarioQuestion(question: string): ScenarioDetection {
  const normalized = normalizeText(question);
  const isScenarioQuestion =
    normalized.startsWith("e se") ||
    normalized.includes("simular") ||
    normalized.includes("cenario") ||
    normalized.includes("cenario");

  const scenarioTypes: ScenarioType[] = [];
  if (normalized.includes("economizar") || normalized.includes("guardar")) scenarioTypes.push("monthlySavings");
  if (normalized.includes("aumentar") && normalized.includes("preco")) scenarioTypes.push("priceIncrease");
  if (normalized.includes("divida")) scenarioTypes.push("debtPayment");
  if (normalized.includes("investir") || normalized.includes("aplicar")) scenarioTypes.push("investmentGrowth");
  if (normalized.includes("perder") && normalized.includes("cliente")) scenarioTypes.push("revenueLoss");
  if (normalized.includes("contratar") || normalized.includes("funcionario") || normalized.includes("ajudante")) {
    scenarioTypes.push("hiringImpact");
  }

  const amount = extractCurrencyAmount(question);
  const percentage = extractPercentage(question);
  const missingData: string[] = [];

  if (scenarioTypes.includes("priceIncrease") && !percentage) {
    missingData.push("percentual de aumento de preço");
  }
  if (
    (scenarioTypes.includes("monthlySavings") ||
      scenarioTypes.includes("debtPayment") ||
      scenarioTypes.includes("investmentGrowth") ||
      scenarioTypes.includes("hiringImpact")) &&
    !amount
  ) {
    missingData.push("valor mensal ou valor total para simular");
  }

  if (scenarioTypes.length === 0 && isScenarioQuestion) {
    scenarioTypes.push("monthlySavings");
  }

  return {
    isScenarioQuestion,
    scenarioTypes,
    amount,
    percentage,
    missingData,
  };
}

export function simulateMonthlySavings(input: ScenarioInput, monthlySavings: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);
  const safeAmount = Math.max(0, monthlySavings);
  const simulatedMonthly = baseline.net + safeAmount;
  const risk: ScenarioRiskLevel = safeAmount > baseline.income * 0.35 ? "medio" : "baixo";

  return {
    id: "monthlySavings",
    type: "monthlySavings",
    title: "Economizar todo mês",
    summary: `Se você economizar ${formatCurrency(safeAmount)} por mês, seu caixa tende a ganhar tração com consistência.`,
    currentMonthly: baseline.net,
    simulatedMonthly,
    impactMonthly: safeAmount,
    impact3Months: safeAmount * 3,
    impact6Months: safeAmount * 6,
    impact12Months: safeAmount * 12,
    risk,
    pros: ["Acelera construção de reserva", "Reduz ansiedade de curto prazo"],
    cons: ["Exige disciplina mensal", "Pode apertar consumo no começo"],
    recommendation:
      risk === "baixo"
        ? "Cenário favorável. Comece com esse valor e revise em 30 dias."
        : "Funciona, mas vale começar um pouco abaixo e subir gradualmente.",
    assumption: "Estimativa considerando o mesmo ritmo de receita e despesas atuais.",
  };
}

export function simulatePriceIncrease(input: ScenarioInput, increasePercent: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);
  const safePct = Math.max(0, increasePercent);
  const expectedVolumeLoss = safePct >= 25 ? 0.15 : safePct >= 15 ? 0.08 : 0.04;
  const projectedIncome = baseline.income * (1 + safePct / 100) * (1 - expectedVolumeLoss);
  const simulatedMonthly = projectedIncome - baseline.expense;
  const impact = simulatedMonthly - baseline.net;
  const risk: ScenarioRiskLevel = safePct >= 25 ? "alto" : safePct >= 15 ? "medio" : "baixo";

  return {
    id: "priceIncrease",
    type: "priceIncrease",
    title: "Aumento de preço",
    summary: `Com aumento de ${safePct.toFixed(0)}%, mesmo considerando possível perda de demanda, o resultado tende a ${
      impact >= 0 ? "melhorar" : "ficar pressionado"
    }.`,
    currentMonthly: baseline.net,
    simulatedMonthly,
    impactMonthly: impact,
    impact3Months: impact * 3,
    impact6Months: impact * 6,
    impact12Months: impact * 12,
    risk,
    pros: ["Pode elevar lucro sem aumentar carga de trabalho", "Melhora percepção de valor quando bem comunicado"],
    cons: ["Risco de rejeição de clientes sensíveis a preço", "Exige ajuste de posicionamento"],
    recommendation:
      impact >= 0
        ? "Cenário favorável. Teste aumento em etapas e monitore retenção."
        : "Cenário delicado. Ajuste menor ou combine com melhoria de oferta antes de subir preço.",
    assumption: "Estimativa com perda potencial de volume entre 4% e 15% conforme agressividade do reajuste.",
  };
}

export function simulateDebtPayment(input: ScenarioInput, debtAmount: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);
  const safeDebt = Math.max(0, debtAmount);
  const monthlyRelief = safeDebt * 0.06;
  const simulatedMonthly = baseline.net + monthlyRelief;
  const risk: ScenarioRiskLevel = safeDebt > baseline.reserveBalance * 0.8 ? "alto" : safeDebt > baseline.reserveBalance * 0.45 ? "medio" : "baixo";

  return {
    id: "debtPayment",
    type: "debtPayment",
    title: "Quitar dívida agora",
    summary: `Quitar ${formatCurrency(safeDebt)} agora pode aliviar cerca de ${formatCurrency(monthlyRelief)} por mês em juros e pressão.`,
    currentMonthly: baseline.net,
    simulatedMonthly,
    impactMonthly: monthlyRelief,
    impact3Months: monthlyRelief * 3,
    impact6Months: monthlyRelief * 6,
    impact12Months: monthlyRelief * 12,
    risk,
    pros: ["Reduz juros e estresse recorrente", "Libera fôlego mensal no médio prazo"],
    cons: ["Diminui caixa imediato", "Pode comprometer reserva se não houver proteção"],
    recommendation:
      risk === "alto"
        ? "Vale negociar quitação parcial para não secar seu caixa."
        : "Cenário positivo se você preservar uma reserva mínima após o pagamento.",
    assumption: "Estimativa com alívio médio de 6% ao mês sobre o valor quitado.",
  };
}

export function simulateInvestmentGrowth(input: ScenarioInput, monthlyContribution: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);
  const safeContribution = Math.max(0, monthlyContribution);
  const annualRate = 0.1;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const projected12 = safeContribution * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate);
  const investmentGain12 = projected12 - safeContribution * 12;
  const monthlyNetImpact = -safeContribution;
  const risk: ScenarioRiskLevel = safeContribution > baseline.net * 0.5 ? "medio" : "baixo";

  return {
    id: "investmentGrowth",
    type: "investmentGrowth",
    title: "Investir mensalmente",
    summary: `Aportando ${formatCurrency(safeContribution)}/mês, você abre construção de patrimônio no longo prazo, com oscilação natural.`,
    currentMonthly: baseline.net,
    simulatedMonthly: baseline.net + monthlyNetImpact,
    impactMonthly: monthlyNetImpact,
    impact3Months: monthlyNetImpact * 3,
    impact6Months: monthlyNetImpact * 6,
    impact12Months: monthlyNetImpact * 12 + investmentGain12,
    risk,
    pros: ["Gera crescimento composto ao longo do tempo", "Cria hábito financeiro forte"],
    cons: ["Reduz caixa disponível no curto prazo", "Retorno não é garantido"],
    recommendation:
      risk === "baixo"
        ? "Cenário saudável se você mantiver aporte constante e reserva intacta."
        : "Aporte viável, mas comece menor para não pressionar seu mês.",
    assumption: "Estimativa com rendimento anual de 10% apenas como referência, sem garantia.",
  };
}

export function simulateRevenueLoss(input: ScenarioInput, estimatedLoss: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);

  let inferredLoss = Math.max(0, estimatedLoss);
  if (inferredLoss <= 0) {
    const clientIncomes = input.transactions
      .filter((tx) => tx.type === TransactionType.INCOME && !!tx.clientName)
      .reduce<Map<string, number>>((map, tx) => {
        const key = normalizeText(tx.clientName ?? "");
        map.set(key, (map.get(key) ?? 0) + tx.amount);
        return map;
      }, new Map());
    const avgTopClient = [...clientIncomes.values()].sort((a, b) => b - a)[0] ?? 0;
    inferredLoss = avgTopClient > 0 ? avgTopClient * 0.5 : baseline.income * 0.15;
  }

  const simulatedMonthly = baseline.net - inferredLoss;
  const risk: ScenarioRiskLevel = inferredLoss > baseline.income * 0.25 ? "alto" : inferredLoss > baseline.income * 0.12 ? "medio" : "baixo";

  return {
    id: "revenueLoss",
    type: "revenueLoss",
    title: "Perda de cliente/receita",
    summary: `Se você perder essa receita (${formatCurrency(inferredLoss)}), o mês tende a sentir de forma direta no lucro.`,
    currentMonthly: baseline.net,
    simulatedMonthly,
    impactMonthly: -inferredLoss,
    impact3Months: -inferredLoss * 3,
    impact6Months: -inferredLoss * 6,
    impact12Months: -inferredLoss * 12,
    risk,
    pros: ["Ajuda a antecipar plano B", "Força diversificação de clientes"],
    cons: ["Queda imediata de caixa", "Pode atrasar metas se não reagir rápido"],
    recommendation:
      risk === "alto"
        ? "Risco alto. Priorize retenção e captação ativa imediatamente."
        : "Risco gerenciável com reposição rápida de receita nas próximas semanas.",
    assumption: "Estimativa baseada no padrão recente de faturamento.",
  };
}

export function simulateHiringImpact(input: ScenarioInput, monthlyCost: number): ScenarioSimulation {
  const baseline = getMonthlyBaseline(input.advisor, input.transactions);
  const safeCost = Math.max(0, monthlyCost);
  const expectedProductivityGain = safeCost * 1.35;
  const netImpact = expectedProductivityGain - safeCost;
  const simulatedMonthly = baseline.net + netImpact;
  const risk: ScenarioRiskLevel = safeCost > baseline.income * 0.3 ? "alto" : safeCost > baseline.income * 0.18 ? "medio" : "baixo";

  return {
    id: "hiringImpact",
    type: "hiringImpact",
    title: "Contratar alguém",
    summary: `Com custo mensal de ${formatCurrency(safeCost)}, a contratação precisa gerar pelo menos ${formatCurrency(
      safeCost
    )} em receita adicional para se pagar.`,
    currentMonthly: baseline.net,
    simulatedMonthly,
    impactMonthly: netImpact,
    impact3Months: netImpact * 3,
    impact6Months: netImpact * 6,
    impact12Months: netImpact * 12,
    risk,
    pros: ["Pode aumentar capacidade de atendimento", "Libera seu tempo para atividades de maior valor"],
    cons: ["Cria custo fixo recorrente", "Demanda gestão e adaptação inicial"],
    recommendation:
      netImpact >= 0
        ? "Cenário potencialmente favorável se a nova capacidade virar receita real."
        : "Só vale contratar se houver demanda previsível para sustentar esse custo.",
    assumption: "Estimativa assumindo ganho de produtividade de 35% sobre o custo.",
  };
}

export function compareScenarios(scenarios: ScenarioSimulation[]): ScenarioComparison {
  if (scenarios.length === 0) {
    return {
      bestScenarioId: null,
      ranking: [],
      conclusion: "Sem cenários comparáveis no momento.",
    };
  }

  const riskPenalty = (risk: ScenarioRiskLevel) => (risk === "alto" ? 0.3 : risk === "medio" ? 0.15 : 0.05);
  const ranking = scenarios
    .map((scenario) => {
      const score = scenario.impact12Months - Math.abs(scenario.currentMonthly) * riskPenalty(scenario.risk);
      return { id: scenario.id, title: scenario.title, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranking[0];
  return {
    bestScenarioId: best?.id ?? null,
    ranking,
    conclusion: best
      ? `${best.title} aparece como cenário mais favorável no horizonte de 12 meses, considerando impacto e risco.`
      : "Não encontrei um cenário claramente superior.",
  };
}

function buildScenarioTableLine(label: string, value: number) {
  return `${label}: ${formatSignedCurrency(value)}`;
}

export function buildScenarioResponse(params: ScenarioInput): {
  matched: boolean;
  missingPrompt?: string;
  message?: string;
  riskTone?: "positive" | "attention" | "critical";
  quickActions?: string[];
  cards?: Array<{ title: string; description: string }>;
} {
  const detection = detectScenarioQuestion(params.question);
  if (!detection.isScenarioQuestion) return { matched: false };

  if (detection.missingData.length > 0) {
    return {
      matched: true,
      missingPrompt: `Boa pergunta de cenário. Para simular com mais precisão, me diga: ${detection.missingData.join(" e ")}.`,
      riskTone: "attention",
      quickActions: ["Simular com valor conservador", "Comparar duas opções", "Entender o risco"],
    };
  }

  const simulations: ScenarioSimulation[] = [];
  const amount = detection.amount ?? 0;
  const percentage = detection.percentage ?? 0;

  detection.scenarioTypes.forEach((type) => {
    if (type === "monthlySavings") simulations.push(simulateMonthlySavings(params, amount || 500));
    if (type === "priceIncrease") simulations.push(simulatePriceIncrease(params, percentage || 10));
    if (type === "debtPayment") simulations.push(simulateDebtPayment(params, amount || params.advisor.snapshot.financialSummary.totalExpense * 0.3));
    if (type === "investmentGrowth") simulations.push(simulateInvestmentGrowth(params, amount || 300));
    if (type === "revenueLoss") simulations.push(simulateRevenueLoss(params, amount || 0));
    if (type === "hiringImpact") simulations.push(simulateHiringImpact(params, amount || params.advisor.snapshot.financialSummary.totalExpense * 0.2));
  });

  if (simulations.length === 0) {
    simulations.push(simulateMonthlySavings(params, amount || 300));
  }

  const comparison = compareScenarios(simulations);
  const primary = simulations.find((item) => item.id === comparison.bestScenarioId) ?? simulations[0];
  const riskTone = toRiskTone(primary.risk);

  const header = simulations.length > 1
    ? `Simulei ${simulations.length} cenários para você e comparei impacto x risco.`
    : "Simulei esse cenário para você usando seu padrão financeiro atual.";

  const scenarioLines = [
    `Cenário atual (mensal): ${formatCurrency(primary.currentMonthly)}`,
    `Cenário simulado (mensal): ${formatCurrency(primary.simulatedMonthly)}`,
    buildScenarioTableLine("Impacto mensal", primary.impactMonthly),
    buildScenarioTableLine("Impacto em 3 meses", primary.impact3Months),
    buildScenarioTableLine("Impacto em 6 meses", primary.impact6Months),
    buildScenarioTableLine("Impacto em 12 meses", primary.impact12Months),
    `Risco estimado: ${primary.risk}`,
  ];

  const rankingText =
    simulations.length > 1
      ? `\nComparativo rápido:\n${comparison.ranking
          .slice(0, 3)
          .map((item, index) => `${index + 1}. ${item.title}`)
          .join("\n")}\n${comparison.conclusion}`
      : "";

  const message = `${header}\n\n${primary.summary}\n\n${scenarioLines.join("\n")}\n\nPrós: ${primary.pros.join(
    " | "
  )}\nContras: ${primary.cons.join(" | ")}\n\nRecomendação: ${primary.recommendation}\n\nPor que essa estimativa: ${primary.assumption}.${rankingText}\n\nSe quiser, eu comparo esse cenário com outra opção agora.`;

  const cards = [
    {
      title: "Impacto mensal estimado",
      description: formatSignedCurrency(primary.impactMonthly),
    },
    {
      title: "Impacto em 12 meses",
      description: formatSignedCurrency(primary.impact12Months),
    },
    {
      title: "Risco do cenário",
      description: primary.risk,
    },
  ];

  return {
    matched: true,
    message,
    riskTone,
    quickActions: ["Comparar com outra opção", "Rodar cenário conservador", "Me mostra prós e contras"],
    cards,
  };
}
