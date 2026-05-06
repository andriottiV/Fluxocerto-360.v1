import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  PauseCircle,
  Plus,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import RecurrenceConfirmDialog from "@/components/dashboard/shared/RecurrenceConfirmDialog";
import RecurrenceTodayCard from "@/components/dashboard/shared/RecurrenceTodayCard";
import {
  addAccountCategory,
  findCategoryByNormalizedName,
  getVisibleAccountCategories,
  normalizeCategoryName,
  subscribeAccountCategories,
  type AccountCategory,
  type AccountCategoryKind,
} from "@/lib/accountCategories";
import {
  addRecurrence,
  getNextRecurrenceDate,
  getRecurrenceStatusLabel,
  ignoreRecurrence,
  isRecurrenceDueToday,
  readRecurrences,
  recurrencePeriodKey,
  subscribeRecurrences,
  updateRecurrence,
  type Recurrence,
  type RecurrenceStatus,
} from "@/lib/recurrences";
import { PaymentMethod, PotType, TransactionType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type RecurrenceFormState = {
  name: string;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  amount: string;
  dayOfMonth: string;
  potType: PotType;
  category: string;
  paymentMethod: PaymentMethod;
  status: RecurrenceStatus;
  customCategoryName: string;
  saveCustomCategory: boolean;
};

const SUGGESTIONS = [
  "Aluguel todo dia 08",
  "Internet todo dia 20",
  "Assinatura mensal",
  "Mensalidade de cliente",
  "Salario fixo",
];

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Debito" },
  { value: "credito", label: "Credito" },
  { value: "transferencia", label: "Transferencia" },
  { value: "voucher", label: "Voucher" },
  { value: "alimentacao", label: "Alimentacao" },
];

const POT_OPTIONS = [
  { value: PotType.PERSONAL, label: "PF" },
  { value: PotType.BUSINESS, label: "PJ" },
  { value: PotType.RESERVE, label: "Reserva" },
];

const INITIAL_FORM: RecurrenceFormState = {
  name: "",
  type: TransactionType.EXPENSE,
  amount: "",
  dayOfMonth: "8",
  potType: PotType.PERSONAL,
  category: "Moradia",
  paymentMethod: "pix",
  status: "active",
  customCategoryName: "",
  saveCustomCategory: false,
};

function parseMoney(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function clampDay(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(31, Math.round(parsed)));
}

function potLabel(type: PotType) {
  return POT_OPTIONS.find((item) => item.value === type)?.label ?? "PF";
}

function getStatusClass(recurrence: Recurrence) {
  if (recurrence.status === "paused") return "paused";
  if (isRecurrenceDueToday(recurrence)) return "today";
  if (recurrence.ignoredPeriods?.includes(recurrencePeriodKey())) return "ignored";
  return "next";
}

function getStatusLabel(recurrence: Recurrence) {
  if (recurrence.ignoredPeriods?.includes(recurrencePeriodKey())) return "Ignorada";
  return getRecurrenceStatusLabel(recurrence);
}

function categoryKindFromRecurrenceType(type: TransactionType.INCOME | TransactionType.EXPENSE): AccountCategoryKind {
  return type === TransactionType.INCOME ? "recorrente" : "fixa";
}

