import { useMemo, useState } from "react";
import { MessageCircle, Search, UsersRound } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import {
  calculateClientAverageTicket,
  calculateClientTotalRevenue,
  classifyClientEngagement,
  formatCurrencyBRL,
  formatRelativeDays,
  generateClientBillingAlerts,
  generateClientRetentionAlerts,
  generateWhatsAppMessage,
  getClientFinancialHistory,
  getClientPendingPayments,
  type ClientEngagementLevel,
  type ClientFollowUpAlert,
} from "@/lib/clientCRM";
import { formatDate, formatPhone } from "@/lib/utils";

type FilterKey = "todos" | "vip" | "fiel" | "recorrente" | "novo" | "inativo" | "pendentes";

type ClientCRMRow = {
  id: string;
  name: string;
  phone: string;
  level: ClientEngagementLevel;
  status: "ativo" | "inativo";
  totalRevenue: number;
  averageTicket: number;
  attendances: number;
  lastVisitDate: string | null;
  daysSinceLastVisit: number | null;
  averageFrequencyDays: number | null;
  nextReturnForecastDate: string | null;
  pendingSummary: ReturnType<typeof getClientPendingPayments>;
  history: ReturnType<typeof getClientFinancialHistory>;
};

const LEVEL_LABELS: Record<ClientEngagementLevel, string> = {
  vip: "VIP",
  fiel: "Fiel",
  recorrente: "Recorrente",
  novo: "Novo",
  inativo: "Inativo",
};

const FILTER_LABELS: Array<{ id: FilterKey; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "vip", label: "VIP" },
  { id: "fiel", label: "Fiel" },
  { id: "recorrente", label: "Recorrente" },
  { id: "novo", label: "Novo" },
  { id: "inativo", label: "Inativo" },
  { id: "pendentes", label: "Pendentes" },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince(dateIso: string | null) {
  const date = parseDate(dateIso);
  if (!date) return null;
  const now = new Date();
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function averageIntervalInDays(historyDates: string[]) {
  if (historyDates.length < 2) return null;
  const sorted = historyDates
    .map((date) => parseDate(date))
    .filter((item): item is Date => !!item)
    .sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length < 2) return null;
  const intervals: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const diff = Math.max(1, Math.floor((sorted[index].getTime() - sorted[index - 1].getTime()) / 86400000));
    intervals.push(diff);
  }
  if (intervals.length === 0) return null;
  return intervals.reduce((sum, item) => sum + item, 0) / intervals.length;
}

function buildNextForecast(lastVisitDate: string | null, avgInterval: number | null) {
  const base = parseDate(lastVisitDate);
  if (!base || !avgInterval || !Number.isFinite(avgInterval)) return null;
  const forecast = new Date(base);
  forecast.setDate(forecast.getDate() + Math.round(avgInterval));
  return forecast.toISOString().slice(0, 10);
}

