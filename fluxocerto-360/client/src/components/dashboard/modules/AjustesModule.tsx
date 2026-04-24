import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CreditCard, Plus, Settings2, Trash2, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { useApp } from "@/contexts/AppContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AdjustmentAccount,
  AdjustmentAccountCategory,
  AdjustmentAccountPot,
  AdjustmentAccountType,
  PaymentFeeSetting,
  PotDistribution,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type SettingsTab = "gerais" | "taxas" | "servicos" | "contas";

const TABS: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: "gerais", label: "Gerais", icon: <User className="h-4 w-4" /> },
  { id: "taxas", label: "Taxas de Pagamento", icon: <CreditCard className="h-4 w-4" /> },
  { id: "servicos", label: "Servicos", icon: <Wrench className="h-4 w-4" /> },
  { id: "contas", label: "Contas", icon: <Settings2 className="h-4 w-4" /> },
];

const ACCOUNT_CATEGORIES: AdjustmentAccountCategory[] = [
  "moradia",
  "internet",
  "transporte",
  "alimentacao",
  "saude",
  "lazer",
  "impostos",
  "ferramentas",
  "assinatura/app",
  "fornecedores",
  "cartao",
  "outros",
];

const POT_DISTRIBUTION_DEFAULT: PotDistribution = {
  personal: 50,
  business: 40,
  reserve: 10,
};

