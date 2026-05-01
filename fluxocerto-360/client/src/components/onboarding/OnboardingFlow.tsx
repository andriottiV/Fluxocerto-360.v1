import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { getUserOnboardingData, isUserOnboardingCompleted, markUserOnboardingCompleted, saveUserOnboardingData } from "@/lib/auth";
import { PotType, ScreenType, type OnboardingFinancialMode, type PotDistribution } from "@/lib/types";

type OnboardingFocus = "precificacao" | "seguranca" | null;
type OnboardingStep = 1 | 2 | 3 | 4;

type OnboardingState = {
  step: number;
  flag_separacao: boolean;
  focus: OnboardingFocus;
  porcentagens: {
    negocio: number;
    pessoal: number;
    reserva: number;
  };
  metaMensal: number;
};

const INITIAL_STATE: OnboardingState = {
  step: 1,
  flag_separacao: false,
  focus: null,
  porcentagens: {
    negocio: 50,
    pessoal: 30,
    reserva: 20,
  },
  metaMensal: 0,
};

const DIAGNOSTIC_OPTIONS = [
  {
    id: "misturado",
    title: "Tudo misturado",
    description: "Dinheiro pessoal e do negócio ainda ficam no mesmo fluxo.",
    icon: Layers3,
  },
  {
    id: "lucro",
    title: "Não vejo lucro",
    description: "Entra dinheiro, mas o lucro real fica difícil de enxergar.",
    icon: TrendingUp,
  },
  {
    id: "reserva",
    title: "Falta reserva",
    description: "Você quer mais segurança para imprevistos e meses fracos.",
    icon: ShieldCheck,
  },
] as const;

