import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { markUserOnboardingCompleted } from "@/lib/auth";

type TutorialStep = {
  title: string;
  description: string;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Bem-vindo ao FluxoCerto360",
    description: "Vou te mostrar rapidamente como começar a organizar seu dinheiro.",
  },
  {
    title: "Registre suas entradas",
    description: "Anote tudo o que você recebe para acompanhar seu dinheiro com clareza.",
  },
  {
    title: "Registre suas saídas",
    description: "Controle seus gastos para entender para onde seu dinheiro está indo.",
  },
  {
    title: "Use o consultor",
    description: "Pergunte sobre sua situação financeira e receba orientações com base nos seus dados.",
  },
  {
    title: "Registre por voz",
    description: "Use o microfone para lançar entradas e saídas mais rápido no dia a dia.",
  },
  {
    title: "Pronto para começar",
    description: "Agora é só alimentar o app com suas informações e acompanhar sua evolução.",
  },
];

export default function OnboardingScreen() {
  const { goScreen, user } = useApp();
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const progress = useMemo(() => ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100, [stepIndex]);

  const finishTutorial = () => {
    if (user?.id) {
      markUserOnboardingCompleted(user.id);
    }
    goScreen(ScreenType.DASHBOARD);
  };

  const handleNext = () => {
    if (isLastStep) {
      finishTutorial();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#040807] p-4 text-[#f6fffb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(25,245,193,0.18),transparent_36%),radial-gradient(circle_at_86%_10%,rgba(17,199,157,0.16),transparent_34%),radial-gradient(circle_at_50%_115%,rgba(30,220,141,0.12),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(7,20,17,0.78),rgba(4,8,7,0.95))]" />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="rounded-[26px] border border-[rgba(92,255,196,0.16)] bg-[rgba(7,20,17,0.82)] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgba(230,255,247,0.86)]">
                Tutorial inicial
              </p>
              <p className="text-xs text-[rgba(203,255,236,0.66)]">
                Etapa {stepIndex + 1} de {TUTORIAL_STEPS.length}
              </p>
            </div>

            <button
              type="button"
              onClick={finishTutorial}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(92,255,196,0.20)] bg-[rgba(10,28,24,0.78)] px-4 text-sm font-semibold text-[rgba(230,255,247,0.9)] transition hover:bg-[rgba(11,37,31,0.96)]"
            >
              <SkipForward className="h-4 w-4" />
              Pular
            </button>
          </div>

          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[rgba(92,255,196,0.12)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#1edc8d] shadow-[0_0_10px_rgba(25,245,193,0.24)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`tutorial-${stepIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-[rgba(92,255,196,0.14)] bg-[linear-gradient(165deg,rgba(8,24,20,0.76),rgba(6,16,14,0.68))] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.32)]"
            >
              <img
                src="/logo-full.png"
                alt="FluxoCerto 360"
                className="mx-auto mb-5 block h-auto w-[220px] sm:w-[250px]"
                style={{
                  objectFit: "contain",
                  filter: "brightness(1.18) contrast(1.08)",
                }}
              />
              <h1 className="mb-3 text-center text-xl font-black tracking-[0.015em] text-[#f6fffb] sm:text-2xl">
                {currentStep.title}
              </h1>
              <p className="mx-auto max-w-xl text-center text-sm leading-6 text-[rgba(230,255,247,0.78)] sm:text-[15px]">
                {currentStep.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={stepIndex === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[rgba(92,255,196,0.16)] bg-[rgba(8,23,20,0.66)] px-5 text-sm font-semibold text-[rgba(230,255,247,0.88)] transition hover:bg-[rgba(11,37,31,0.9)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] px-6 text-sm font-bold text-[#03231a] shadow-[0_12px_28px_rgba(25,245,193,0.24)] transition hover:brightness-110 hover:shadow-[0_14px_30px_rgba(25,245,193,0.30)]"
            >
              {isLastStep ? "Começar agora" : "Proximo"}
              {!isLastStep ? <ChevronRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
