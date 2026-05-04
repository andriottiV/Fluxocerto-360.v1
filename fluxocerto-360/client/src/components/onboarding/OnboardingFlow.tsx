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
type OnboardingFinancialPain = "mix_money" | "money_disappears" | "no_profit" | "no_reserve";
type OnboardingFinancialStructure = "apertado" | "equilibrado" | "folga";
type OnboardingGoalConfidence = "yes" | "almost" | "far";
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
  goalConfidence: OnboardingGoalConfidence | null;
};

const INITIAL_STATE: OnboardingState = {
  step: 1,
  flag_separacao: false,
  focus: null,
  porcentagens: {
    negocio: 35,
    pessoal: 45,
    reserva: 20,
  },
  metaMensal: 0,
  goalConfidence: null,
};

const GOAL_CONFIDENCE_OPTIONS = [
  { id: "yes", label: "Sim" },
  { id: "almost", label: "Quase" },
  { id: "far", label: "Nem perto" },
] as const;

const DIAGNOSTIC_OPTIONS = [
  {
    id: "mix_money",
    title: "Misturo tudo e não sei o que é meu",
    description: "Misturo dinheiro pessoal e do negócio e nunca sei quanto realmente sobrou",
    feedback: "Vamos separar seu dinheiro pessoal do negócio e te mostrar, pela primeira vez, o que realmente sobra.",
    icon: Layers3,
  },
  {
    id: "money_disappears",
    title: "O dinheiro entra, mas some",
    description: "Eu faturo, mas no fim do mês não consigo entender para onde o dinheiro foi",
    feedback: "Vamos organizar suas entradas e saídas para você entender exatamente para onde seu dinheiro está indo.",
    icon: WalletCards,
  },
  {
    id: "no_profit",
    title: "Trabalho, mas não vejo lucro",
    description: "Eu recebo, pago as coisas... mas não consigo enxergar quanto realmente ganhei",
    feedback: "Vamos deixar claro quanto você realmente ganha, sem achismo.",
    icon: TrendingUp,
  },
  {
    id: "no_reserve",
    title: "Vivo sem segurança financeira",
    description: "Não tenho reserva e qualquer imprevisto pode virar um problema",
    feedback: "Vamos estruturar seu dinheiro para você construir uma reserva e ter mais tranquilidade.",
    icon: ShieldCheck,
  },
] as const;