const STRUCTURE_OPTIONS = [
  {
    id: "alto",
    title: "Sim, custo alto",
    description: "Sua operação precisa de mais caixa para rodar com segurança.",
    porcentagens: { negocio: 50, pessoal: 30, reserva: 20 },
  },
  {
    id: "baixo",
    title: "Não, custo baixo",
    description: "Você consegue direcionar mais para retirada pessoal.",
    porcentagens: { negocio: 20, pessoal: 60, reserva: 20 },
  },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function parseCurrencyDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

function maskCurrencyInput(value: string) {
  return formatCurrency(parseCurrencyDigits(value));
}

function mapFocusToFinancialMode(focus: OnboardingFocus): OnboardingFinancialMode {
  if (focus === "precificacao") return "growth";
  if (focus === "seguranca") return "surplus";
  return "breakEven";
}

export default function OnboardingFlow() {
  const {
    goScreen,
    user,
    setPotDistribution,
    applyOnboardingUsageMode,
    applyOnboardingFinancialMode,
    updatePotGoal,
    pots,
  } = useApp();
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string | null>("alto");
  const [metaInput, setMetaInput] = useState("");

  const currentStep = Math.max(1, Math.min(4, state.step)) as OnboardingStep;
  const personalPercent = Math.max(1, state.porcentagens.pessoal);
  const faturamentoNecessario = state.metaMensal > 0 ? state.metaMensal / (personalPercent / 100) : 0;
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
      flag_separacao: saved.flag_separacao ?? prev.flag_separacao,
      focus: saved.focus ?? prev.focus,
      porcentagens: saved.porcentagens ?? prev.porcentagens,
      metaMensal: saved.metaMensal ?? prev.metaMensal,
    }));

    if (saved.metaMensal) setMetaInput(formatCurrency(saved.metaMensal));
    if (saved.focus === "precificacao") setSelectedDiagnostic("lucro");
    if (saved.focus === "seguranca") setSelectedDiagnostic("reserva");
    if (saved.flag_separacao) setSelectedDiagnostic("misturado");
    if (saved.porcentagens) {
      const isLowCost =
        saved.porcentagens.negocio === 20 && saved.porcentagens.pessoal === 60 && saved.porcentagens.reserva === 20;
      setSelectedStructure(isLowCost ? "baixo" : "alto");
    }
  }, [goScreen, user?.id]);

  const updateFlow = (next: Partial<OnboardingState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      if (user?.id) {
        saveUserOnboardingData(user.id, {
          step: Math.max(1, Math.min(4, merged.step)) as OnboardingStep,
          flag_separacao: merged.flag_separacao,
          focus: merged.focus,
          porcentagens: merged.porcentagens,
          metaMensal: merged.metaMensal,
          financialMode: mapFocusToFinancialMode(merged.focus),
        });
      }
      return merged;
    });
  };

  const goNext = () => updateFlow({ step: Math.min(4, currentStep + 1) });
  const goBack = () => updateFlow({ step: Math.max(1, currentStep - 1) });

  const handleDiagnostic = (optionId: (typeof DIAGNOSTIC_OPTIONS)[number]["id"]) => {
    setSelectedDiagnostic(optionId);
    updateFlow({
      flag_separacao: optionId === "misturado",
      focus: optionId === "lucro" ? "precificacao" : optionId === "reserva" ? "seguranca" : null,
    });
  };

  const handleStructure = (option: (typeof STRUCTURE_OPTIONS)[number]) => {
    setSelectedStructure(option.id);
    updateFlow({ porcentagens: option.porcentagens });
  };

  const handleMetaChange = (value: string) => {
    const nextValue = parseCurrencyDigits(value);
    setMetaInput(maskCurrencyInput(value));
    updateFlow({ metaMensal: nextValue });
  };

  const finish = () => {
    if (!user?.id) return;

    const distribution: PotDistribution = {
      personal: state.porcentagens.pessoal,
      business: state.porcentagens.negocio,
      reserve: state.porcentagens.reserva,
    };
    const financialMode = mapFocusToFinancialMode(state.focus);

    saveUserOnboardingData(user.id, {
      step: 4,
      flag_separacao: state.flag_separacao,
      focus: state.focus,
      porcentagens: state.porcentagens,
      metaMensal: state.metaMensal,
      financialMode,
    });

    applyOnboardingUsageMode("both");
    setPotDistribution(distribution);
    applyOnboardingFinancialMode(financialMode);

    const personalPot = pots.find((pot) => pot.type === PotType.PERSONAL);
    if (personalPot && state.metaMensal > 0) {
      updatePotGoal(personalPot.id, state.metaMensal);
    }

    markUserOnboardingCompleted(user.id);
    goScreen(ScreenType.DASHBOARD);
  };

  const stepContent = useMemo(() => {
    if (currentStep === 1) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Diagnóstico"
            title="Qual dessas mais te representa HOJE?"
            subtitle="Escolha uma resposta rápida. O FluxoCerto ajusta o primeiro plano a partir disso."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {DIAGNOSTIC_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = selectedDiagnostic === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleDiagnostic(option.id)}
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
                </button>
              );
            })}
          </div>
          <PrimaryAction disabled={!selectedDiagnostic} onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Estrutura"
            title="Sua operação hoje consome muito?"
            subtitle="Vamos criar uma distribuição inicial para seus potes."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {STRUCTURE_OPTIONS.map((option) => {
              const selected = selectedStructure === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleStructure(option)}
                  className={`rounded-3xl border p-5 text-left transition duration-300 hover:scale-[1.02] ${
                    selected
                      ? "border-emerald-300/70 bg-emerald-400/12 shadow-[0_0_34px_rgba(34,197,94,0.18)]"
                      : "border-emerald-300/12 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black tracking-[-0.03em] text-white">{option.title}</h3>
                    {selected ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{option.description}</p>
                  <DistributionBars distribution={option.porcentagens} selected={selected} />
                </button>
              );
            })}
          </div>
          <PrimaryAction disabled={!selectedStructure} onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Meta"
            title="Quanto você quer tirar livre por mês?"
            subtitle="A partir disso, calculamos uma meta aproximada de faturamento."
          />
          <div className="rounded-[30px] border border-emerald-300/12 bg-white/[0.035] p-5 backdrop-blur-xl sm:p-7">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/80">Meta mensal livre</label>
            <div className="mt-4 flex items-center rounded-3xl border border-emerald-300/18 bg-black/24 px-5 focus-within:border-emerald-300/55 focus-within:ring-4 focus-within:ring-emerald-400/10">
              <CircleDollarSign className="h-6 w-6 text-emerald-300" />
              <input
                value={metaInput}
                onChange={(event) => handleMetaChange(event.target.value)}
                inputMode="numeric"
                placeholder="R$ 0,00"
                className="h-20 w-full bg-transparent px-4 text-4xl font-black tracking-[-0.04em] text-white outline-none placeholder:text-slate-600"
              />
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-300/12 bg-emerald-400/8 p-4 text-sm font-semibold leading-6 text-slate-200">
              {state.metaMensal > 0 ? (
                <>
                  Para tirar <strong className="text-emerald-300">{formatCurrency(state.metaMensal)}</strong>, você precisa faturar aproximadamente{" "}
                  <strong className="text-emerald-300">{formatCurrency(faturamentoNecessario)}</strong>.
                </>
              ) : (
                "Informe uma meta para calcular o faturamento necessário."
              )}
            </div>
          </div>
          <PrimaryAction disabled={state.metaMensal <= 0} onClick={goNext}>Continuar</PrimaryAction>
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
            eyebrow="Ativação"
            title="Plano de potes pronto."
            subtitle="Seu sistema já está funcionando."
          />
          <div className="mt-6 grid gap-3">
            <PlanRow label="Negócio" value={state.porcentagens.negocio} color="bg-emerald-400" />
            <PlanRow label="Pessoal" value={state.porcentagens.pessoal} color="bg-sky-400" />
            <PlanRow label="Reserva" value={state.porcentagens.reserva} color="bg-amber-300" />
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
            Meta livre mensal: <strong className="text-emerald-300">{formatCurrency(state.metaMensal)}</strong>
            <br />
            Faturamento recomendado: <strong className="text-emerald-300">{formatCurrency(faturamentoNecessario)}</strong>
          </div>
          <PrimaryAction onClick={finish}>Ativar meu Fluxo</PrimaryAction>
        </div>
      </div>
    );
  }, [currentStep, faturamentoNecessario, metaInput, selectedDiagnostic, selectedStructure, state]);

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

function DistributionBars({
  distribution,
  selected,
}: {
  distribution: OnboardingState["porcentagens"];
  selected: boolean;
}) {
  return (
    <div className="mt-6 grid gap-3">
      <PlanRow label="Negócio" value={distribution.negocio} color="bg-emerald-400" animated={selected} />
      <PlanRow label="Pessoal" value={distribution.pessoal} color="bg-sky-400" animated={selected} />
      <PlanRow label="Reserva" value={distribution.reserva} color="bg-amber-300" animated={selected} />
    </div>
  );
}

function PlanRow({
  label,
  value,
  color,
  animated = true,
}: {
  label: string;
  value: number;
  color: string;
  animated?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-bold">
        <span className="text-slate-200">{label}</span>
        <span className="text-emerald-200">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: animated ? `${value}%` : "0%" }}
        />
      </div>
    </div>
  );
}

