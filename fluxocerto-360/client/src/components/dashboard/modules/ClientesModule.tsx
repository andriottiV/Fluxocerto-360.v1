import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

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
type FunnelStage = "novo" | "proposta" | "falar" | "fechado";

type ClientCRMRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastService?: string;
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

const FUNNEL_COLUMNS: Array<{ id: FunnelStage; title: string; helper: string }> = [
  { id: "novo", title: "Novo contato", helper: "Chegou agora" },
  { id: "proposta", title: "Proposta enviada", helper: "Tem valor para receber" },
  { id: "falar", title: "Falar depois", helper: "Precisa de resposta" },
  { id: "fechado", title: "Fechado", helper: "Ja virou dinheiro" },
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

function isTodayOrPast(dateIso: string | null) {
  const date = parseDate(dateIso);
  if (!date) return false;
  const today = new Date();
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return a <= b;
}

function stageForClient(row: ClientCRMRow, alertIds: Set<string>): FunnelStage {
  if (row.pendingSummary.totalPending > 0) return "proposta";
  if (row.status === "inativo" || alertIds.has(row.id) || isTodayOrPast(row.nextReturnForecastDate)) return "falar";
  if (row.totalRevenue > 0 || row.attendances > 0) return "fechado";
  return "novo";
}

function sourceForClient(row: ClientCRMRow) {
  if (row.history.some((item) => normalizeText(item.description).includes("instagram"))) return "Instagram";
  if (row.history.some((item) => normalizeText(item.description).includes("indic"))) return "Indicação";
  if (row.lastService) return row.lastService;
  return "Origem não informada";
}

function nextStepForClient(row: ClientCRMRow, stage: FunnelStage) {
  if (row.pendingSummary.totalPending > 0) return "Cobrar pagamento";
  if (stage === "falar") return "Chamar hoje";
  if (stage === "fechado") return "Falar com ele em 30 dias";
  return "Sem próximo passo";
}

function ClientCard({
  row,
  stage,
  active,
  onSelect,
}: {
  row: ClientCRMRow;
  stage: FunnelStage;
  active: boolean;
  onSelect: () => void;
}) {
  const nextStep = nextStepForClient(row, stage);
  const noNextStep = nextStep === "Sem próximo passo";

  return (
    <button type="button" draggable className={`fd-crm-card ${active ? "active" : ""}`} onClick={onSelect}>
      <div className="fd-crm-card-top">
        <span>{row.name.charAt(0).toUpperCase()}</span>
        <div>
          <strong>{row.name}</strong>
          <small>{formatPhone(row.phone)}</small>
        </div>
      </div>
      <div className="fd-crm-card-money">
        <DollarSign className="h-4 w-4" />
        <span>{formatCurrencyBRL(row.totalRevenue)}</span>
      </div>
      <dl>
        <div>
          <dt>Origem</dt>
          <dd>{sourceForClient(row)}</dd>
        </div>
        <div>
          <dt>Último contato</dt>
          <dd>{formatRelativeDays(row.daysSinceLastVisit)}</dd>
        </div>
      </dl>
      <div className={noNextStep ? "fd-crm-next warning" : "fd-crm-next"}>
        {noNextStep ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <span>{nextStep}</span>
      </div>
    </button>
  );
}

export default function ClientesModule() {
  const { clients, transactions } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todos");
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [generatedMessages, setGeneratedMessages] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);

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
        email: client.email,
        phone: client.phone,
        lastService: client.lastService,
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

  const alertIds = useMemo(() => new Set(followUpAlerts.map((alert) => alert.clientId)), [followUpAlerts]);

  const filteredRows = useMemo(() => {
    const needle = normalizeText(search);
    return rows
      .filter((row) => {
        if (!needle) return true;
        return normalizeText(`${row.name} ${row.phone} ${row.email}`).includes(needle);
      })
      .filter((row) => {
        if (activeFilter === "todos") return true;
        if (activeFilter === "pendentes") return row.pendingSummary.totalPending > 0;
        return row.level === activeFilter;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue || a.name.localeCompare(b.name));
  }, [rows, search, activeFilter]);

  const selectedClient = useMemo(
    () => rows.find((item) => item.id === selectedClientId) ?? rows[0] ?? null,
    [rows, selectedClientId]
  );

  const funnel = useMemo(() => {
    const grouped: Record<FunnelStage, ClientCRMRow[]> = {
      novo: [],
      proposta: [],
      falar: [],
      fechado: [],
    };
    filteredRows.forEach((row) => {
      grouped[stageForClient(row, alertIds)].push(row);
    });
    return grouped;
  }, [alertIds, filteredRows]);

  const todayFocus = useMemo(() => {
    const byAlert = followUpAlerts
      .map((alert) => rows.find((row) => row.id === alert.clientId))
      .filter((row): row is ClientCRMRow => !!row);
    const byDate = rows.filter((row) => isTodayOrPast(row.nextReturnForecastDate));
    const unique = new Map<string, ClientCRMRow>();
    [...byAlert, ...byDate].forEach((row) => unique.set(row.id, row));
    return Array.from(unique.values()).slice(0, 4);
  }, [followUpAlerts, rows]);

  const handleGenerateMessage = (alert: ClientFollowUpAlert) => {
    setGeneratedMessages((prev) => ({
      ...prev,
      [alert.id]: generateWhatsAppMessage(alert),
    }));
  };

  return (
    <section className="fd-crm-page">
      <header className="fd-crm-header">
        <div>
          <span>Quem pode virar dinheiro</span>
          <h2>Clientes & Vendas</h2>
          <p>Veja quem pode virar dinheiro e o que fazer hoje.</p>
        </div>
        <button type="button" className="fd-crm-new-btn" onClick={() => searchRef.current?.focus()}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </header>

      {clients.length === 0 ? (
        <article className="fd-crm-empty fd-crm-panel">
          <UsersRound className="h-9 w-9" />
          <strong>Nenhum cliente ainda</strong>
          <p>Cadastre clientes ou vincule entradas a clientes para acompanhar quem compra de você.</p>
        </article>
      ) : (
        <>
          <section className="fd-crm-focus fd-crm-panel">
            <div className="fd-crm-section-head">
              <div>
                <h3>Hoje você precisa falar com:</h3>
                <p>Prioridade do dia, sem complicar.</p>
              </div>
              <Sparkles className="h-5 w-5" />
            </div>
            {todayFocus.length === 0 ? (
              <div className="fd-crm-done">
                <CheckCircle2 className="h-5 w-5" />
                <span>Nada pendente hoje 👍</span>
              </div>
            ) : (
              <div className="fd-crm-focus-list">
                {todayFocus.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedClientId(row.id)}>
                    <span>{row.name.charAt(0).toUpperCase()}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>{nextStepForClient(row, stageForClient(row, alertIds))}</small>
                    </div>
                    <em>{formatCurrencyBRL(row.totalRevenue)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <article className="fd-crm-tools fd-crm-panel">
            <div className="fd-crm-search">
              <Search className="h-4 w-4" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, telefone ou email"
              />
            </div>
            <div className="fd-crm-filters">
              {FILTER_LABELS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={activeFilter === filter.id ? "active" : ""}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </article>

          <section className="fd-crm-funnel" aria-label="Quem pode virar dinheiro">
            {FUNNEL_COLUMNS.map((column) => (
              <article key={column.id} className="fd-crm-column">
                <header>
                  <div>
                    <h3>{column.title}</h3>
                    <p>{column.helper}</p>
                  </div>
                  <span>{funnel[column.id].length}</span>
                </header>
                <div className="fd-crm-column-list">
                  {funnel[column.id].length === 0 ? (
                    <div className="fd-crm-column-empty">Sem clientes aqui</div>
                  ) : (
                    funnel[column.id].map((row) => (
                      <ClientCard
                        key={row.id}
                        row={row}
                        stage={column.id}
                        active={selectedClient?.id === row.id}
                        onSelect={() => setSelectedClientId(row.id)}
                      />
                    ))
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="fd-crm-detail-grid">
            <article className="fd-crm-panel fd-crm-detail">
              {selectedClient ? (
                <>
                  <div className="fd-crm-section-head">
                    <div>
                      <h3>{selectedClient.name}</h3>
                      <p>
                        {LEVEL_LABELS[selectedClient.level]} · Último contato {formatRelativeDays(selectedClient.daysSinceLastVisit)}
                      </p>
                    </div>
                    <span className={`fd-crm-level ${selectedClient.level}`}>{LEVEL_LABELS[selectedClient.level]}</span>
                  </div>

                  <div className="fd-crm-kpis">
                    <div>
                      <small>Valor estimado</small>
                      <strong>{formatCurrencyBRL(selectedClient.totalRevenue)}</strong>
                    </div>
                    <div>
                      <small>Ticket médio</small>
                      <strong>{formatCurrencyBRL(selectedClient.averageTicket)}</strong>
                    </div>
                    <div>
                      <small>Histórico</small>
                      <strong>{selectedClient.attendances}</strong>
                    </div>
                    <div>
                      <small>Pendências</small>
                      <strong>{formatCurrencyBRL(selectedClient.pendingSummary.totalPending)}</strong>
                    </div>
                  </div>

                  <div className="fd-crm-context">
                    <div>
                      <Clock3 className="h-4 w-4" />
                      <p>Próximo passo</p>
                      <strong>{nextStepForClient(selectedClient, stageForClient(selectedClient, alertIds))}</strong>
                    </div>
                    <div>
                      <CalendarClock className="h-4 w-4" />
                      <p>Pós-venda</p>
                      <strong>{stageForClient(selectedClient, alertIds) === "fechado" ? "Falar com ele em 30 dias" : "Ainda em aberto"}</strong>
                    </div>
                    <div>
                      <UserRound className="h-4 w-4" />
                      <p>Contexto rápido</p>
                      <strong>{selectedClient.lastService || "Sem observação salva"}</strong>
                    </div>
                  </div>

                  <div className={`fd-crm-pending ${selectedClient.pendingSummary.risk}`}>
                    <p>{selectedClient.pendingSummary.message}</p>
                    {selectedClient.pendingSummary.nearestDueDate ? (
                      <small>Vencimento mais próximo: {formatDate(selectedClient.pendingSummary.nearestDueDate)}</small>
                    ) : null}
                  </div>

                  <div className="fd-crm-history">
                    <h4>Histórico rápido</h4>
                    {selectedClient.history.length === 0 ? (
                      <p className="fd-crm-muted">Este cliente ainda não possui serviços vinculados.</p>
                    ) : (
                      selectedClient.history.slice(0, 6).map((item) => (
                        <div key={item.id}>
                          <span>{formatDate(item.date)}</span>
                          <p>{item.serviceName || item.description}</p>
                          <strong>{formatCurrencyBRL(item.amount)}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="fd-crm-muted">Selecione um cliente para ver o histórico.</p>
              )}
            </article>

            <article className="fd-crm-panel fd-crm-followup">
              <div className="fd-crm-section-head">
                <div>
                  <h3>Falar depois</h3>
                  <p>Mensagens prontas para não deixar dinheiro parado.</p>
                </div>
                <MessageCircle className="h-5 w-5" />
              </div>

              {followUpAlerts.length === 0 ? (
                <div className="fd-crm-done">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Nenhum cliente precisa de atenção agora.</span>
                </div>
              ) : (
                <div className="fd-crm-followup-list">
                  {followUpAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className={`fd-crm-followup-item ${alert.severity}`}>
                      <p>{alert.message}</p>
                      <button type="button" onClick={() => handleGenerateMessage(alert)}>
                        <MessageCircle className="h-4 w-4" />
                        Gerar mensagem
                      </button>
                      {generatedMessages[alert.id] ? <small>{generatedMessages[alert.id]}</small> : null}
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </section>
  );
}