export default function ClientesModule() {
  const { clients, transactions } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todos");
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [generatedMessages, setGeneratedMessages] = useState<Record<string, string>>({});

  const rows = useMemo<ClientCRMRow[]>(() => {
    return clients.map((client) => {
      const history = getClientFinancialHistory(client, transactions);
      const totalRevenue = calculateClientTotalRevenue(history, client.totalSpent);
      const averageTicket = calculateClientAverageTicket(history, client.totalSpent);
      const attendances = history.length;
      const lastVisitDate = history[0]?.date ?? null;
      const daysSinceLastVisit = daysSince(lastVisitDate);
      const averageFrequencyDays = averageIntervalInDays(history.map((item) => item.date));
      const pendingSummary = getClientPendingPayments(history);
      const level = classifyClientEngagement({
        totalRevenue,
        attendances,
        daysSinceLastVisit,
        averageFrequencyDays,
        pendingSummary,
      });
      const nextReturnForecastDate = buildNextForecast(lastVisitDate, averageFrequencyDays);

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        status: client.status,
        level,
        totalRevenue,
        averageTicket,
        attendances,
        lastVisitDate,
        daysSinceLastVisit,
        averageFrequencyDays,
        nextReturnForecastDate,
        pendingSummary,
        history,
      };
    });
  }, [clients, transactions]);

  const selectedClient = useMemo(
    () => rows.find((item) => item.id === selectedClientId) ?? rows[0] ?? null,
    [rows, selectedClientId]
  );

  const filteredRows = useMemo(() => {
    const needle = normalizeText(search);
    return rows
      .filter((row) => {
        if (!needle) return true;
        return normalizeText(`${row.name} ${row.phone}`).includes(needle);
      })
      .filter((row) => {
        if (activeFilter === "todos") return true;
        if (activeFilter === "pendentes") return row.pendingSummary.totalPending > 0;
        return row.level === activeFilter;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue || a.name.localeCompare(b.name));
  }, [rows, search, activeFilter]);

  const retentionAlerts = useMemo(
    () =>
      generateClientRetentionAlerts(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          level: row.level,
          daysSinceLastVisit: row.daysSinceLastVisit,
          attendances: row.attendances,
        }))
      ),
    [rows]
  );

  const billingAlerts = useMemo(
    () =>
      generateClientBillingAlerts(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          pendingSummary: row.pendingSummary,
        }))
      ),
    [rows]
  );

  const followUpAlerts = useMemo(
    () =>
      [...retentionAlerts, ...billingAlerts].sort((a, b) => {
        const rank = { critical: 0, warning: 1, info: 2 } as const;
        return rank[a.severity] - rank[b.severity];
      }),
    [retentionAlerts, billingAlerts]
  );

  const crmInsights = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthTop5 = rows
      .map((row) => {
        const monthRevenue = row.history
          .filter((item) => item.date.slice(0, 7) === monthKey && item.paymentStatus !== "cancelado")
          .reduce((sum, item) => sum + item.amount, 0);
        return { ...row, monthRevenue };
      })
      .sort((a, b) => b.monthRevenue - a.monthRevenue)
      .slice(0, 5);
    const top5Revenue = monthTop5.reduce((sum, row) => sum + row.monthRevenue, 0);
    const loyalNoReturn = rows.filter((row) => row.level === "fiel" && (row.daysSinceLastVisit ?? 0) > 60).length;
    const pendingTotal = rows.reduce((sum, row) => sum + row.pendingSummary.totalPending, 0);
    const recurringRevenue = rows
      .filter((row) => row.level === "recorrente" || row.level === "fiel" || row.level === "vip")
      .reduce((sum, row) => sum + row.totalRevenue, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
    const recurringShare = totalRevenue > 0 ? (recurringRevenue / totalRevenue) * 100 : 0;

    const insights: string[] = [];
    if (top5Revenue > 0) {
      insights.push(`Seus 5 melhores clientes geraram ${formatCurrencyBRL(top5Revenue)} este mês.`);
    }
    if (loyalNoReturn > 0) {
      insights.push(`Você tem ${loyalNoReturn} clientes fiéis sem retorno há mais de 60 dias.`);
    }
    if (pendingTotal > 0) {
      insights.push(`Há ${formatCurrencyBRL(pendingTotal)} em pagamentos pendentes.`);
    }
    if (totalRevenue > 0) {
      insights.push(`Clientes recorrentes representam ${recurringShare.toFixed(0)}% do faturamento.`);
    }
    return insights;
  }, [rows]);

  const unlinkedIncomeRows = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "entrada")
        .filter((tx) => !tx.clientId && !tx.clientName)
        .slice(0, 8),
    [transactions]
  );

  const handleGenerateMessage = (alert: ClientFollowUpAlert) => {
    setGeneratedMessages((prev) => ({
      ...prev,
      [alert.id]: generateWhatsAppMessage(alert),
    }));
  };

  if (clients.length === 0) {
    return (
      <section className="fd-panel fd-glass fd-clients-panel">
        <header className="fd-clients-head">
          <h2>Clientes</h2>
          <p>CRM financeiro simples e estratégico para o seu negócio.</p>
        </header>
        <div className="fd-empty-state-card">
          <p>Cadastre clientes ou vincule entradas a clientes para acompanhar seu faturamento por pessoa.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="fd-panel fd-glass fd-clients-panel fd-clients-crm">
      <header className="fd-clients-head">
        <h2>Clientes</h2>
        <p>CRM financeiro para entender faturamento, pendências e retenção.</p>
      </header>

      {crmInsights.length > 0 ? (
        <div className="fd-clients-insights-row">
          {crmInsights.map((insight) => (
            <div key={insight} className="fd-insight-item">
              <span>Insight CRM</span>
              <strong>{insight}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="fd-empty-state-card">
          <p>Quando houver mais histórico de clientes, os insights estratégicos aparecerão aqui.</p>
        </div>
      )}

      <article className="fd-clients-tools">
        <div className="fd-clients-search">
          <Search className="h-4 w-4" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone"
          />
        </div>
        <div className="fd-clients-filters">
          {FILTER_LABELS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`fd-mini-btn ${activeFilter === filter.id ? "active" : ""}`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </article>

      <div className="fd-grid-two fd-clients-crm-grid">
        <article className="fd-clients-groups fd-clients-list-card">
          {filteredRows.length === 0 ? (
            <div className="fd-empty-state-card">
              <p>Nenhum cliente encontrado para esse filtro.</p>
            </div>
          ) : (
            filteredRows.map((row) => (
              <button
                type="button"
                key={row.id}
                className={`fd-client-item fd-client-select ${selectedClient?.id === row.id ? "active" : ""}`}
                onClick={() => setSelectedClientId(row.id)}
              >
                <div className="fd-client-main">
                  <p>{row.name}</p>
                  <small>{formatPhone(row.phone)}</small>
                </div>
                <div className="fd-client-meta">
                  <div className="fd-client-frequency">
                    <span>Total gerado</span>
                    <strong>{formatCurrencyBRL(row.totalRevenue)}</strong>
                  </div>
                  <span className={`fd-level-badge ${row.level}`}>{LEVEL_LABELS[row.level]}</span>
                </div>
              </button>
            ))
          )}
        </article>

        <article className="fd-clients-detail-card fd-panel fd-glass">
          {selectedClient ? (
            <>
              <div className="fd-panel-head">
                <h2>{selectedClient.name}</h2>
                <p>
                  {LEVEL_LABELS[selectedClient.level]} • Último atendimento {formatRelativeDays(selectedClient.daysSinceLastVisit)}
                </p>
              </div>

              <div className="fd-clients-kpi-grid">
                <div className="fd-insight-item">
                  <span>Total gerado</span>
                  <strong>{formatCurrencyBRL(selectedClient.totalRevenue)}</strong>
                </div>
                <div className="fd-insight-item">
                  <span>Ticket médio</span>
                  <strong>{formatCurrencyBRL(selectedClient.averageTicket)}</strong>
                </div>
                <div className="fd-insight-item">
                  <span>Atendimentos</span>
                  <strong>{selectedClient.attendances}</strong>
                </div>
                <div className="fd-insight-item">
                  <span>Última visita</span>
                  <strong>{selectedClient.lastVisitDate ? formatDate(selectedClient.lastVisitDate) : "Sem histórico"}</strong>
                </div>
                <div className="fd-insight-item">
                  <span>Previsão de retorno</span>
                  <strong>
                    {selectedClient.nextReturnForecastDate ? formatDate(selectedClient.nextReturnForecastDate) : "Sem previsão"}
                  </strong>
                </div>
                <div className="fd-insight-item">
                  <span>Pendências</span>
                  <strong>{formatCurrencyBRL(selectedClient.pendingSummary.totalPending)}</strong>
                </div>
              </div>

              <div className={`fd-clients-pending-banner ${selectedClient.pendingSummary.risk}`}>
                <p>{selectedClient.pendingSummary.message}</p>
                {selectedClient.pendingSummary.nearestDueDate ? (
                  <small>Vencimento mais próximo: {formatDate(selectedClient.pendingSummary.nearestDueDate)}</small>
                ) : null}
              </div>

              <div className="fd-subsection">
                <h3>Histórico financeiro</h3>
                {selectedClient.history.length === 0 ? (
                  <p className="fd-empty">Este cliente ainda não possui serviços vinculados.</p>
                ) : (
                  <div className="fd-clients-history-list">
                    {selectedClient.history.map((item) => (
                      <div key={item.id} className="fd-list-row fd-client-history-row">
                        <div>
                          <p>{item.serviceName || item.description}</p>
                          <small>
                            {formatDate(item.date)} • {item.description} • {item.paymentMethod ?? "Sem forma de pagamento"}
                          </small>
                          <small className="fd-client-link-status">
                            {item.linkedClient ? "Cliente vinculado" : "Sem cliente vinculado"}
                          </small>
                        </div>
                        <div className="fd-client-history-meta">
                          <strong>{formatCurrencyBRL(item.amount)}</strong>
                          <span className={`fd-level-badge ${item.paymentStatus === "pendente" ? "recorrente" : item.paymentStatus === "cancelado" ? "novo" : "fiel"}`}>
                            {item.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="fd-empty-state-card">
              <p>Selecione um cliente para abrir o detalhe financeiro.</p>
            </div>
          )}
        </article>
      </div>

      <article className="fd-panel fd-glass fd-clients-followup-card">
        <div className="fd-panel-head">
          <h2>Clientes para acompanhar</h2>
          <p>Prioridades de retenção e cobrança para agir no momento certo.</p>
        </div>

        {followUpAlerts.length === 0 ? (
          <div className="fd-empty-state-card">
            <p>Nenhum cliente precisa de atenção agora.</p>
          </div>
        ) : (
          <div className="fd-clients-followup-list">
            {followUpAlerts.map((alert) => (
              <div key={alert.id} className={`fd-clients-followup-item ${alert.severity}`}>
                <div>
                  <p>{alert.message}</p>
                </div>
                <div className="fd-clients-followup-actions">
                  <button type="button" className="fd-mini-btn" onClick={() => handleGenerateMessage(alert)}>
                    <MessageCircle className="h-4 w-4" />
                    Gerar mensagem
                  </button>
                </div>
                {generatedMessages[alert.id] ? (
                  <div className="fd-clients-whatsapp-message">
                    <small>Mensagem sugerida:</small>
                    <p>{generatedMessages[alert.id]}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>
            <UsersRound className="h-4 w-4" /> Entradas sem cliente vinculado
          </h2>
          <p>Use essa lista para organizar lançamentos antigos sem vínculo.</p>
        </div>
        {unlinkedIncomeRows.length === 0 ? (
          <p className="fd-empty">Nenhuma entrada sem cliente vinculado no momento.</p>
        ) : (
          <div className="fd-list">
            {unlinkedIncomeRows.map((tx) => (
              <div key={tx.id} className="fd-list-row">
                <div>
                  <p>{tx.description}</p>
                  <small>{formatDate(tx.date)} • Sem cliente vinculado</small>
                </div>
                <strong className="fd-positive">{formatCurrencyBRL(tx.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
