import { Client, PaymentMethod, Transaction, TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export type ClientEngagementLevel = "vip" | "fiel" | "recorrente" | "novo" | "inativo";

export type ClientHistoryItem = {
  id: string;
  date: string;
  serviceName: string;
  description: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: "pago" | "pendente" | "cancelado";
  paidAt?: string;
  dueDate?: string;
  notes?: string;
  linkedClient: boolean;
};

export type ClientPendingSummary = {
  totalPending: number;
  countPending: number;
  nearestDueDate: string | null;
  overdueDays: number;
  risk: "baixo" | "moderado" | "alto";
  message: string;
  items: ClientHistoryItem[];
};

export type ClientFollowUpAlert = {
  id: string;
  clientId: string;
  clientName: string;
  type: "retencao" | "cobranca";
  severity: "info" | "warning" | "critical";
  message: string;
  amount?: number;
  days?: number;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDateSafe(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferPaymentStatus(tx: Transaction): "pago" | "pendente" | "cancelado" {
  if (tx.paymentStatus) return tx.paymentStatus;
  const note = normalizeText(`${tx.notes ?? ""} ${tx.origin ?? ""} ${tx.description}`);
  if (note.includes("cancel")) return "cancelado";
  if (note.includes("pendente") || note.includes("a receber") || note.includes("aberto")) return "pendente";
  return "pago";
}

function daysBetween(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

export function formatCurrencyBRL(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0);
}

export function formatRelativeDays(days: number | null) {
  if (days === null || !Number.isFinite(days)) return "Sem histórico";
  if (days <= 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

export function getClientFinancialHistory(client: Client, transactions: Transaction[]) {
  const needle = normalizeText(client.name);

  const items: ClientHistoryItem[] = transactions
    .filter((tx) => tx.type === TransactionType.INCOME)
    .filter((tx) => {
      if (tx.clientId && tx.clientId === client.id) return true;
      if (tx.clientName && normalizeText(tx.clientName) === needle) return true;
      const haystack = normalizeText(`${tx.description} ${tx.origin ?? ""} ${tx.notes ?? ""}`);
      return haystack.includes(needle);
    })
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      serviceName: tx.serviceName || tx.category || "Serviço",
      description: tx.description || tx.serviceName || "Sem descrição",
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      paymentStatus: inferPaymentStatus(tx),
      paidAt: tx.paidAt,
      dueDate: tx.dueDate,
      notes: tx.notes,
      linkedClient: !!tx.clientId || !!tx.clientName,
    }))
    .sort((a, b) => (parseDateSafe(b.date)?.getTime() ?? 0) - (parseDateSafe(a.date)?.getTime() ?? 0));

  return items;
}

export function calculateClientTotalRevenue(history: ClientHistoryItem[], fallbackTotalSpent = 0) {
  const paidRevenue = history
    .filter((item) => item.paymentStatus !== "cancelado")
    .reduce((sum, item) => sum + item.amount, 0);
  return Math.max(fallbackTotalSpent, paidRevenue);
}

export function calculateClientAverageTicket(history: ClientHistoryItem[], fallbackTotalSpent = 0) {
  if (history.length === 0) return fallbackTotalSpent > 0 ? fallbackTotalSpent : 0;
  const total = calculateClientTotalRevenue(history, fallbackTotalSpent);
  return total / Math.max(1, history.length);
}

export function getClientPendingPayments(history: ClientHistoryItem[]): ClientPendingSummary {
  const now = new Date();
  const pendingItems = history.filter((item) => item.paymentStatus === "pendente");
  const totalPending = pendingItems.reduce((sum, item) => sum + item.amount, 0);

  let nearestDueDate: string | null = null;
  let overdueDays = 0;

  pendingItems.forEach((item) => {
    const due = parseDateSafe(item.dueDate ?? item.date);
    if (!due) return;
    if (!nearestDueDate || due < (parseDateSafe(nearestDueDate) ?? due)) {
      nearestDueDate = due.toISOString().slice(0, 10);
    }
    if (due < now) {
      overdueDays = Math.max(overdueDays, Math.abs(daysBetween(due, now)));
    }
  });

  const risk: ClientPendingSummary["risk"] =
    overdueDays > 7 || totalPending >= 300 ? "alto" : overdueDays > 0 || totalPending > 0 ? "moderado" : "baixo";

  const message =
    totalPending <= 0
      ? "Sem pendências financeiras."
      : overdueDays > 0
        ? `Pagamento vencido há ${overdueDays} dias.`
        : `Este cliente possui ${formatCurrencyBRL(totalPending)} pendentes.`;

  return {
    totalPending,
    countPending: pendingItems.length,
    nearestDueDate,
    overdueDays,
    risk,
    message,
    items: pendingItems,
  };
}

export function classifyClientEngagement(params: {
  totalRevenue: number;
  attendances: number;
  daysSinceLastVisit: number | null;
  averageFrequencyDays: number | null;
  pendingSummary: ClientPendingSummary;
}): ClientEngagementLevel {
  const { totalRevenue, attendances, daysSinceLastVisit, averageFrequencyDays, pendingSummary } = params;

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 90) return "inativo";
  if (attendances <= 1) return "novo";

  if ((totalRevenue >= 2000 || attendances >= 10) && (daysSinceLastVisit ?? 0) <= 45 && pendingSummary.totalPending < 250) {
    return "vip";
  }

  if ((attendances >= 5 || totalRevenue >= 1000) && (daysSinceLastVisit ?? 999) <= 60) {
    return "fiel";
  }

  if (attendances >= 2 || (averageFrequencyDays ?? 999) <= 60) {
    return "recorrente";
  }

  return "novo";
}

export function generateClientRetentionAlerts(
  rows: Array<{
    id: string;
    name: string;
    level: ClientEngagementLevel;
    daysSinceLastVisit: number | null;
    attendances: number;
  }>
) {
  const alerts: ClientFollowUpAlert[] = [];

  rows.forEach((row) => {
    const days = row.daysSinceLastVisit;
    if (days === null) return;

    if (row.level === "fiel" && days > 60) {
      alerts.push({
        id: `ret-fiel-${row.id}`,
        clientId: row.id,
        clientName: row.name,
        type: "retencao",
        severity: "warning",
        days,
        message: `${row.name} é um Cliente Fiel, mas não volta há ${days} dias. Vale chamar no WhatsApp.`,
      });
    } else if (row.level === "vip" && days > 45) {
      alerts.push({
        id: `ret-vip-${row.id}`,
        clientId: row.id,
        clientName: row.name,
        type: "retencao",
        severity: "warning",
        days,
        message: `${row.name} é Cliente VIP e está sem retorno há ${days} dias.`,
      });
    } else if (row.level === "recorrente" && days > 60) {
      alerts.push({
        id: `ret-rec-${row.id}`,
        clientId: row.id,
        clientName: row.name,
        type: "retencao",
        severity: "info",
        days,
        message: `${row.name} reduziu frequência e está há ${days} dias sem atendimento.`,
      });
    } else if (row.level === "novo" && days > 30 && row.attendances === 1) {
      alerts.push({
        id: `ret-novo-${row.id}`,
        clientId: row.id,
        clientName: row.name,
        type: "retencao",
        severity: "info",
        days,
        message: `${row.name} veio uma vez e não retornou. Uma mensagem simples pode reativar.`,
      });
    }
  });

  return alerts;
}

export function generateClientBillingAlerts(
  rows: Array<{
    id: string;
    name: string;
    pendingSummary: ClientPendingSummary;
  }>
) {
  const alerts: ClientFollowUpAlert[] = [];

  rows.forEach((row) => {
    if (row.pendingSummary.totalPending <= 0) return;
    alerts.push({
      id: `bill-${row.id}`,
      clientId: row.id,
      clientName: row.name,
      type: "cobranca",
      severity: row.pendingSummary.overdueDays > 0 ? "critical" : "warning",
      amount: row.pendingSummary.totalPending,
      days: row.pendingSummary.overdueDays,
      message:
        row.pendingSummary.overdueDays > 0
          ? `${row.name} tem ${formatCurrencyBRL(row.pendingSummary.totalPending)} pendentes e vencimento em atraso.`
          : `${row.name} tem ${formatCurrencyBRL(row.pendingSummary.totalPending)} pendentes. Considere enviar uma cobrança educada.`,
    });
  });

  return alerts;
}

export function generateWhatsAppMessage(alert: ClientFollowUpAlert) {
  if (alert.type === "cobranca") {
    return `Oi, ${alert.clientName}! Tudo bem? Passando para lembrar do pagamento pendente de ${formatCurrencyBRL(
      alert.amount ?? 0
    )}. Se puder me confirmar quando fizer, agradeço.`;
  }
  return `Fala, ${alert.clientName}! Tudo bem? Notei que faz um tempinho desde seu último atendimento. Se quiser, posso te passar alguns horários dessa semana.`;
}
