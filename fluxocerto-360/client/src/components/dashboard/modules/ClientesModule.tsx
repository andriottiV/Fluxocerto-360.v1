import { useMemo } from "react";

import { useApp } from "@/contexts/AppContext";
import { TransactionType } from "@/lib/types";
import { formatPhone } from "@/lib/utils";

type ClientLevel = "novo" | "recorrente" | "fiel" | "vip";

type ClientWithFrequency = {
  id: string;
  name: string;
  phone: string;
  frequency: number;
  level: ClientLevel;
  status: "ativo" | "inativo";
};

const LEVEL_LABELS: Record<ClientLevel, string> = {
  novo: "Novo cliente",
  recorrente: "Cliente recorrente",
  fiel: "Cliente fiel",
  vip: "Cliente VIP",
};

const LEVEL_DESCRIPTIONS: Record<ClientLevel, string> = {
  novo: "1 atendimento",
  recorrente: "2 a 4 atendimentos",
  fiel: "5 a 9 atendimentos",
  vip: "10+ atendimentos",
};

function resolveClientLevel(frequency: number): ClientLevel {
  if (frequency >= 10) return "vip";
  if (frequency >= 5) return "fiel";
  if (frequency >= 2) return "recorrente";
  return "novo";
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function ClientesModule() {
  const { clients, transactions, services } = useApp();

  const averageServicePrice = useMemo(() => {
    if (services.length === 0) return 50;
    const total = services.reduce((sum, service) => sum + service.price, 0);
    return Math.max(1, total / services.length);
  }, [services]);

  const rows = useMemo<ClientWithFrequency[]>(() => {
    return clients.map((client) => {
      const nameNeedle = normalizeText(client.name);

      const directVisits = transactions.filter((tx) => {
        if (tx.type !== TransactionType.INCOME) return false;
        if (tx.clientId && tx.clientId === client.id) return true;
        if (tx.clientName && normalizeText(tx.clientName) === nameNeedle) return true;
        const haystack = normalizeText(`${tx.description} ${tx.origin ?? ""} ${tx.notes ?? ""}`);
        return haystack.includes(nameNeedle);
      }).length;

      const inferredVisits = client.totalSpent > 0 ? Math.max(1, Math.round(client.totalSpent / averageServicePrice)) : 1;
      const frequency = Math.max(directVisits, inferredVisits);
      const level = resolveClientLevel(frequency);

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        frequency,
        level,
        status: client.status,
      };
    });
  }, [clients, transactions, averageServicePrice]);

  const grouped = useMemo(() => {
    const initial: Record<ClientLevel, ClientWithFrequency[]> = {
      novo: [],
      recorrente: [],
      fiel: [],
      vip: [],
    };

    rows
      .slice()
      .sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name))
      .forEach((client) => {
        initial[client.level].push(client);
      });

    return initial;
  }, [rows]);

  const order: ClientLevel[] = ["vip", "fiel", "recorrente", "novo"];

  return (
    <section className="fd-panel fd-glass fd-clients-panel">
      <header className="fd-clients-head">
        <h2>Clientes</h2>
        <p>Nome, telefone e frequencia de atendimento com classificacao por nivel</p>
      </header>

      <div className="fd-clients-groups">
        {order.map((level) => {
          const list = grouped[level];

          return (
            <article key={level} className="fd-clients-group">
              <div className="fd-clients-group-head">
                <div>
                  <h3>{LEVEL_LABELS[level]}</h3>
                  <small>{LEVEL_DESCRIPTIONS[level]}</small>
                </div>
                <span className={`fd-level-pill ${level}`}>{list.length}</span>
              </div>

              <div className="fd-clients-list">
                {list.length === 0 ? (
                  <p className="fd-empty">Nenhum cliente neste nivel</p>
                ) : (
                  list.map((client) => (
                    <div key={client.id} className="fd-client-item">
                      <div className="fd-client-main">
                        <p>{client.name}</p>
                        <small>{formatPhone(client.phone)}</small>
                      </div>

                      <div className="fd-client-meta">
                        <div className="fd-client-frequency">
                          <span>Frequencia</span>
                          <strong>{client.frequency}x</strong>
                        </div>
                        <span className={`fd-level-badge ${client.level}`}>{LEVEL_LABELS[client.level]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
