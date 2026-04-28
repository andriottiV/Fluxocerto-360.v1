import type { FinancialAdvisorResult } from "@/lib/financialAdvisor";
import { parseDateSafe } from "@/lib/finance";
import type { Client, Service, Transaction } from "@/lib/types";
import { TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type GrowthInput = {
  question: string;
  advisor: FinancialAdvisorResult;
  transactions: Transaction[];
  clients?: Client[];
  services?: Service[];
};

type GrowthRisk = "baixo" | "medio" | "alto";

type GrowthOpportunity = {
  title: string;
  why: string;
  estimatedImpact: string;
};

type GrowthBottleneck = {
  title: string;
  detail: string;
  severity: GrowthRisk;
};

type GrowthRoadmap = {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
};

type GrowthAnalysis = {
  monthlyRevenue: number;
  monthlyExpense: number;
  monthlyNet: number;
  averageTicket: number;
  activeClients: number;
  recurringClients: number;
  inactiveClients: number;
  topSellingServices: Array<{ name: string; count: number; revenue: number }>;
  topMarginServices: Array<{ name: string; margin: number }>;
  paymentMix: Array<{ method: string; share: number }>;
  strongestDays: string[];
  weakestDays: string[];
  marginPct: number;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toPercent(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

function monthWindow(transactions: Transaction[], days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return transactions.filter((tx) => {
    const date = parseDateSafe(tx.date);
    return date ? date >= start && date <= end : false;
  });
}

function detectGrowthQuestion(question: string) {
  const normalized = normalizeText(question);
  const terms = [
    "ganhar mais dinheiro",
    "vender mais",
    "aumentar meu faturamento",
    "aumentar faturamento",
    "negocio travou",
    "faturando pouco",
    "crescer",
    "crescimento",
    "aumentar receita",
  ];
  return terms.some((term) => normalized.includes(term));
}

function buildServiceStats(transactions: Transaction[]) {
  const map = new Map<string, { count: number; revenue: number; expense: number }>();
  transactions.forEach((tx) => {
    const serviceName = tx.serviceName?.trim() || tx.category?.trim() || tx.description?.trim() || "Serviço geral";
    const key = serviceName;
    const prev = map.get(key) ?? { count: 0, revenue: 0, expense: 0 };
    if (tx.type === TransactionType.INCOME) {
      prev.count += 1;
      prev.revenue += tx.amount;
    } else if (tx.type === TransactionType.EXPENSE) {
      prev.expense += tx.amount;
    }
    map.set(key, prev);
  });
  return map;
}

function buildClientStats(transactions: Transaction[], clients: Client[] = []) {
  const now = new Date();
  const byClient = new Map<string, { name: string; visits: number; revenue: number; lastDate: Date | null }>();
  transactions.forEach((tx) => {
    if (tx.type !== TransactionType.INCOME) return;
    const name = tx.clientName?.trim();
    if (!name) return;
    const key = normalizeText(name);
    const prev = byClient.get(key) ?? { name, visits: 0, revenue: 0, lastDate: null };
    prev.visits += 1;
    prev.revenue += tx.amount;
    const date = parseDateSafe(tx.date);
    if (date && (!prev.lastDate || date > prev.lastDate)) prev.lastDate = date;
    byClient.set(key, prev);
  });

  clients.forEach((client) => {
    const key = normalizeText(client.name);
    if (byClient.has(key)) return;
    const lastDate = parseDateSafe(client.lastService ?? "");
    byClient.set(key, { name: client.name, visits: 0, revenue: client.totalSpent || 0, lastDate });
  });

  let recurringClients = 0;
  let inactiveClients = 0;
  byClient.forEach((item) => {
    if (item.visits >= 2) recurringClients += 1;
    const daysSince = item.lastDate ? Math.floor((now.getTime() - item.lastDate.getTime()) / 86400000) : 999;
    if (daysSince > 60) inactiveClients += 1;
  });

  return {
    activeClients: byClient.size,
    recurringClients,
    inactiveClients,
  };
}

export function analyzeGrowthOpportunities(input: GrowthInput): { analysis: GrowthAnalysis; opportunities: GrowthOpportunity[] } {
  const recent = monthWindow(input.transactions, 30);
  const revenue = recent
    .filter((tx) => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = recent
    .filter((tx) => tx.type === TransactionType.EXPENSE)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const net = revenue - expense;
  const incomeCount = recent.filter((tx) => tx.type === TransactionType.INCOME).length;
  const averageTicket = incomeCount > 0 ? revenue / incomeCount : 0;
  const marginPct = revenue > 0 ? (net / revenue) * 100 : 0;

  const serviceStats = buildServiceStats(recent);
  const topSellingServices = [...serviceStats.entries()]
    .map(([name, value]) => ({ name, count: value.count, revenue: value.revenue, expense: value.expense }))
    .filter((item) => item.count > 0 || item.revenue > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const topMarginServices = [...serviceStats.entries()]
    .map(([name, value]) => {
      const margin = value.revenue > 0 ? ((value.revenue - value.expense) / value.revenue) * 100 : 0;
      return { name, margin };
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 3);

  const paymentMap = new Map<string, number>();
  recent
    .filter((tx) => tx.type === TransactionType.INCOME)
    .forEach((tx) => {
      const method = tx.paymentMethod ?? "nao informado";
      paymentMap.set(method, (paymentMap.get(method) ?? 0) + tx.amount);
    });
  const paymentMix = [...paymentMap.entries()]
    .map(([method, amount]) => ({
      method,
      share: revenue > 0 ? (amount / revenue) * 100 : 0,
      amount,
    }))
    .sort((a, b) => b.share - a.share)
    .map(({ method, share }) => ({ method, share }));

  const clientStats = buildClientStats(recent, input.clients ?? []);
  const strongestDays = input.advisor.snapshot.financialSummary.strongestDays;
  const weakestDays = input.advisor.snapshot.financialSummary.weakestDays;

  const opportunities: GrowthOpportunity[] = [];
  if (averageTicket > 0) {
    opportunities.push({
      title: "Aumentar ticket médio com combo",
      why: `Seu ticket médio atual está em ${formatCurrency(averageTicket)} e pode subir com oferta de complemento.`,
      estimatedImpact: `Se subir 12%, impacto estimado de +${formatCurrency(revenue * 0.12)} no mês.`,
    });
  }
  if (clientStats.inactiveClients > 0) {
    opportunities.push({
      title: "Reativar clientes inativos",
      why: `Você tem ${clientStats.inactiveClients} cliente(s) sem retorno recente.`,
      estimatedImpact: `Reativando 20%, pode voltar cerca de ${formatCurrency(averageTicket * Math.max(1, clientStats.inactiveClients * 0.2))}.`,
    });
  }
  if (paymentMix.find((item) => item.method === "credito" && item.share > 35)) {
    opportunities.push({
      title: "Migrar parte do recebimento para Pix",
      why: "Você concentra boa parte das entradas no crédito, o que tende a elevar taxa.",
      estimatedImpact: "Parte da margem pode ser recuperada incentivando Pix com benefício simples.",
    });
  }

  return {
    analysis: {
      monthlyRevenue: revenue,
      monthlyExpense: expense,
      monthlyNet: net,
      averageTicket,
      activeClients: clientStats.activeClients,
      recurringClients: clientStats.recurringClients,
      inactiveClients: clientStats.inactiveClients,
      topSellingServices: topSellingServices.map(({ name, count, revenue: value }) => ({ name, count, revenue: value })),
      topMarginServices,
      paymentMix,
      strongestDays,
      weakestDays,
      marginPct,
    },
    opportunities,
  };
}

export function detectRevenueBottlenecks(analysis: GrowthAnalysis): GrowthBottleneck[] {
  const bottlenecks: GrowthBottleneck[] = [];

  if (analysis.marginPct < 18) {
    bottlenecks.push({
      title: "Margem comprimida",
      detail: `Sua margem está em ${toPercent(analysis.marginPct)}, abaixo da faixa confortável para crescer com segurança.`,
      severity: analysis.marginPct < 10 ? "alto" : "medio",
    });
  }
  if (analysis.recurringClients < Math.max(2, analysis.activeClients * 0.35)) {
    bottlenecks.push({
      title: "Baixa recorrência",
      detail: "Poucos clientes voltando com frequência, o que deixa faturamento instável.",
      severity: "medio",
    });
  }
  if (analysis.inactiveClients > 0) {
    bottlenecks.push({
      title: "Base fria",
      detail: `${analysis.inactiveClients} cliente(s) sem retorno há muito tempo.`,
      severity: analysis.inactiveClients >= 6 ? "alto" : "medio",
    });
  }
  if (analysis.topSellingServices.length > 0 && analysis.topSellingServices[0].count >= Math.max(3, analysis.topSellingServices.length * 2)) {
    bottlenecks.push({
      title: "Dependência de poucos serviços",
      detail: "Grande parte da receita vem de um único tipo de serviço.",
      severity: "medio",
    });
  }

  return bottlenecks.slice(0, 4);
}

export function suggestPriceIncrease(analysis: GrowthAnalysis) {
  const strongestService = analysis.topSellingServices[0];
  if (!strongestService) {
    return "Sem dados suficientes de serviço para sugerir reajuste com segurança.";
  }
  const suggestedPct = analysis.marginPct < 15 ? 12 : 8;
  const estimatedGain = strongestService.revenue * (suggestedPct / 100);
  return `Teste reajuste de ${suggestedPct}% em ${strongestService.name} e monitore por 2 semanas. Ganho potencial de ${formatCurrency(
    estimatedGain
  )} no mês se a demanda se mantiver.`;
}

export function suggestUpsellOpportunities(analysis: GrowthAnalysis) {
  const service = analysis.topSellingServices[0];
  if (!service) return "Crie um complemento simples para seu serviço principal e teste em 10 atendimentos.";
  return `Use ${service.name} como porta de entrada e ofereça um complemento (combo/pacote). Se 25% aceitarem, seu ticket médio pode subir sem aumentar jornada.`;
}

export function suggestClientReactivation(analysis: GrowthAnalysis) {
  if (analysis.inactiveClients <= 0) {
    return "Sua base está ativa. Foque em fidelização e indicação para acelerar crescimento.";
  }
  return `Reative ${Math.min(10, analysis.inactiveClients)} clientes com mensagem direta e oferta simples para horários ociosos.`;
}

export function suggestMarketingActions(analysis: GrowthAnalysis) {
  const weak = analysis.weakestDays[0] ?? "dias fracos";
  return `Concentre divulgação e ofertas nos ${weak}. Priorize prova social, agenda limitada e incentivo ao Pix para proteger margem.`;
}

export function buildGrowthRoadmap(analysis: GrowthAnalysis): GrowthRoadmap {
  const topService = analysis.topSellingServices[0]?.name ?? "serviço principal";
  const weakDay = analysis.weakestDays[0] ?? "dia mais fraco";

  return {
    shortTerm: [
      `Listar 10 clientes para contato e executar campanha de reativação no WhatsApp.`,
      `Oferecer combo em ${topService} para aumentar ticket médio já nesta semana.`,
      `Preencher agenda do ${weakDay} com oferta pontual de baixa fricção.`,
    ],
    mediumTerm: [
      "Testar reajuste de preço em etapas e medir taxa de aceitação por 30 dias.",
      "Criar pacote recorrente (mensal/quinzenal) para aumentar previsibilidade.",
      "Acompanhar mix de pagamento e incentivar Pix quando fizer sentido comercial.",
    ],
    longTerm: [
      "Estruturar meta de faturamento por semana e meta de margem mínima.",
      "Padronizar rotina de retenção e reativação para reduzir meses fracos.",
      "Expandir serviços com melhor margem e cortar ofertas de baixo retorno.",
    ],
  };
}

export function buildGrowthResponse(input: GrowthInput): {
  matched: boolean;
  message?: string;
  riskTone?: "positive" | "attention" | "critical";
  quickActions?: string[];
  cards?: Array<{ title: string; description: string }>;
} {
  if (!detectGrowthQuestion(input.question)) return { matched: false };

  const { analysis, opportunities } = analyzeGrowthOpportunities(input);
  const bottlenecks = detectRevenueBottlenecks(analysis);
  const roadmap = buildGrowthRoadmap(analysis);
  const priceSuggestion = suggestPriceIncrease(analysis);
  const upsellSuggestion = suggestUpsellOpportunities(analysis);
  const reactivationSuggestion = suggestClientReactivation(analysis);
  const marketingSuggestion = suggestMarketingActions(analysis);

  const tone: "positive" | "attention" | "critical" =
    bottlenecks.some((item) => item.severity === "alto")
      ? "critical"
      : bottlenecks.length > 0
      ? "attention"
      : "positive";

  const opener =
    analysis.monthlyRevenue > 0
      ? `Mano, olhando seus dados reais, você está com faturamento de ${formatCurrency(
          analysis.monthlyRevenue
        )} no ciclo recente e ticket médio de ${formatCurrency(analysis.averageTicket)}.`
      : "Pelo que eu vi, ainda temos pouco histórico de receita para uma estratégia agressiva, mas já dá para agir com método.";

  const mainThesis =
    analysis.averageTicket > 0
      ? "O caminho mais rápido agora não é só trabalhar mais: é subir ticket médio e recorrência com oferta certa."
      : "O primeiro passo é estabilizar entrada recorrente e transformar atendimento pontual em retorno.";

  const bottleneckText =
    bottlenecks.length > 0
      ? `Travamentos principais: ${bottlenecks.map((item) => item.title).join(", ")}.`
      : "Seu cenário está relativamente saudável; foco em aceleração com disciplina comercial.";

  const opportunitiesText =
    opportunities.length > 0
      ? `Oportunidades imediatas: ${opportunities.map((item) => item.title).join(" | ")}.`
      : "Sem oportunidade óbvia única; vamos combinar preço, recorrência e agenda inteligente.";

  const message = `${opener}\n\n${mainThesis}\n${bottleneckText}\n${opportunitiesText}\n\nAjuste de preço: ${priceSuggestion}\nUpsell: ${upsellSuggestion}\nReativação: ${reactivationSuggestion}\nMarketing: ${marketingSuggestion}\n\nPlano prático\nCurto prazo (7 dias):\n- ${roadmap.shortTerm.join("\n- ")}\n\nMédio prazo (30 dias):\n- ${roadmap.mediumTerm.join("\n- ")}\n\nLongo prazo (90 dias):\n- ${roadmap.longTerm.join("\n- ")}\n\nResumo estratégico: crescimento real vem de três alavancas juntas: ticket médio, recorrência e margem. Se você executar esse plano com consistência, a tendência é ganhar faturamento com menos esforço por venda.`;

  return {
    matched: true,
    message,
    riskTone: tone,
    quickActions: [
      "Me dá o plano de 7 dias",
      "Como aumentar ticket médio?",
      "Como reativar clientes?",
      "Qual reajuste de preço testar?",
    ],
    cards: [
      { title: "Faturamento atual (30 dias)", description: formatCurrency(analysis.monthlyRevenue) },
      { title: "Ticket médio", description: formatCurrency(analysis.averageTicket) },
      { title: "Margem estimada", description: toPercent(analysis.marginPct) },
    ],
  };
}

