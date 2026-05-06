import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Home,
  Layers3,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  Wifi,
  Zap,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { getUserOnboardingData, isUserOnboardingCompleted, markUserOnboardingCompleted, saveUserOnboardingData } from "@/lib/auth";
import { ScreenType, type OnboardingFinancialMode, type OnboardingUsageMode, type PotDistribution } from "@/lib/types";

type OnboardingStep = 1 | 2 | 3 | 4;
type ReceivingMethod = "pix" | "dinheiro" | "debito" | "credito" | "recorrencia";
type FixedExpenseId = "aluguel" | "internet" | "energia" | "fornecedores" | "outros";
type Priority = "organizar" | "aperto" | "reserva" | "crescer";

type OnboardingState = {
  step: OnboardingStep;
  usageMode: OnboardingUsageMode | null;
  receivingMethods: ReceivingMethod[];
  fixedExpenses: FixedExpenseId[];
  priority: Priority | null;
};

const INITIAL_STATE: OnboardingState = {
  step: 1,
  usageMode: null,
  receivingMethods: [],
  fixedExpenses: [],
  priority: null,
};

const USAGE_OPTIONS = [
  {
    id: "personal",
    title: "Pessoal",
    description: "Organizar meu dinheiro pessoal e criar reserva.",
    feedback: "Vamos ativar PF + Reserva para separar o essencial sem complicar.",
    icon: Home,
    distribution: { personal: 80, business: 0, reserve: 20 },
  },
  {
    id: "business",
    title: "Negocio",
    description: "Organizar dinheiro do trabalho, vendas e custos.",
    feedback: "Vamos ativar PJ + Reserva para proteger o caixa do negocio.",
    icon: BriefcaseBusiness,
    distribution: { personal: 0, business: 80, reserve: 20 },
  },
  {
    id: "both",
    title: "Ambos",
    description: "Separar vida pessoal, negocio e reserva.",
    feedback: "Vamos ativar PF + PJ + Reserva com cada dinheiro no lugar certo.",
    icon: Layers3,
    distribution: { personal: 45, business: 40, reserve: 15 },
  },
] as const satisfies ReadonlyArray<{
  id: OnboardingUsageMode;
  title: string;
  description: string;
  feedback: string;
  icon: React.ElementType;
  distribution: PotDistribution;
}>;

const RECEIVING_OPTIONS = [
  {
    id: "pix",
    title: "Pix",
    description: "Recebimentos rapidos e diretos.",
    feedback: "Pix ajuda a enxergar entrada quase em tempo real.",
    icon: Zap,
  },
  {
    id: "dinheiro",
    title: "Dinheiro",
    description: "Pagamento em especie.",
    feedback: "Vamos lembrar que dinheiro fisico tambem precisa de direcao.",
    icon: Banknote,
  },
  {
    id: "debito",
    title: "Debito",
    description: "Venda com taxa de pagamento.",
    feedback: "Debito fica salvo como preferencia para uso futuro.",
    icon: CreditCard,
  },
  {
    id: "credito",
    title: "Credito",
    description: "Venda com prazo e taxa.",
    feedback: "Credito fica marcado para orientar taxas e recebimentos.",
    icon: CreditCard,
  },
  {
    id: "recorrencia",
    title: "Recorrencia",
    description: "Cliente, assinatura ou mensalidade.",
    feedback: "Receita recorrente ajuda o app a orientar previsao.",
    icon: CalendarDays,
  },
] as const satisfies ReadonlyArray<{
  id: ReceivingMethod;
  title: string;
  description: string;
  feedback: string;
  icon: React.ElementType;
}>;

const FIXED_EXPENSE_OPTIONS = [
  {
    id: "aluguel",
    title: "Aluguel",
    description: "Espaco, casa ou sala.",
    feedback: "Depois o app pode sugerir configurar o valor.",
    icon: Home,
  },
  {
    id: "internet",
    title: "Internet",
    description: "Conexao mensal.",
    feedback: "Marcado como sugestao, sem lancar gasto agora.",
    icon: Wifi,
  },
  {
    id: "energia",
    title: "Energia",
    description: "Conta de luz.",
    feedback: "Vai aparecer como sugestao para configurar depois.",
    icon: Zap,
  },
  {
    id: "fornecedores",
    title: "Fornecedores",
    description: "Pagamentos recorrentes do negocio.",
    feedback: "Nao lancamos nada automaticamente.",
    icon: BriefcaseBusiness,
  },
  {
    id: "outros",
    title: "Outros",
    description: "Algum compromisso mensal.",
    feedback: "Voce ajusta com calma depois.",
    icon: ReceiptText,
  },
] as const satisfies ReadonlyArray<{
  id: FixedExpenseId;
  title: string;
  description: string;
  feedback: string;
  icon: React.ElementType;
}>;

