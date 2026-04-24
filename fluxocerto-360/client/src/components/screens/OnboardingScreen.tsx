import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ScreenType, OnboardingDebtInput, OnboardingFinancialMode, OnboardingFixedExpenseInput, OnboardingUsageMode } from "@/lib/types";
import {
  getUserOnboardingData,
  isUserOnboardingCompleted,
  markUserOnboardingCompleted,
  saveUserOnboardingData,
} from "@/lib/auth";

type Step = 1 | 2 | 3 | 4;

const USAGE_OPTIONS: Array<{ value: OnboardingUsageMode; label: string }> = [
  { value: "personal", label: "Meu dinheiro pessoal" },
  { value: "business", label: "Meu negócio" },
  { value: "both", label: "Os dois juntos, mas sem misturar" },
];

const FINANCIAL_MODE_OPTIONS: Array<{ value: OnboardingFinancialMode; label: string }> = [
  { value: "chaos", label: "Estou no descontrole" },
  { value: "breakEven", label: "Empata: entra e sai quase tudo" },
  { value: "surplus", label: "Sobra um pouco" },
  { value: "growth", label: "Quero crescer mais" },
];

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Number(parsed.toFixed(2));
}

export default function OnboardingScreen() {
  const {
    goScreen,
    user,
    applyOnboardingUsageMode,
    applyOnboardingIncome,
    applyOnboardingFinancialMode,
    addOnboardingDebt,
    addOnboardingFixedExpense,
  } = useApp();

  const [step, setStep] = useState<Step>(1);
  const [usageMode, setUsageMode] = useState<OnboardingUsageMode | null>(null);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState("");
  const [financialMode, setFinancialMode] = useState<OnboardingFinancialMode | null>(null);

  const [debtName, setDebtName] = useState("");
  const [debtTotalInput, setDebtTotalInput] = useState("");
  const [debtMonthlyInput, setDebtMonthlyInput] = useState("");
  const [debts, setDebts] = useState<OnboardingDebtInput[]>([]);

  const [expenseName, setExpenseName] = useState("");
  const [expenseValueInput, setExpenseValueInput] = useState("");
  const [expenseDueDate, setExpenseDueDate] = useState("");
  const [fixedExpenses, setFixedExpenses] = useState<OnboardingFixedExpenseInput[]>([]);

  const [stepError, setStepError] = useState<string | null>(null);

  const persistAnswers = (partial: Parameters<typeof saveUserOnboardingData>[1]) => {
    if (!user?.id) return;
    saveUserOnboardingData(user.id, partial);
  };

  const goToStep = (nextStep: Step) => {
    setStep(nextStep);
    persistAnswers({ step: nextStep });
  };

  useEffect(() => {
    if (!user?.id) return;

    if (isUserOnboardingCompleted(user.id)) {
      goScreen(ScreenType.DASHBOARD);
      return;
    }

    const saved = getUserOnboardingData(user.id);

    if (saved.step) setStep(saved.step);
    if (saved.usageMode) setUsageMode(saved.usageMode);
    if (typeof saved.monthlyIncome === "number") setMonthlyIncomeInput(String(saved.monthlyIncome));
    if (saved.financialMode) setFinancialMode(saved.financialMode);
    if (saved.debts?.length) setDebts(saved.debts);
    if (saved.fixedExpenses?.length) setFixedExpenses(saved.fixedExpenses);
  }, [goScreen, user?.id]);

  function handleUsageModeSelect(nextUsageMode: OnboardingUsageMode) {
    setStepError(null);
    setUsageMode(nextUsageMode);
    persistAnswers({ usageMode: nextUsageMode, step });
    applyOnboardingUsageMode(nextUsageMode);
  }

  function handleIncomeSubmit() {
    setStepError(null);
    if (!usageMode) {
      setStepError("Selecione o tipo de uso para continuar.");
      return;
    }

    const monthlyIncome = parseCurrencyInput(monthlyIncomeInput);
    if (typeof monthlyIncome !== "number") {
      setStepError("Informe um valor válido para continuar.");
      return;
    }

    persistAnswers({ monthlyIncome, step: 3 });
    applyOnboardingIncome(usageMode, monthlyIncome);
    setStep(3);
  }

  function handleFinancialModeSelect(nextFinancialMode: OnboardingFinancialMode) {
    setStepError(null);
    setFinancialMode(nextFinancialMode);
    persistAnswers({ financialMode: nextFinancialMode, step });
    applyOnboardingFinancialMode(nextFinancialMode);
  }

  function handleDebtAdd() {
    setStepError(null);
    if (!usageMode) {
      setStepError("Selecione o tipo de uso antes de adicionar dívidas.");
      return;
    }

    const totalAmount = parseCurrencyInput(debtTotalInput);
    const monthlyPayment = parseCurrencyInput(debtMonthlyInput);
    if (!debtName.trim() || typeof totalAmount !== "number" || typeof monthlyPayment !== "number") {
      setStepError("Preencha nome, valor e parcela mensal da dívida.");
      return;
    }

    const debt: OnboardingDebtInput = {
      name: debtName.trim(),
      totalAmount,
      monthlyPayment,
    };

    const result = addOnboardingDebt(debt, usageMode);
    if (!result.ok) {
      setStepError(result.error ?? "Não foi possível adicionar a dívida.");
      return;
    }

    const nextDebts = [...debts, debt];
    setDebts(nextDebts);
    persistAnswers({ debts: nextDebts, step });

    setDebtName("");
    setDebtTotalInput("");
    setDebtMonthlyInput("");
  }

  function handleFixedExpenseAdd() {
    setStepError(null);
    if (!usageMode) {
      setStepError("Selecione o tipo de uso antes de adicionar despesas.");
      return;
    }

    const amount = parseCurrencyInput(expenseValueInput);
    if (!expenseName.trim() || typeof amount !== "number" || !expenseDueDate) {
      setStepError("Preencha nome, valor e vencimento da despesa fixa.");
      return;
    }

    const expense: OnboardingFixedExpenseInput = {
      name: expenseName.trim(),
      amount,
      dueDate: expenseDueDate,
    };

    const result = addOnboardingFixedExpense(expense, usageMode);
    if (!result.ok) {
      setStepError(result.error ?? "Não foi possível adicionar a despesa fixa.");
      return;
    }

    const nextFixedExpenses = [...fixedExpenses, expense];
    setFixedExpenses(nextFixedExpenses);
    persistAnswers({ fixedExpenses: nextFixedExpenses, step });

    setExpenseName("");
    setExpenseValueInput("");
    setExpenseDueDate("");
  }

  function finishOnboarding() {
    if (!user?.id) return;

    const safeUsageMode = usageMode ?? "both";
    applyOnboardingUsageMode(safeUsageMode);

    const monthlyIncome = parseCurrencyInput(monthlyIncomeInput);
    if (typeof monthlyIncome === "number") {
      applyOnboardingIncome(safeUsageMode, monthlyIncome);
    }

    if (financialMode) {
      applyOnboardingFinancialMode(financialMode);
    }

    persistAnswers({
      step: 4,
      usageMode: safeUsageMode,
      monthlyIncome,
      financialMode: financialMode ?? undefined,
      debts,
      fixedExpenses,
    });

    markUserOnboardingCompleted(user.id);
    goScreen(ScreenType.DASHBOARD);
  }

  const progress = useMemo(() => (step / 4) * 100, [step]);

  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          <h1 className="text-xl font-black tracking-[0.01em] text-[#f6fffb] sm:text-2xl">
            Vamos ajustar o FluxoCerto para sua realidade
          </h1>
          <p className="mt-3 text-sm font-semibold text-[rgba(230,255,247,0.88)] sm:text-base">
            O que você quer organizar primeiro?
          </p>

          <div className="mt-4 grid gap-3">
            {USAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleUsageModeSelect(option.value)}
                className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition sm:text-base ${
                  usageMode === option.value
                    ? "border-[rgba(25,245,193,0.52)] bg-[rgba(25,245,193,0.14)] text-[#f6fffb]"
                    : "border-[rgba(92,255,196,0.18)] bg-[rgba(8,23,20,0.58)] text-[rgba(230,255,247,0.88)] hover:bg-[rgba(10,31,26,0.72)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-[rgba(203,255,236,0.74)]">
            Não precisa ser perfeito agora. Você pode ajustar depois em Ajustes.
          </p>

          <div className="mt-6">
            <button
              type="button"
              disabled={!usageMode}
              onClick={() => goToStep(2)}
              className="h-12 w-full rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] text-sm font-bold text-[#03231a] shadow-[0_12px_30px_rgba(25,245,193,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Continuar
            </button>
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <h1 className="text-xl font-black tracking-[0.01em] text-[#f6fffb] sm:text-2xl">Quanto entra em média por mês?</h1>
          <p className="mt-3 text-sm font-semibold text-[rgba(230,255,247,0.88)] sm:text-base">
            Não precisa ser exato. Isso ajuda o Fluxo a começar mais inteligente.
          </p>

          <div className="mt-4 rounded-2xl border border-[rgba(92,255,196,0.18)] bg-[rgba(8,23,20,0.58)] p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[rgba(203,255,236,0.68)]">
              Valor estimado (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={monthlyIncomeInput}
              onChange={(event) => setMonthlyIncomeInput(event.target.value)}
              placeholder="Ex.: 8000"
              className="h-12 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-base text-[#f6fffb] outline-none transition placeholder:text-[rgba(203,255,236,0.50)] focus:border-[rgba(25,245,193,0.62)] focus:ring-2 focus:ring-[rgba(25,245,193,0.22)]"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleIncomeSubmit}
              className="h-12 w-full rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] text-sm font-bold text-[#03231a] shadow-[0_12px_30px_rgba(25,245,193,0.24)] transition hover:brightness-110"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="h-12 w-full rounded-2xl border border-[rgba(92,255,196,0.20)] bg-[rgba(8,23,20,0.58)] text-sm font-semibold text-[rgba(230,255,247,0.9)] transition hover:bg-[rgba(10,31,26,0.72)]"
            >
              Pular
            </button>
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <h1 className="text-xl font-black tracking-[0.01em] text-[#f6fffb] sm:text-2xl">Como está sua vida financeira hoje?</h1>

          <div className="mt-4 grid gap-3">
            {FINANCIAL_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFinancialModeSelect(option.value)}
                className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition sm:text-base ${
                  financialMode === option.value
                    ? "border-[rgba(25,245,193,0.52)] bg-[rgba(25,245,193,0.14)] text-[#f6fffb]"
                    : "border-[rgba(92,255,196,0.18)] bg-[rgba(8,23,20,0.58)] text-[rgba(230,255,247,0.88)] hover:bg-[rgba(10,31,26,0.72)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => goToStep(4)}
              disabled={!financialMode}
              className="h-12 w-full rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] text-sm font-bold text-[#03231a] shadow-[0_12px_30px_rgba(25,245,193,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => goToStep(4)}
              className="h-12 w-full rounded-2xl border border-[rgba(92,255,196,0.20)] bg-[rgba(8,23,20,0.58)] text-sm font-semibold text-[rgba(230,255,247,0.9)] transition hover:bg-[rgba(10,31,26,0.72)]"
            >
              Pular
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <h1 className="text-xl font-black tracking-[0.01em] text-[#f6fffb] sm:text-2xl">
          Você tem dívidas ou contas fixas importantes?
        </h1>

        <div className="mt-4 grid gap-4">
          <div className="rounded-2xl border border-[rgba(92,255,196,0.18)] bg-[rgba(8,23,20,0.58)] p-4">
            <p className="text-sm font-semibold text-[rgba(230,255,247,0.92)]">Dívidas</p>
            <div className="mt-3 grid gap-2">
              <input
                value={debtName}
                onChange={(event) => setDebtName(event.target.value)}
                placeholder="Nome da dívida"
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <input
                type="number"
                value={debtTotalInput}
                onChange={(event) => setDebtTotalInput(event.target.value)}
                placeholder="Valor total"
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <input
                type="number"
                value={debtMonthlyInput}
                onChange={(event) => setDebtMonthlyInput(event.target.value)}
                placeholder="Parcela mensal"
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <button
                type="button"
                onClick={handleDebtAdd}
                className="h-11 rounded-xl border border-[rgba(92,255,196,0.26)] bg-[rgba(12,33,28,0.86)] text-sm font-semibold text-[rgba(230,255,247,0.92)]"
              >
                Adicionar dívida
              </button>
            </div>
            {debts.length > 0 ? (
              <ul className="mt-3 grid gap-1 text-xs text-[rgba(203,255,236,0.78)]">
                {debts.map((debt, index) => (
                  <li key={`${debt.name}-${index}`}>{debt.name} — R$ {debt.totalAmount.toFixed(2)}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[rgba(92,255,196,0.18)] bg-[rgba(8,23,20,0.58)] p-4">
            <p className="text-sm font-semibold text-[rgba(230,255,247,0.92)]">Despesas fixas</p>
            <div className="mt-3 grid gap-2">
              <input
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="Nome da conta"
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <input
                type="number"
                value={expenseValueInput}
                onChange={(event) => setExpenseValueInput(event.target.value)}
                placeholder="Valor"
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <input
                type="date"
                value={expenseDueDate}
                onChange={(event) => setExpenseDueDate(event.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(92,255,196,0.22)] bg-[rgba(9,27,23,0.72)] px-3 text-sm text-[#f6fffb] outline-none"
              />
              <button
                type="button"
                onClick={handleFixedExpenseAdd}
                className="h-11 rounded-xl border border-[rgba(92,255,196,0.26)] bg-[rgba(12,33,28,0.86)] text-sm font-semibold text-[rgba(230,255,247,0.92)]"
              >
                Adicionar despesa fixa
              </button>
            </div>
            {fixedExpenses.length > 0 ? (
              <ul className="mt-3 grid gap-1 text-xs text-[rgba(203,255,236,0.78)]">
                {fixedExpenses.map((expense, index) => (
                  <li key={`${expense.name}-${index}`}>{expense.name} — R$ {expense.amount.toFixed(2)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={finishOnboarding}
            className="h-12 w-full rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] text-sm font-bold text-[#03231a] shadow-[0_12px_30px_rgba(25,245,193,0.24)] transition hover:brightness-110"
          >
            Finalizar
          </button>
          <button
            type="button"
            onClick={finishOnboarding}
            className="h-12 w-full rounded-2xl border border-[rgba(92,255,196,0.20)] bg-[rgba(8,23,20,0.58)] text-sm font-semibold text-[rgba(230,255,247,0.9)] transition hover:bg-[rgba(10,31,26,0.72)]"
          >
            Pular por enquanto
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#040807] p-4 text-[#f6fffb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(25,245,193,0.18),transparent_36%),radial-gradient(circle_at_86%_10%,rgba(17,199,157,0.16),transparent_34%),radial-gradient(circle_at_50%_115%,rgba(30,220,141,0.12),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(7,20,17,0.78),rgba(4,8,7,0.95))]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="rounded-[26px] border border-[rgba(92,255,196,0.16)] bg-[rgba(7,20,17,0.82)] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgba(230,255,247,0.86)]">Configuração inicial</p>
              <p className="text-xs text-[rgba(203,255,236,0.66)]">Etapa {step} de 4</p>
            </div>
            <button
              type="button"
              onClick={finishOnboarding}
              className="h-10 rounded-xl border border-[rgba(92,255,196,0.20)] bg-[rgba(10,28,24,0.78)] px-4 text-xs font-semibold text-[rgba(230,255,247,0.9)] transition hover:bg-[rgba(11,37,31,0.96)]"
            >
              Pular
            </button>
          </div>

          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[rgba(92,255,196,0.12)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#1edc8d] shadow-[0_0_10px_rgba(25,245,193,0.24)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {stepError ? (
            <div className="mb-4 rounded-xl border border-[rgba(248,113,113,0.45)] bg-[rgba(127,29,29,0.35)] px-3 py-2 text-sm text-[rgba(254,202,202,0.95)]">
              {stepError}
            </div>
          ) : null}

          {renderStep()}
        </div>
      </div>
    </div>
  );
}