export default function RecorrenciasModule() {
  const { user, adjustmentAccounts } = useApp();
  const [recurrences, setRecurrences] = useState<Recurrence[]>(() => readRecurrences(user?.id));
  const [categories, setCategories] = useState<AccountCategory[]>(() =>
    getVisibleAccountCategories(user?.id, adjustmentAccounts)
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<RecurrenceFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<Recurrence | null>(null);
  const [selected, setSelected] = useState<Recurrence | null>(null);
  const [dialogEditing, setDialogEditing] = useState(false);

  useEffect(() => {
    const refresh = () => setRecurrences(readRecurrences(user?.id));
    refresh();
    return subscribeRecurrences(refresh);
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => setCategories(getVisibleAccountCategories(user?.id, adjustmentAccounts));
    refresh();
    return subscribeAccountCategories(refresh);
  }, [adjustmentAccounts, user?.id]);

  const activeCount = useMemo(
    () => recurrences.filter((item) => item.status === "active").length,
    [recurrences]
  );
  const todayCount = useMemo(
    () => recurrences.filter((item) => isRecurrenceDueToday(item)).length,
    [recurrences]
  );

  const applyCategory = (categoryName: string) => {
    if (categoryName === "__custom") {
      setForm((prev) => ({ ...prev, category: categoryName, saveCustomCategory: true }));
      return;
    }

    const category = findCategoryByNormalizedName(categories, categoryName);
    setForm((prev) => ({
      ...prev,
      category: categoryName,
      type: category?.nature ?? prev.type,
      potType: category?.potType ?? prev.potType,
      saveCustomCategory: false,
      customCategoryName: "",
    }));
  };

  const buildRecurrenceInput = () => {
    const amount = parseMoney(form.amount);
    const name = form.name.trim();
    const categoryName =
      form.category === "__custom" ? form.customCategoryName.trim() : form.category.trim();

    if (!name) {
      return { ok: false as const, error: "Informe um nome curto para a recorrencia." };
    }
    if (amount <= 0) {
      return { ok: false as const, error: "Informe um valor maior que zero." };
    }
    if (!categoryName) {
      return { ok: false as const, error: "Informe ou escolha uma categoria." };
    }

    const existingCategory = findCategoryByNormalizedName(categories, categoryName);
    const resolvedCategory = existingCategory?.name ?? categoryName;
    const resolvedPot = existingCategory?.potType ?? form.potType;
    const resolvedType = existingCategory?.nature ?? form.type;

    return {
      ok: true as const,
      categoryName,
      existingCategory,
      input: {
        ownerId: user?.id,
        name,
        type: resolvedType,
        amount,
        frequency: "monthly" as const,
        dayOfMonth: clampDay(form.dayOfMonth),
        potType: resolvedPot,
        category: resolvedCategory,
        paymentMethod: form.paymentMethod,
        status: form.status,
      },
    };
  };

  const persistRecurrence = (skipDuplicateCheck = false) => {
    setFormError(null);
    setDuplicateCandidate(null);

    const built = buildRecurrenceInput();
    if (!built.ok) {
      setFormError(built.error);
      return;
    }

    const duplicate = recurrences.find(
      (item) =>
        normalizeCategoryName(item.name) === normalizeCategoryName(built.input.name) &&
        item.amount === built.input.amount &&
        item.dayOfMonth === built.input.dayOfMonth &&
        item.potType === built.input.potType
    );
    if (duplicate && !skipDuplicateCheck) {
      setDuplicateCandidate(duplicate);
      setFormError("Parece que isso ja existe. Deseja reutilizar ou criar mesmo assim?");
      return;
    }

    if (form.category === "__custom" && form.saveCustomCategory && !built.existingCategory) {
      addAccountCategory(user?.id, {
        ownerId: user?.id,
        name: built.categoryName,
        kind: categoryKindFromRecurrenceType(built.input.type),
        nature: built.input.type,
        potType: built.input.potType,
        source: "recurrences",
      });
      toast.success("Categoria salva em Contas / Tipos.");
    } else if (form.category === "__custom" && built.existingCategory) {
      toast.info("Categoria existente reutilizada.");
    }

    addRecurrence(user?.id, built.input);

    setForm(INITIAL_FORM);
    setIsFormOpen(false);
    toast.success("Recorrencia criada. Nada foi lancado automaticamente.");
  };

  const saveRecurrence = () => {
    persistRecurrence(false);
  };

  const toggleStatus = (recurrence: Recurrence) => {
    updateRecurrence(user?.id, {
      ...recurrence,
      status: recurrence.status === "paused" ? "active" : "paused",
    });
  };

  const ignore = (recurrence: Recurrence) => {
    ignoreRecurrence(user?.id, recurrence.id);
    setRecurrences(readRecurrences(user?.id));
  };

  const openConfirm = (recurrence: Recurrence, editing = false) => {
    setDialogEditing(editing);
    setSelected(recurrence);
  };

  return (
    <>
      <section className="fd-recurrence-page">
        <header className="fd-recurrence-hero">
          <div>
            <span className="fd-card-kicker">
              <CalendarClock className="h-4 w-4" />
              Recorrencias
            </span>
            <h2>Cadastre o que se repete. O app lembra e voce confirma.</h2>
            <p>O app te lembra. Voce decide se registra, edita ou ignora.</p>
          </div>
          <button type="button" className="fd-primary-btn" onClick={() => setIsFormOpen((prev) => !prev)}>
            <Plus className="h-4 w-4" />
            Nova recorrencia
          </button>
        </header>

        <RecurrenceTodayCard />

        <div className="fd-recurrence-summary">
          <article>
            <CheckCircle2 className="h-4 w-4" />
            <span>Ativas</span>
            <strong>{activeCount}</strong>
          </article>
          <article>
            <CalendarClock className="h-4 w-4" />
            <span>Vencem hoje</span>
            <strong>{todayCount}</strong>
          </article>
          <article>
            <WalletCards className="h-4 w-4" />
            <span>Nada e automatico</span>
            <strong>manual</strong>
          </article>
        </div>

        <section className="fd-recurrence-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <span key={suggestion}>{suggestion}</span>
          ))}
        </section>

        {isFormOpen ? (
          <section className="fd-recurrence-form fd-settings-v2-card">
            <div className="fd-recurrence-form-head">
              <div>
                <h3>Nova recorrencia</h3>
                <p>Escolha uma categoria de Contas / Tipos para sugerir pote e tipo.</p>
              </div>
            </div>
            <div className="fd-recurrence-form-grid">
              <label>
                Nome da recorrencia
                <input
                  className="fd-small-input"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Aluguel, Internet, Salario fixo"
                />
              </label>
              <label>
                Tipo
                <select
                  className="fd-small-input"
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value as TransactionType.INCOME | TransactionType.EXPENSE,
                    }))
                  }
                >
                  <option value={TransactionType.INCOME}>Entrada</option>
                  <option value={TransactionType.EXPENSE}>Saida</option>
                </select>
              </label>
              <label>
                Valor
                <input
                  className="fd-small-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="149.90"
                />
              </label>
              <label>
                Frequencia
                <select className="fd-small-input" value="monthly" disabled>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
              <label>
                Dia do mes
                <input
                  className="fd-small-input"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dayOfMonth}
                  onChange={(event) => setForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
                />
              </label>
              <label>
                Pote sugerido
                <select
                  className="fd-small-input"
                  value={form.potType}
                  onChange={(event) => setForm((prev) => ({ ...prev, potType: event.target.value as PotType }))}
                >
                  {POT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select
                  className="fd-small-input"
                  value={form.category}
                  onChange={(event) => applyCategory(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__custom">Nova categoria...</option>
                </select>
              </label>
              {form.category === "__custom" ? (
                <label>
                  Nova categoria
                  <input
                    className="fd-small-input"
                    value={form.customCategoryName}
                    onChange={(event) => setForm((prev) => ({ ...prev, customCategoryName: event.target.value }))}
                    placeholder="Ex: Internet"
                  />
                </label>
              ) : null}
              <label>
                Forma
                <select
                  className="fd-small-input"
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, paymentMethod: event.target.value as PaymentMethod }))
                  }
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  className="fd-small-input"
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as RecurrenceStatus }))}
                >
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                </select>
              </label>
            </div>
            {form.category === "__custom" ? (
              <label className="fd-recurrence-save-category">
                <input
                  type="checkbox"
                  checked={form.saveCustomCategory}
                  onChange={(event) => setForm((prev) => ({ ...prev, saveCustomCategory: event.target.checked }))}
                />
                <span>Salvar tambem em Contas / Tipos</span>
              </label>
            ) : null}
            {formError ? <p className="fd-recurrence-error">{formError}</p> : null}
            {duplicateCandidate ? (
              <div className="fd-recurrence-duplicate-actions">
                <button
                  type="button"
                  className="fd-mini-btn"
                  onClick={() => {
                    setDuplicateCandidate(null);
                    setFormError(null);
                    setIsFormOpen(false);
                  }}
                >
                  Reutilizar existente
                </button>
                <button type="button" className="fd-ghost-btn" onClick={() => persistRecurrence(true)}>
                  Criar mesmo assim
                </button>
                <button
                  type="button"
                  className="fd-mini-btn"
                  onClick={() => {
                    setDuplicateCandidate(null);
                    setFormError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : null}
            <div className="fd-recurrence-form-actions">
              <button type="button" className="fd-ghost-btn" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="fd-primary-btn" onClick={saveRecurrence}>
                Salvar recorrencia
              </button>
            </div>
          </section>
        ) : null}

        <section className="fd-recurrence-list">
          {recurrences.length === 0 ? (
            <article className="fd-recurrence-empty fd-settings-v2-card">
              <CalendarClock className="h-8 w-8" />
              <h3>Voce ainda nao cadastrou recorrencias.</h3>
              <p>Comece por contas ou recebimentos que se repetem todo mes.</p>
              <button type="button" className="fd-primary-btn" onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Nova recorrencia
              </button>
            </article>
          ) : (
            recurrences.map((recurrence) => {
              const nextDate = getNextRecurrenceDate(recurrence);
              const statusClass = getStatusClass(recurrence);
              return (
                <article key={recurrence.id} className="fd-recurrence-row fd-settings-v2-card">
                  <div className="fd-recurrence-row-main">
                    <span className={`fd-recurrence-status ${statusClass}`}>
                      {getStatusLabel(recurrence)}
                    </span>
                    <h3>{recurrence.name}</h3>
                    <p>
                      {recurrence.type === TransactionType.INCOME ? "Entrada" : "Saida"} mensal no pote{" "}
                      {potLabel(recurrence.potType)}.
                    </p>
                  </div>
                  <div className="fd-recurrence-row-meta">
                    <strong>{formatCurrency(recurrence.amount)}</strong>
                    <span>Dia {String(recurrence.dayOfMonth).padStart(2, "0")}</span>
                    <small>Proxima: {formatDate(nextDate)}</small>
                  </div>
                  <div className="fd-recurrence-row-actions">
                    {isRecurrenceDueToday(recurrence) ? (
                      <>
                        <button type="button" className="fd-primary-btn" onClick={() => openConfirm(recurrence)}>
                          Confirmar
                        </button>
                        <button type="button" className="fd-ghost-btn" onClick={() => openConfirm(recurrence, true)}>
                          Editar
                        </button>
                        <button type="button" className="fd-mini-btn" onClick={() => ignore(recurrence)}>
                          Ignorar
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="fd-mini-btn" onClick={() => toggleStatus(recurrence)}>
                      {recurrence.status === "paused" ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <PauseCircle className="h-3.5 w-3.5" />
                      )}
                      {recurrence.status === "paused" ? "Ativar" : "Pausar"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>

      <RecurrenceConfirmDialog
        recurrence={selected}
        initialEditing={dialogEditing}
        onClose={() => setSelected(null)}
        onDone={() => setRecurrences(readRecurrences(user?.id))}
      />
    </>
  );
}