const PRIORITY_OPTIONS = [
  {
    id: "organizar",
    title: "Organizar",
    description: "Quero clareza do dinheiro.",
    feedback: "O app inicia com foco em controle e clareza.",
    icon: WalletCards,
    financialMode: "breakEven",
  },
  {
    id: "aperto",
    title: "Sair do aperto",
    description: "Preciso de alertas e controle.",
    feedback: "O app inicia com foco em alertas e protecao de caixa.",
    icon: ShieldCheck,
    financialMode: "chaos",
  },
  {
    id: "reserva",
    title: "Guardar reserva",
    description: "Quero construir seguranca.",
    feedback: "O app inicia com foco em poupar e proteger reserva.",
    icon: PiggyBank,
    financialMode: "surplus",
  },
  {
    id: "crescer",
    title: "Crescer o negocio",
    description: "Quero olhar lucro e analise.",
    feedback: "O app inicia com foco em analise, margem e lucro.",
    icon: TrendingUp,
    financialMode: "growth",
  },
] as const satisfies ReadonlyArray<{
  id: Priority;
  title: string;
  description: string;
  feedback: string;
  icon: React.ElementType;
  financialMode: OnboardingFinancialMode;
}>;

function getUsageDistribution(usageMode: OnboardingUsageMode | null): PotDistribution {
  return USAGE_OPTIONS.find((option) => option.id === usageMode)?.distribution ?? USAGE_OPTIONS[2].distribution;
}

function mapPriorityToFinancialMode(priority: Priority | null): OnboardingFinancialMode {
  return PRIORITY_OPTIONS.find((option) => option.id === priority)?.financialMode ?? "breakEven";
}

function toFixedExpenseSuggestions(items: FixedExpenseId[]) {
  return items.map((id) => {
    const option = FIXED_EXPENSE_OPTIONS.find((item) => item.id === id);
    return {
      name: option?.title ?? id,
      amount: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      category: id === "fornecedores" ? "fornecedores" : id === "internet" ? "internet" : id === "aluguel" ? "moradia" : "outros",
    };
  });
}