function dayDiffFromToday(iso: string) {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 999;
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

function mapPotLabel(pot: AdjustmentAccountPot) {
  return pot === "pf" ? "Dinheiro pessoal (PF)" : "Dinheiro do negocio (PJ)";
}

export default function AjustesModule() {
  const {
    user,
    setUser,
    services,
    addService,
    deleteService,
    paymentFeeSettings,
    setPaymentFeeSettings,
    potDistribution,
    setPotDistribution,
    adjustmentAccounts,
    addAdjustmentAccount,
    deleteAdjustmentAccount,
    payAdjustmentAccount,
    syncAdjustmentAccountsCycle,
    resetUserFinancialData,
  } = useApp();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<SettingsTab>("gerais");
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [serviceDraft, setServiceDraft] = useState({ name: "", price: "", duration: "" });
  const [potDistributionDraft, setPotDistributionDraft] = useState({
    personal: `${potDistribution.personal}`,
    business: `${potDistribution.business}`,
    reserve: `${potDistribution.reserve}`,
  });
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const [accountDraft, setAccountDraft] = useState({
    name: "",
    amount: "",
    category: "moradia" as AdjustmentAccountCategory,
    type: "fixa" as AdjustmentAccountType,
    dueDate: new Date().toISOString().slice(0, 10),
    pot: "pf" as AdjustmentAccountPot,
    installments: "2",
  });

  useEffect(() => {
    setNameDraft(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    setPotDistributionDraft({
      personal: `${potDistribution.personal}`,
      business: `${potDistribution.business}`,
      reserve: `${potDistribution.reserve}`,
    });
  }, [potDistribution.business, potDistribution.personal, potDistribution.reserve]);

  useEffect(() => {
    syncAdjustmentAccountsCycle();
  }, [syncAdjustmentAccountsCycle]);

  const groupedAccounts = useMemo(() => {
    const pf = adjustmentAccounts.filter((account) => account.pot === "pf");
    const pj = adjustmentAccounts.filter((account) => account.pot === "pj");
    return { pf, pj };
  }, [adjustmentAccounts]);

  const accountSummary = useMemo(() => {
    const pending = adjustmentAccounts.filter((item) => item.status !== "pago");
    const totalDebt = pending.reduce((sum, item) => sum + (item.totalDebt ?? item.amount), 0);
    const overdue = pending.filter((item) => dayDiffFromToday(item.dueDate) < 0).length;
    const dueSoon = pending.filter((item) => {
      const diff = dayDiffFromToday(item.dueDate);
      return diff >= 0 && diff <= 5;
    }).length;
    return { totalDebt, overdue, dueSoon };
  }, [adjustmentAccounts]);

  const potDistributionValidation = useMemo(() => {
    const fields = {
      personal: potDistributionDraft.personal.trim(),
      business: potDistributionDraft.business.trim(),
      reserve: potDistributionDraft.reserve.trim(),
    };
    const hasEmpty = Object.values(fields).some((value) => value === "");
    const values = {
      personal: Number(fields.personal),
      business: Number(fields.business),
      reserve: Number(fields.reserve),
    };

    const hasNegative = Object.values(values).some((value) => Number.isFinite(value) && value < 0);
    const hasInvalid = Object.values(values).some((value) => !Number.isFinite(value));
    const sum = Number((values.personal + values.business + values.reserve).toFixed(2));
    const diff = Number((100 - sum).toFixed(2));
    const canSave = !hasEmpty && !hasNegative && !hasInvalid && Math.abs(diff) <= 0.001;

    let message = "";
    if (hasEmpty) {
      message = "Preencha todos os campos de porcentagem.";
    } else if (hasNegative) {
      message = "Nao e permitido valor negativo.";
    } else if (hasInvalid) {
      message = "Use apenas numeros validos.";
    } else if (sum > 100) {
      message = "A soma dos potes não pode passar de 100%.";
    } else if (sum < 100) {
      message = `Ainda faltam ${diff}% para completar a distribuição.`;
    }

    return { canSave, message, sum, values };
  }, [potDistributionDraft.business, potDistributionDraft.personal, potDistributionDraft.reserve]);

  const updateFeeSetting = (method: PaymentFeeSetting["method"], changes: Partial<PaymentFeeSetting>) => {
    const next = paymentFeeSettings.map((setting) =>
      setting.method === method ? { ...setting, ...changes } : setting
    );
    setPaymentFeeSettings(next);
  };

  const handleSaveName = () => {
    if (!nameDraft.trim()) {
      toast.error("Nome nao pode ficar vazio");
      return;
    }
    if (!user) {
      toast.error("Usuario nao carregado");
      return;
    }

    setUser({ ...user, name: nameDraft.trim() });
    toast.success("Nome atualizado com sucesso");
  };

  const handleAddService = () => {
    const result = addService({
      name: serviceDraft.name,
      description: `Servico cadastrado em ajustes: ${serviceDraft.name || "sem descricao"}`,
      price: Number(serviceDraft.price),
      duration: Number(serviceDraft.duration),
      icon: "Servico",
      color: "custom",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Erro ao adicionar servico");
      return;
    }

    setServiceDraft({ name: "", price: "", duration: "" });
    toast.success("Servico adicionado");
  };

  const handleSavePotDistribution = () => {
    if (!potDistributionValidation.canSave) {
      toast.error(potDistributionValidation.message || "Distribuicao invalida");
      return;
    }

    setPotDistribution({
      personal: Number(potDistributionValidation.values.personal.toFixed(2)),
      business: Number(potDistributionValidation.values.business.toFixed(2)),
      reserve: Number(potDistributionValidation.values.reserve.toFixed(2)),
    });
    toast.success("Distribuição dos potes salva com sucesso.");
  };

  const handleRestorePotDistributionDefault = () => {
    setPotDistributionDraft({
      personal: `${POT_DISTRIBUTION_DEFAULT.personal}`,
      business: `${POT_DISTRIBUTION_DEFAULT.business}`,
      reserve: `${POT_DISTRIBUTION_DEFAULT.reserve}`,
    });
  };

  const handleConfirmReset = () => {
    if (resetConfirmText !== "RESETAR") {
      toast.error("Digite RESETAR para confirmar.");
      return;
    }

    const result = resetUserFinancialData();
    if (!result.ok) {
      toast.error(result.error ?? "Nao foi possivel resetar.");
      return;
    }

    setResetConfirmText("");
    setIsResetDialogOpen(false);
    toast.success("Suas informações foram resetadas com segurança.");
    setLocation("/dashboard");
  };

  const handleAddAccount = () => {
    const amount = Number(accountDraft.amount);
    if (!accountDraft.name.trim()) {
      toast.error("Nome da conta e obrigatorio");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Valor invalido");
      return;
    }
    if (!accountDraft.dueDate) {
      toast.error("Data de vencimento obrigatoria");
      return;
    }

    const installments =
      accountDraft.type === "variavel"
        ? Math.max(1, Number(accountDraft.installments) || 1)
        : undefined;

    const result = addAdjustmentAccount({
      name: accountDraft.name.trim(),
      amount,
      category: accountDraft.category,
      type: accountDraft.type,
      dueDate: accountDraft.dueDate,
      pot: accountDraft.pot,
      installmentsTotal: installments,
      installmentsRemaining: installments,
      totalDebt: installments ? amount * installments : undefined,
    });

    if (!result.ok) {
      toast.error(result.error ?? "Erro ao criar conta");
      return;
    }

    setAccountDraft({
      name: "",
      amount: "",
      category: "moradia",
      type: "fixa",
      dueDate: new Date().toISOString().slice(0, 10),
      pot: "pf",
      installments: "2",
    });
    toast.success("Conta adicionada");
  };

  const handlePayAccount = (account: AdjustmentAccount) => {
    const result = payAdjustmentAccount(account.id);
    if (!result.ok) {
      toast.error(result.error ?? "Nao foi possivel pagar");
      return;
    }

    if (result.borrowedFromOtherPot) {
      toast.warning("Atencao: saldo insuficiente no pote principal. Pagamento usando emprestimo do outro pote.");
    } else {
      toast.success("Conta paga com sucesso");
    }
  };

  return (
    <section className="fd-settings-v2">
      <header className="fd-settings-v2-head">
        <h2>Ajustes</h2>
        <p>Painel interno com configuracoes separadas por contexto</p>
      </header>

      <nav className="fd-settings-v2-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeTab === "gerais" && (
        <article className="fd-panel fd-glass fd-settings-v2-card">
          <div className="fd-panel-head">
            <h2>Gerais</h2>
            <p>Identidade do usuario</p>
          </div>

          <div className="fd-settings-small-card">
            <label>
              Nome do usuario
              <input
                className="fd-pot-input"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Seu nome"
              />
            </label>
            <button type="button" className="fd-primary-btn" onClick={handleSaveName}>
              Salvar nome
            </button>
          </div>

          <div className="fd-settings-small-card">
            <h3>Distribuição dos Potes</h3>
            <p>
              Defina como cada entrada será dividida automaticamente. O FluxoCerto sugere uma divisão inicial, mas
              você pode ajustar conforme sua realidade.
            </p>

            <div className="fd-settings-fees-list">
              <div className="fd-settings-fee-row enabled">
                <div>
                  <p>Pessoal</p>
                  <small>dinheiro para sua vida pessoal</small>
                </div>
                <div className="fd-inline-end">
                  <input
                    className="fd-pot-input fd-small-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={potDistributionDraft.personal}
                    onChange={(event) =>
                      setPotDistributionDraft((prev) => ({ ...prev, personal: event.target.value }))
                    }
                  />
                  <small>%</small>
                </div>
              </div>

              <div className="fd-settings-fee-row enabled">
                <div>
                  <p>Negócio</p>
                  <small>dinheiro para manter seu trabalho funcionando</small>
                </div>
                <div className="fd-inline-end">
                  <input
                    className="fd-pot-input fd-small-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={potDistributionDraft.business}
                    onChange={(event) =>
                      setPotDistributionDraft((prev) => ({ ...prev, business: event.target.value }))
                    }
                  />
                  <small>%</small>
                </div>
              </div>

              <div className="fd-settings-fee-row enabled">
                <div>
                  <p>Reserva</p>
                  <small>proteção para imprevistos</small>
                </div>
                <div className="fd-inline-end">
                  <input
                    className="fd-pot-input fd-small-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={potDistributionDraft.reserve}
                    onChange={(event) =>
                      setPotDistributionDraft((prev) => ({ ...prev, reserve: event.target.value }))
                    }
                  />
                  <small>%</small>
                </div>
              </div>
            </div>

            {potDistributionValidation.message ? (
              <div className="fd-settings-form-placeholder">{potDistributionValidation.message}</div>
            ) : (
              <div className="fd-settings-form-placeholder">Soma atual: {potDistributionValidation.sum}%</div>
            )}
            <div className="fd-settings-actions-row">
              <button
                type="button"
                className="fd-mini-btn fd-settings-action-btn"
                onClick={handleRestorePotDistributionDefault}
              >
                Restaurar sugestao inicial
              </button>
              <button
                type="button"
                className="fd-primary-btn fd-settings-action-btn"
                disabled={!potDistributionValidation.canSave}
                onClick={handleSavePotDistribution}
              >
                Salvar distribuicao
              </button>
            </div>
          </div>

          <div className="fd-settings-small-card fd-settings-safety-zone border border-rose-400/25 bg-rose-500/5">
            <h3>Zona de segurança</h3>
            <p>
              Use esta opção apenas se quiser recomeçar do zero. Sua conta continuará ativa, mas suas informações
              financeiras serão apagadas.
            </p>
            <div className="fd-settings-actions-row">
              <button
                type="button"
                className="fd-mini-btn fd-settings-action-btn fd-settings-reset-btn border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                onClick={() => {
                  setResetConfirmText("");
                  setIsResetDialogOpen(true);
                }}
              >
                Resetar minhas informações
              </button>
            </div>
          </div>
        </article>
      )}

      {activeTab === "taxas" && (
        <article className="fd-panel fd-glass fd-settings-v2-card">
          <div className="fd-panel-head">
            <h2>Taxas de Pagamento</h2>
            <p>Ative/desative meios e ajuste taxas em percentual</p>
          </div>

          <div className="fd-settings-fees-list">
            {paymentFeeSettings.map((fee) => (
              <div key={fee.method} className={`fd-settings-fee-row ${fee.enabled ? "enabled" : "disabled"}`}>
                <div>
                  <p>{fee.label}</p>
                  <small>{fee.enabled ? "Ativo" : "Desativado"}</small>
                </div>
                <label className="fd-settings-switch">
                  <input
                    type="checkbox"
                    checked={fee.enabled}
                    onChange={(event) => updateFeeSetting(fee.method, { enabled: event.target.checked })}
                  />
                  <span />
                </label>
                <div className="fd-inline-end">
                  <input
                    className="fd-pot-input fd-small-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={fee.feePercent}
                    onChange={(event) =>
                      updateFeeSetting(fee.method, { feePercent: Number(event.target.value) || 0 })
                    }
                  />
                  <small>%</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {activeTab === "servicos" && (
        <article className="fd-panel fd-glass fd-settings-v2-card">
          <div className="fd-panel-head">
            <h2>Servicos</h2>
            <p>Cadastro atual preservado</p>
          </div>

          <div className="fd-inline-form">
            <input
              className="fd-pot-input"
              placeholder="Nome do servico"
              value={serviceDraft.name}
              onChange={(event) => setServiceDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="fd-pot-input"
              placeholder="Valor"
              type="number"
              min={0}
              value={serviceDraft.price}
              onChange={(event) => setServiceDraft((prev) => ({ ...prev, price: event.target.value }))}
            />
            <input
              className="fd-pot-input"
              placeholder="Duracao (min)"
              type="number"
              min={1}
              value={serviceDraft.duration}
              onChange={(event) => setServiceDraft((prev) => ({ ...prev, duration: event.target.value }))}
            />
            <button className="fd-mini-btn" type="button" onClick={handleAddService}>
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="fd-list">
            {services.map((service) => (
              <div key={service.id} className="fd-list-row">
                <div>
                  <p>{service.name}</p>
                  <small>{service.duration} min</small>
                </div>
                <div className="fd-inline-end">
                  <strong>{formatCurrency(service.price)}</strong>
                  <button className="fd-mini-btn" type="button" onClick={() => deleteService(service.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {activeTab === "contas" && (
        <article className="fd-panel fd-glass fd-settings-v2-card">
          <div className="fd-panel-head">
            <h2>Contas</h2>
            <p>Controle PF/PJ com automacao de recorrencia e parcelas</p>
          </div>

          <div className="fd-settings-bills-summary">
            <div>
              <span>Divida total pendente</span>
              <strong>{formatCurrency(accountSummary.totalDebt)}</strong>
            </div>
            <div>
              <span>Atrasadas</span>
              <strong>{accountSummary.overdue}</strong>
            </div>
            <div>
              <span>Vencendo em breve</span>
              <strong>{accountSummary.dueSoon}</strong>
            </div>
          </div>

          <div className="fd-settings-bills-form">
            <input
              className="fd-pot-input"
              placeholder="Nome da conta"
              value={accountDraft.name}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="fd-pot-input"
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Valor"
              value={accountDraft.amount}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <select
              className="fd-pot-input"
              value={accountDraft.category}
              onChange={(event) =>
                setAccountDraft((prev) => ({ ...prev, category: event.target.value as AdjustmentAccountCategory }))
              }
            >
              {ACCOUNT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className="fd-pot-input"
              value={accountDraft.type}
              onChange={(event) =>
                setAccountDraft((prev) => ({ ...prev, type: event.target.value as AdjustmentAccountType }))
              }
            >
              <option value="fixa">Fixa</option>
              <option value="variavel">Variavel</option>
            </select>
            <input
              className="fd-pot-input"
              type="date"
              value={accountDraft.dueDate}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
            <select
              className="fd-pot-input"
              value={accountDraft.pot}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, pot: event.target.value as AdjustmentAccountPot }))}
            >
              <option value="pf">Dinheiro pessoal (PF)</option>
              <option value="pj">Dinheiro do negocio (PJ)</option>
            </select>
            {accountDraft.type === "variavel" ? (
              <input
                className="fd-pot-input"
                type="number"
                min={1}
                step={1}
                value={accountDraft.installments}
                onChange={(event) => setAccountDraft((prev) => ({ ...prev, installments: event.target.value }))}
                placeholder="Parcelas"
              />
            ) : (
              <div className="fd-settings-form-placeholder">Conta fixa recorrente mensal</div>
            )}
            <button className="fd-mini-btn" type="button" onClick={handleAddAccount}>
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="fd-settings-bills-columns">
            <div>
              <h3>PF</h3>
              <div className="fd-list">
                {groupedAccounts.pf.length === 0 ? (
                  <p className="fd-empty">Sem contas PF</p>
                ) : (
                  groupedAccounts.pf.map((account) => {
                    const diff = dayDiffFromToday(account.dueDate);
                    const nearDue = diff >= 0 && diff <= 5;
                    const overdue = diff < 0 && account.status !== "pago";
                    return (
                      <div key={account.id} className="fd-settings-bill-item">
                        <div className="fd-settings-bill-head">
                          <p>{account.name}</p>
                          <span className={`fd-settings-badge ${account.status}`}>{account.status}</span>
                        </div>
                        <small>
                          {account.category} â€¢ {mapPotLabel(account.pot)} â€¢ vence {account.dueDate}
                        </small>
                        <div className="fd-settings-bill-meta">
                          <span>{formatCurrency(account.amount)}</span>
                          <span className={`fd-settings-badge ${account.type}`}>{account.type}</span>
                          {account.type === "variavel" ? (
                            <span className="fd-settings-badge parcela">
                              {account.installmentsRemaining}/{account.installmentsTotal}
                            </span>
                          ) : (
                            <span className="fd-settings-badge parcela">recorrente</span>
                          )}
                          {nearDue ? <span className="fd-settings-badge aviso">vence em breve</span> : null}
                          {overdue ? <span className="fd-settings-badge alerta">atrasada</span> : null}
                        </div>
                        <div className="fd-inline-end">
                          <button className="fd-mini-btn" type="button" onClick={() => handlePayAccount(account)}>
                            Pagar (Saida)
                          </button>
                          <button className="fd-mini-btn" type="button" onClick={() => deleteAdjustmentAccount(account.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h3>PJ</h3>
              <div className="fd-list">
                {groupedAccounts.pj.length === 0 ? (
                  <p className="fd-empty">Sem contas PJ</p>
                ) : (
                  groupedAccounts.pj.map((account) => {
                    const diff = dayDiffFromToday(account.dueDate);
                    const nearDue = diff >= 0 && diff <= 5;
                    const overdue = diff < 0 && account.status !== "pago";
                    return (
                      <div key={account.id} className="fd-settings-bill-item">
                        <div className="fd-settings-bill-head">
                          <p>{account.name}</p>
                          <span className={`fd-settings-badge ${account.status}`}>{account.status}</span>
                        </div>
                        <small>
                          {account.category} â€¢ {mapPotLabel(account.pot)} â€¢ vence {account.dueDate}
                        </small>
                        <div className="fd-settings-bill-meta">
                          <span>{formatCurrency(account.amount)}</span>
                          <span className={`fd-settings-badge ${account.type}`}>{account.type}</span>
                          {account.type === "variavel" ? (
                            <span className="fd-settings-badge parcela">
                              {account.installmentsRemaining}/{account.installmentsTotal}
                            </span>
                          ) : (
                            <span className="fd-settings-badge parcela">recorrente</span>
                          )}
                          {nearDue ? <span className="fd-settings-badge aviso">vence em breve</span> : null}
                          {overdue ? <span className="fd-settings-badge alerta">atrasada</span> : null}
                        </div>
                        <div className="fd-inline-end">
                          <button className="fd-mini-btn" type="button" onClick={() => handlePayAccount(account)}>
                            Pagar (Saida)
                          </button>
                          <button className="fd-mini-btn" type="button" onClick={() => deleteAdjustmentAccount(account.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </article>
      )}

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tem certeza que deseja resetar suas informações?</DialogTitle>
            <DialogDescription>
              Essa ação apagará seus lançamentos, saldos, potes, clientes, itens/custos e configurações financeiras.
              Sua conta e seu acesso continuarão ativos.
            </DialogDescription>
          </DialogHeader>

          <label className="fd-reset-dialog-label grid gap-2 text-sm">
            Digite exatamente <strong>RESETAR</strong> para confirmar:
            <input
              className="fd-pot-input"
              value={resetConfirmText}
              onChange={(event) => setResetConfirmText(event.target.value)}
              placeholder="RESETAR"
            />
          </label>

          <DialogFooter className="fd-reset-dialog-footer">
            <button
              type="button"
              className="fd-mini-btn fd-reset-dialog-cancel"
              onClick={() => setIsResetDialogOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="fd-primary-btn fd-reset-dialog-confirm"
              disabled={resetConfirmText !== "RESETAR"}
              onClick={handleConfirmReset}
            >
              Confirmar reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}




