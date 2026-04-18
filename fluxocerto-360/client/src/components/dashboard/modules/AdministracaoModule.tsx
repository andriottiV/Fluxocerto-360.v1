import { useMemo, useState } from "react";
import { Shield, UserCheck, UserX } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { getConfiguredAdminEmails, listManagedUsers, updateUserStatus } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/authz";
import { User } from "@/lib/types";

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: User["role"]) {
  return role === "admin" ? "Admin" : "Tester";
}

function statusLabel(status: User["status"]) {
  if (status === "active") return "Ativo";
  if (status === "blocked") return "Bloqueado";
  return "Pendente";
}

export default function AdministracaoModule() {
  const { user } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");

  const users = useMemo(() => {
    if (!user) return [];
    return listManagedUsers(user);
  }, [user, refreshKey]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (item) => item.name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term)
    );
  }, [users, search]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((item) => item.role === "admin").length,
      pending: users.filter((item) => item.status === "pending").length,
      active: users.filter((item) => item.status === "active").length,
      blocked: users.filter((item) => item.status === "blocked").length,
    }),
    [users]
  );

  if (!canAccessAdmin(user)) {
    return (
      <section className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>Acesso negado</h2>
          <p>Somente administradores ativos podem acessar o painel de administração.</p>
        </div>
      </section>
    );
  }

  const handleStatusChange = (targetId: string, status: User["status"]) => {
    if (!user) return;
    const result = updateUserStatus(user, targetId, status);
    if (!result.ok) {
      window.alert(result.error ?? "Nao foi possivel atualizar o status.");
      return;
    }
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <section className="fd-admin-page">
      <article className="fd-panel fd-glass">
        <div className="fd-panel-head fd-admin-head">
          <div>
            <h2>Administracao</h2>
            <p>Controle de acesso do beta fechado com aprovacao manual de testadores.</p>
          </div>
        </div>
        <p className="text-xs text-[rgba(230,255,247,0.7)]">
          Admins autorizados por variavel de ambiente: {getConfiguredAdminEmails().join(", ")}
        </p>
      </article>

      <section className="fd-admin-stats-grid">
        <article className="fd-summary-v2-card">
          <p>Total de usuarios</p>
          <h3>{stats.total}</h3>
          <span>Base geral cadastrada</span>
        </article>
        <article className="fd-summary-v2-card">
          <p>Administradores</p>
          <h3>{stats.admins}</h3>
          <span>Com controle total</span>
        </article>
        <article className="fd-summary-v2-card">
          <p>Pendentes</p>
          <h3>{stats.pending}</h3>
          <span>Aguardando aprovacao</span>
        </article>
        <article className="fd-summary-v2-card success">
          <p>Ativos</p>
          <h3>{stats.active}</h3>
          <span>Com acesso liberado</span>
        </article>
        <article className="fd-summary-v2-card danger">
          <p>Bloqueados</p>
          <h3>{stats.blocked}</h3>
          <span>Acesso suspenso</span>
        </article>
      </section>

      <article className="fd-panel fd-glass">
        <div className="fd-admin-filters">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou email"
            className="fd-pot-input"
          />
        </div>
      </article>

      <article className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>Usuarios</h2>
          <p>{filteredUsers.length} usuario(s)</p>
        </div>

        <div className="fd-table-wrap">
          <table className="fd-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th>Ultimo acesso</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="fd-admin-cell-main">
                      <strong>{item.name}</strong>
                    </div>
                  </td>
                  <td>{item.email}</td>
                  <td>
                    <span className={`fd-admin-badge ${item.role === "admin" ? "role-admin" : "role-user"}`}>
                      <Shield className="h-3.5 w-3.5" /> {roleLabel(item.role)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`fd-admin-badge ${
                        item.status === "active"
                          ? "status-active"
                          : item.status === "blocked"
                            ? "status-blocked"
                            : "plan-demo"
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{formatDateTime(item.lastLoginAt)}</td>
                  <td>
                    <div className="fd-admin-actions">
                      <button
                        type="button"
                        className="fd-mini-btn"
                        onClick={() => handleStatusChange(item.id, "active")}
                        title="Aprovar/Reativar"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="fd-mini-btn"
                        onClick={() => handleStatusChange(item.id, "blocked")}
                        title="Bloquear"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