const STRUCTURE_OPTIONS = [
  {
    id: "apertado",
    title: "Meu dinheiro vive apertado",
    description: "Preciso usar boa parte do que entra para manter minha vida e o negócio funcionando",
    feedback: "Vamos priorizar a estabilidade do seu negócio e organizar seu dinheiro para você sair do aperto com segurança.",
    porcentagens: { negocio: 55, pessoal: 30, reserva: 15 },
  },
  {
    id: "equilibrado",
    title: "Dá para manter, mas sem folga",
    description: "Consigo me pagar, mas ainda preciso cuidar bem do dinheiro para não faltar",
    feedback: "Vamos organizar seu dinheiro para você se pagar melhor, manter o negócio saudável e começar a construir reserva.",
    porcentagens: { negocio: 35, pessoal: 45, reserva: 20 },
  },
  {
    id: "folga",
    title: "Sobra dinheiro com frequência",
    description: "Meu dinheiro cobre tudo e ainda consigo guardar ou investir",
    feedback: "Vamos estruturar seu dinheiro para você tirar mais para você, fortalecer seu negócio e acelerar a construção da sua reserva.",
    porcentagens: { negocio: 25, pessoal: 50, reserva: 25 },
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

function mapFinancialPainToLegacyFields(financialPain: OnboardingFinancialPain): Pick<OnboardingState, "flag_separacao" | "focus"> {
  if (financialPain === "mix_money") return { flag_separacao: true, focus: null };
  if (financialPain === "no_profit") return { flag_separacao: false, focus: "precificacao" };
  if (financialPain === "no_reserve") return { flag_separacao: false, focus: "seguranca" };
  return { flag_separacao: false, focus: null };
}

function inferFinancialPainFromSaved(saved: {
  financialPain?: unknown;
  flag_separacao?: boolean;
  focus?: OnboardingFocus;
}): OnboardingFinancialPain | null {
  if (
    saved.financialPain === "mix_money" ||
    saved.financialPain === "money_disappears" ||
    saved.financialPain === "no_profit" ||
    saved.financialPain === "no_reserve"
  ) {
    return saved.financialPain;
  }
  if (saved.flag_separacao) return "mix_money";
  if (saved.focus === "precificacao") return "no_profit";
  if (saved.focus === "seguranca") return "no_reserve";
  return null;
}

function isSameDistribution(
  value: { negocio: number; pessoal: number; reserva: number } | undefined,
  expected: { negocio: number; pessoal: number; reserva: number }
) {
  if (!value) return false;
  return (
    Math.abs(value.negocio - expected.negocio) < 0.001 &&
    Math.abs(value.pessoal - expected.pessoal) < 0.001 &&
    Math.abs(value.reserva - expected.reserva) < 0.001
  );
}

function inferFinancialStructureFromSaved(saved: {
  financialStructure?: unknown;
  porcentagens?: { negocio: number; pessoal: number; reserva: number };
}): OnboardingFinancialStructure {
  if (
    saved.financialStructure === "apertado" ||
    saved.financialStructure === "equilibrado" ||
    saved.financialStructure === "folga"
  ) {
    return saved.financialStructure;
  }

  const matched = STRUCTURE_OPTIONS.find((option) => isSameDistribution(saved.porcentagens, option.porcentagens));
  if (matched) return matched.id;

  if (saved.porcentagens) {
    if (saved.porcentagens.negocio >= 45 || saved.porcentagens.pessoal <= 35) return "apertado";
    if (saved.porcentagens.pessoal >= 55) return "folga";
  }

  return "equilibrado";
}

function buildGrossRevenueProjection(personalGoal: number, personalPercentage: number) {
  const monthly = personalGoal > 0 && personalPercentage > 0 ? personalGoal / (personalPercentage / 100) : 0;
  return {
    monthly: Number(monthly.toFixed(2)),
    weekly: Number((monthly / 4.33).toFixed(2)),
    daily: Number((monthly / 22).toFixed(2)),
  };
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
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<OnboardingFinancialPain | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<OnboardingFinancialStructure>("equilibrado");
  const [metaInput, setMetaInput] = useState("");

  const currentStep = Math.max(1, Math.min(4, state.step)) as OnboardingStep;
  const personalPercent = Math.max(1, state.porcentagens.pessoal);
  const grossRevenueProjection = buildGrossRevenueProjection(state.metaMensal, personalPercent);
  const faturamentoNecessario = grossRevenueProjection.monthly;
  const progress = (currentStep / 4) * 100;

  useEffect(() => {
    if (!user?.id) return;

    if (isUserOnboardingCompleted(user.id)) {
      goScreen(ScreenType.DASHBOARD);
      return;
    }

    const saved = getUserOnboardingData(user.id);
    const savedStructure = inferFinancialStructureFromSaved(saved);
    const savedStructureOption = STRUCTURE_OPTIONS.find((option) => option.id === savedStructure);
    const savedPercentages =
      saved.financialStructure || !saved.porcentagens
        ? saved.porcentagens ?? savedStructureOption?.porcentagens
        : savedStructureOption?.porcentagens ?? saved.porcentagens;
    setState((prev) => ({
      ...prev,
      step: saved.step ?? prev.step,
      flag_separacao: saved.flag_separacao ?? prev.flag_separacao,
      focus: saved.focus ?? prev.focus,
      porcentagens: savedPercentages ?? prev.porcentagens,
      metaMensal: saved.metaMensal ?? prev.metaMensal,
      goalConfidence: saved.goalConfidence ?? prev.goalConfidence,
    }));

    if (saved.metaMensal) setMetaInput(formatCurrency(saved.metaMensal));
    setSelectedDiagnostic(inferFinancialPainFromSaved(saved));
    setSelectedStructure(savedStructure);
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
          goalConfidence: merged.goalConfidence ?? undefined,
          financialMode: mapFocusToFinancialMode(merged.focus),
        });
      }
      return merged;
    });
  };

  const goNext = () => updateFlow({ step: Math.min(4, currentStep + 1) });
  const goBack = () => updateFlow({ step: Math.max(1, currentStep - 1) });

  const handleDiagnostic = (optionId: OnboardingFinancialPain) => {
    const legacyFields = mapFinancialPainToLegacyFields(optionId);
    setSelectedDiagnostic(optionId);
    updateFlow({
      ...legacyFields,
    });
    if (user?.id) {
      saveUserOnboardingData(user.id, { financialPain: optionId });
    }
  };

  const handleStructure = (option: (typeof STRUCTURE_OPTIONS)[number]) => {
    setSelectedStructure(option.id);
    updateFlow({ porcentagens: option.porcentagens });
    if (user?.id) {
      saveUserOnboardingData(user.id, { financialStructure: option.id });
    }
  };

  const handleMetaChange = (value: string) => {
    const nextValue = parseCurrencyDigits(value);
    setMetaInput(maskCurrencyInput(value));
    updateFlow({ metaMensal: nextValue });
  };

  const handleGoalConfidence = (goalConfidence: OnboardingGoalConfidence) => {
    updateFlow({ goalConfidence });
  };

  const finish = () => {
    if (!user?.id) return;

    const distribution: PotDistribution = {
      personal: state.porcentagens.pessoal,
      business: state.porcentagens.negocio,
      reserve: state.porcentagens.reserva,
    };
    const financialMode = mapFocusToFinancialMode(state.focus);
    const projection = buildGrossRevenueProjection(state.metaMensal, state.porcentagens.pessoal);

    saveUserOnboardingData(user.id, {
      step: 4,
      flag_separacao: state.flag_separacao,
      focus: state.focus,
      porcentagens: state.porcentagens,
      metaMensal: state.metaMensal,
      goalConfidence: state.goalConfidence ?? undefined,
      financialMode,
      financialStructure: selectedStructure,
      personalMonthlyGoal: state.metaMensal,
      estimatedGrossMonthlyRevenue: projection.monthly,
      weeklyRevenueTarget: projection.weekly,
      dailyRevenueTarget: projection.daily,
      projectedMonthlyGrossRevenue: projection.monthly,
      projectedWeeklyGrossRevenue: projection.weekly,
      projectedDailyGrossRevenue: projection.daily,
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
            title="Hoje, qual dessas situações mais representa sua relação com o dinheiro?"
            subtitle="Não precisa ser perfeito. Escolha o que mais se aproxima do que você vive hoje."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
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
            title="Hoje, olhando sua vida no geral, como está seu dinheiro?"
            subtitle="Pense no que sobra no fim do mês, não só no que entra."
          />
          <div className="grid gap-4 md:grid-cols-3">
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
                  {selected ? (
                    <p className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-3 text-xs font-semibold leading-5 text-emerald-50">
                      {option.feedback}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <PrimaryAction disabled={!selectedStructure} onClick={goNext}>Continuar</PrimaryAction>
        </div>
      );
    }

    if (currentStep === 3) {
      const metaSemanal = faturamentoNecessario / 4.33;
      const metaDiaria = faturamentoNecessario / 22;

      return (
        <div className="grid gap-6">
          <StepHeader
            eyebrow="Meta"
            title="Quanto você precisa por mês para viver sem aperto?"
            subtitle="Pense nas suas contas reais do dia a dia."
          />
          <div className="rounded-[30px] border border-emerald-300/12 bg-white/[0.035] p-5 backdrop-blur-xl sm:p-7">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/80">Valor monetário em R$</label>
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
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">Não precisa ser perfeito. Você pode ajustar depois.</p>
            <div className="mt-5 rounded-2xl border border-emerald-300/12 bg-emerald-400/8 p-4 text-sm font-semibold leading-6 text-slate-200">
              {state.metaMensal > 0 ? (
                <div className="grid gap-4">
                  <p>
                    Para você ter <strong className="text-emerald-300">{formatCurrency(state.metaMensal)}</strong> no seu bolso todo mês, seu negócio precisa gerar aproximadamente{" "}
                    <strong className="text-emerald-300">{formatCurrency(faturamentoNecessario)}</strong> de faturamento bruto mensal.
                  </p>
                  <p>Esse valor ainda não é lucro — ele inclui tudo que entra antes de custos, taxas e despesas.</p>
                  <p>Depois disso, o sistema separa automaticamente seu dinheiro pessoal, o caixa do negócio e sua reserva.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ProjectionCard label="Faturamento mensal necessário" value={formatCurrency(faturamentoNecessario)} />
                    <ProjectionCard label="Meta semanal" value={formatCurrency(metaSemanal)} />
                    <ProjectionCard label="Meta diária" value={formatCurrency(metaDiaria)} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300/80">Hoje você consegue tirar esse valor?</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {GOAL_CONFIDENCE_OPTIONS.map((option) => {
                        const selected = state.goalConfidence === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleGoalConfidence(option.id)}
                            className={`h-12 rounded-2xl border px-4 text-sm font-black transition ${
                              selected
                                ? "border-emerald-300/70 bg-emerald-400/18 text-emerald-50"
                                : "border-emerald-300/14 bg-black/18 text-slate-200 hover:border-emerald-300/35 hover:bg-emerald-400/10"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                "Informe uma meta para calcular o faturamento bruto mensal necessário."
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
            title="Seu dinheiro agora tem direção."
            subtitle="A partir de agora, toda entrada será organizada automaticamente."
          />
          <div className="mt-6 rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-4 text-sm font-semibold leading-6 text-slate-300">
            <p>Antes de dividir o dinheiro, o sistema desconta as taxas.</p>
            <p className="mt-2">Depois disso, o valor é separado entre:</p>
          </div>
          <div className="mt-5 grid gap-3">
            <ActivationPotRow
              label="Seu negócio"
              helper="mantém a máquina rodando"
              value={state.porcentagens.negocio}
              color="bg-emerald-400"
            />
            <ActivationPotRow
              label="Seu dinheiro pessoal"
              helper="o que vai para o seu bolso"
              value={state.porcentagens.pessoal}
              color="bg-sky-400"
            />
            <ActivationPotRow
              label="Sua reserva"
              helper="sua segurança"
              value={state.porcentagens.reserva}
              color="bg-amber-300"
            />
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
            Meta livre mensal: <strong className="text-emerald-300">{formatCurrency(state.metaMensal)}</strong>
            <br />
            Faturamento bruto mensal necessário: <strong className="text-emerald-300">{formatCurrency(faturamentoNecessario)}</strong>
            <br />
            Meta semanal: <strong className="text-emerald-300">{formatCurrency(grossRevenueProjection.weekly)}</strong>
            <br />
            Meta diária: <strong className="text-emerald-300">{formatCurrency(grossRevenueProjection.daily)}</strong>
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-300/16 bg-emerald-400/10 p-4 text-sm font-black leading-6 text-emerald-50">
            Seguindo esse plano, você deixa de trabalhar sem ver resultado.
          </div>
          <PrimaryAction onClick={finish}>Começar a organizar meu dinheiro</PrimaryAction>
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

function ProjectionCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-300/12 bg-black/18 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <strong className="mt-2 block text-base font-black text-white">{value}</strong>
    </div>
  );
}

function ActivationPotRow({
  label,
  helper,
  value,
  color,
}: {
  label: string;
  helper: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-white">{label}</p>
          <small className="mt-1 block text-sm font-semibold leading-5 text-slate-400">{helper}</small>
        </div>
        <strong className="text-sm font-black text-emerald-200">{value}%</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
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