export default function OnboardingFlow() {
  const {
    goScreen,
    user,
    setPotDistribution,
    applyOnboardingUsageMode,
    applyOnboardingFinancialMode,
  } = useApp();
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const currentStep = Math.max(1, Math.min(4, state.step)) as OnboardingStep;
  const progress = (currentStep / 4) * 100;

  useEffect(() => {
    if (!user?.id) return;

    if (isUserOnboardingCompleted(user.id)) {
      goScreen(ScreenType.DASHBOARD);
      return;
    }

    const saved = getUserOnboardingData(user.id);
    setState((prev) => ({
      ...prev,
      step: saved.step ?? prev.step,
      usageMode: saved.usageMode ?? prev.usageMode,
      receivingMethods: Array.isArray(saved.receivingMethods)
        ? (saved.receivingMethods.filter((item) =>
            RECEIVING_OPTIONS.some((option) => option.id === item)
          ) as ReceivingMethod[])
        : prev.receivingMethods,
      fixedExpenses: Array.isArray(saved.fixedExpenseSuggestions)
        ? (saved.fixedExpenseSuggestions
            .map((item) => {
              const normalized = String(item.name ?? "").toLowerCase();
              return FIXED_EXPENSE_OPTIONS.find((option) => option.title.toLowerCase() === normalized)?.id;
            })
            .filter(Boolean) as FixedExpenseId[])
        : prev.fixedExpenses,
      priority:
        saved.priority === "organize"
          ? "organizar"
          : saved.priority === "tight"
            ? "aperto"
            : saved.priority === "reserve"
              ? "reserva"
              : saved.priority === "grow"
                ? "crescer"
                : prev.priority,
    }));
  }, [goScreen, user?.id]);

  const updateFlow = (next: Partial<OnboardingState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      if (user?.id) {
        saveUserOnboardingData(user.id, {
          step: merged.step,
          usageMode: merged.usageMode ?? undefined,
          receivingMethods: merged.receivingMethods,
          fixedExpenseSuggestions: toFixedExpenseSuggestions(merged.fixedExpenses),
          priority:
            merged.priority === "organizar"
              ? "organize"
              : merged.priority === "aperto"
                ? "tight"
                : merged.priority === "reserva"
                  ? "reserve"
                  : merged.priority === "crescer"
                    ? "grow"
                    : undefined,
          financialMode: mapPriorityToFinancialMode(merged.priority),
          porcentagens: merged.usageMode
            ? {
                pessoal: getUsageDistribution(merged.usageMode).personal,
                negocio: getUsageDistribution(merged.usageMode).business,
                reserva: getUsageDistribution(merged.usageMode).reserve,
              }
            : undefined,
        });
      }
      return merged;
    });
  };

  const goNext = () => updateFlow({ step: Math.min(4, currentStep + 1) as OnboardingStep });
  const goBack = () => updateFlow({ step: Math.max(1, currentStep - 1) as OnboardingStep });

  const canContinue = useMemo(() => {
    if (currentStep === 1) return Boolean(state.usageMode);
    if (currentStep === 2) return state.receivingMethods.length > 0;
    if (currentStep === 3) return true;
    return Boolean(state.priority);
  }, [currentStep, state.fixedExpenses.length, state.priority, state.receivingMethods.length, state.usageMode]);

  const toggleReceivingMethod = (method: ReceivingMethod) => {
    updateFlow({
      receivingMethods: state.receivingMethods.includes(method)
        ? state.receivingMethods.filter((item) => item !== method)
        : [...state.receivingMethods, method],
    });
  };

  const toggleFixedExpense = (expense: FixedExpenseId) => {
    updateFlow({
      fixedExpenses: state.fixedExpenses.includes(expense)
        ? state.fixedExpenses.filter((item) => item !== expense)
        : [...state.fixedExpenses, expense],
    });
  };

  const finish = () => {
    if (!user?.id) return;

    const usageMode = state.usageMode ?? "both";
    const distribution = getUsageDistribution(usageMode);
    const financialMode = mapPriorityToFinancialMode(state.priority);

    saveUserOnboardingData(user.id, {
      step: 4,
      usageMode,
      receivingMethods: state.receivingMethods,
      fixedExpenseSuggestions: toFixedExpenseSuggestions(state.fixedExpenses),
      financialMode,
      priority:
        state.priority === "organizar"
          ? "organize"
          : state.priority === "aperto"
            ? "tight"
            : state.priority === "reserva"
              ? "reserve"
              : state.priority === "crescer"
                ? "grow"
                : "organize",
      porcentagens: {
        pessoal: distribution.personal,
        negocio: distribution.business,
        reserva: distribution.reserve,
      },
      flag_separacao: usageMode === "both",
      focus: financialMode === "growth" ? "precificacao" : financialMode === "surplus" ? "seguranca" : null,
    });

    applyOnboardingUsageMode(usageMode);
    setPotDistribution(distribution);
    applyOnboardingFinancialMode(financialMode);

    markUserOnboardingCompleted(user.id);
    goScreen(ScreenType.DASHBOARD);
  };

  const stepContent = useMemo(() => {
    if (currentStep === 1) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Contexto"
            title="Como voce quer organizar seu dinheiro?"
            subtitle="Isso ajuda a separar seu dinheiro da forma certa."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {USAGE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = state.usageMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateFlow({ usageMode: option.id })}
                  className={`group relative min-h-[190px] rounded-3xl border p-5 text-left backdrop-blur-xl transition duration-300 hover:scale-[1.02] ${
                    selected
                      ? "border-emerald-300/70 bg-emerald-400/12 shadow-[0_0_34px_rgba(34,197,94,0.20)]"
                      : "border-emerald-300/12 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border transition ${
                        selected ? "scale-100 border-emerald-300 bg-emerald-400 text-[#02130b]" : "scale-90 border-white/10 text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.03em] text-white">{option.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{option.description}</p>
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <PrimaryAction disabled={!canContinue} onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Entradas"
            title="Como voce recebe seu dinheiro?"
            subtitle="Selecione todas as formas que fazem sentido hoje."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {RECEIVING_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = state.receivingMethods.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleReceivingMethod(option.id)}
                  className={`group relative min-h-[190px] rounded-3xl border p-5 text-left backdrop-blur-xl transition duration-300 hover:scale-[1.02] ${
                    selected
                      ? "border-emerald-300/70 bg-emerald-400/12 shadow-[0_0_34px_rgba(34,197,94,0.20)]"
                      : "border-emerald-300/12 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-6 w-6" />
                    </span>
                    {selected ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : null}
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.03em] text-white">{option.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{option.description}</p>
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <PrimaryAction disabled={!canContinue} onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Gastos fixos"
            title="Quais desses voce paga todo mes?"
            subtitle="Nao vamos lancar nada automaticamente. Isso vira sugestao para configurar depois."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {FIXED_EXPENSE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = state.fixedExpenses.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleFixedExpense(option.id)}
                  className={`group relative min-h-[190px] rounded-3xl border p-5 text-left backdrop-blur-xl transition duration-300 hover:scale-[1.02] ${
                    selected
                      ? "border-emerald-300/70 bg-emerald-400/12 shadow-[0_0_34px_rgba(34,197,94,0.20)]"
                      : "border-emerald-300/12 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-6 w-6" />
                    </span>
                    {selected ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : null}
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.03em] text-white">{option.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{option.description}</p>
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <PrimaryAction onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="relative min-h-[280px] overflow-hidden rounded-[34px] border border-amber-300/18 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.30),transparent_42%),linear-gradient(160deg,rgba(31,20,5,0.72),rgba(3,10,8,0.82))]">
          <div className="absolute inset-0 bg-amber-400/10 blur-3xl" />
          <img src="/mascoteprincipal.png" alt="Mascote FluxoCerto" className="relative mx-auto h-[320px] max-w-full object-contain" />
        </div>
        <div>
          <StepHeader
            eyebrow="Prioridade"
            title="O que voce mais precisa agora?"
            subtitle="Isso define o modo inicial do app."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PRIORITY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = state.priority === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateFlow({ priority: option.id })}
                  className={`rounded-3xl border p-5 text-left transition duration-300 hover:scale-[1.02] ${
                    selected
                      ? "border-emerald-300/70 bg-emerald-400/12 shadow-[0_0_34px_rgba(34,197,94,0.18)]"
                      : "border-emerald-300/12 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    {selected ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : null}
                  </div>
                  <h3 className="mt-5 text-lg font-black tracking-[-0.03em] text-white">{option.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{option.description}</p>
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-300/16 bg-emerald-400/10 p-4 text-sm font-black leading-6 text-emerald-50">
            Voce nao precisa saber tudo agora. A gente te ajuda a organizar no caminho.
          </div>
          <PrimaryAction disabled={!canContinue} onClick={finish}>Comecar a organizar meu dinheiro</PrimaryAction>
        </div>
      </div>
    );
  }, [canContinue, currentStep, state]);

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#020617] text-white antialiased"
      style={{ fontFamily: '"Gotan", "Inter", "Montserrat", "Arial", sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_-8%,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(20,184,166,0.11),transparent_30%),linear-gradient(180deg,#020617_0%,#020617_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:30px_30px] opacity-[0.07]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo
              variant="icon"
              className="h-10 w-10 rounded-xl object-contain drop-shadow-[0_0_18px_rgba(34,197,94,0.18)]"
              fallbackClassName="text-sm font-black text-emerald-300"
            />
            <span className="hidden text-sm font-black tracking-[-0.02em] text-white sm:inline">FluxoCerto 360</span>
          </div>
          <div className="hidden items-center gap-3 text-sm font-bold text-slate-300 sm:flex">
            <span>{currentStep}/4</span>
            <span className="h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </span>
          </div>
        </header>

        <section className="flex flex-1 items-center py-8">
          <div className="w-full rounded-[34px] border border-emerald-300/12 bg-[#05110e]/76 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="mb-8 sm:hidden">
              <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-300">
                <span>Etapa {currentStep} de 4</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div key={currentStep} className="animate-[onboardingStep_280ms_ease-out]">
              {stepContent}
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 pb-2">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 1}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-300/14 bg-white/[0.025] px-5 text-sm font-bold text-slate-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <button
            type="button"
            onClick={finish}
            className="h-11 rounded-2xl px-5 text-sm font-bold text-slate-400 transition hover:text-emerald-200"
          >
            Pular
          </button>
        </footer>
      </main>
    </div>
  );
}

function StepHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/85">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(2.2rem,6vw,4.5rem)] font-black leading-[0.96] tracking-[-0.045em] text-white">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">{subtitle}</p>
    </div>
  );
}

function PrimaryAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-2 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}
