import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Layers3,
  Lock,
  PieChart,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { ScreenType } from "@/lib/types";

const NAV_LINKS = [
  { label: "Recursos", href: "#recursos" },
  { label: "Para quem é", href: "#para-quem" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Preços", href: "#precos" },
];

const FEATURES = [
  {
    icon: WalletCards,
    title: "Fluxo de caixa claro",
    description: "Entradas, saídas, taxas e lucro líquido em uma visão simples.",
  },
  {
    icon: Layers3,
    title: "Potes sem mistura",
    description: "Separe pessoal, negócio e reserva antes de decidir o que usar.",
  },
  {
    icon: Clock3,
    title: "Compromissos próximos",
    description: "Veja contas e recorrências que podem afetar seu disponível real.",
  },
  {
    icon: Bot,
    title: "Consultor IA",
    description: "Receba orientação com base nos dados reais do seu painel.",
  },
];

const AUDIENCES = [
  "Autônomos que misturam PF e PJ",
  "Pequenos negócios que precisam saber o lucro real",
  "Prestadores de serviço que querem decidir com mais segurança",
];

const STEPS = [
  {
    title: "Registre o que entrou e saiu",
    description: "O app organiza o caixa sem mudar suas regras financeiras.",
  },
  {
    title: "Separe por potes",
    description: "PF, PJ e Reserva ficam visíveis para você não misturar decisões.",
  },
  {
    title: "Decida com clareza",
    description: "Veja disponível real, compromissos e próximos passos.",
  },
];

export default function LandingScreen() {
  const { goScreen } = useApp();

  const goToAuth = () => goScreen(ScreenType.LOGIN);

  return (
    <div
      className="fc-landing min-h-screen overflow-x-hidden bg-[#020617] text-white antialiased"
      style={{ fontFamily: '"Gotan", "Inter", "Montserrat", "Arial", sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_55%_110%,rgba(34,197,94,0.12),transparent_40%),linear-gradient(150deg,#020617_0%,#030b0a_52%,#020617_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:30px_30px] opacity-[0.07]" />

      <header className="sticky top-0 z-50 border-b border-emerald-300/10 bg-[#020617]/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] min-h-[76px] w-full max-w-[1220px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <button type="button" onClick={goToAuth} className="flex min-w-[132px] items-center gap-3 sm:min-w-[170px]">
            <BrandLogo
              variant="full"
              alt="FluxoCerto 360"
              className="h-9 w-auto min-w-[132px] max-w-[154px] object-contain drop-shadow-[0_0_18px_rgba(34,197,94,0.14)] sm:h-10 sm:min-w-[170px] sm:max-w-[208px]"
            />
          </button>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-300 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-emerald-300">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={goToAuth}
              className="hidden h-11 items-center rounded-2xl border border-emerald-300/14 bg-white/[0.025] px-5 text-sm font-bold text-slate-100 transition hover:border-emerald-300/28 hover:bg-emerald-400/10 sm:inline-flex"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={goToAuth}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-5 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)]"
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-6 py-14 sm:px-8 md:py-16 lg:min-h-[calc(100vh-76px)] lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[520px] text-left lg:mx-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-[0_0_24px_rgba(34,197,94,0.08)]">
              <ShieldCheck className="h-4 w-4" />
              Finanças separadas, decisões mais claras
            </div>

            <h1 className="mt-8 max-w-[520px] text-[clamp(2.35rem,4.8vw,4rem)] font-black leading-[1.1] tracking-[-0.01em] text-white">
              Pare de misturar seu dinheiro.
              <span className="mt-3 block text-emerald-300">Veja o que é seu, do negócio e da reserva.</span>
            </h1>

            <p className="mt-5 max-w-[500px] text-base leading-7 text-slate-300 sm:text-[1.05rem] sm:leading-8">
              O FluxoCerto 360 organiza entradas, saídas, potes, taxas e compromissos para você decidir com clareza.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={goToAuth}
                className="inline-flex h-[52px] min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)]"
              >
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToAuth}
                className="inline-flex h-[52px] min-h-[52px] items-center justify-center rounded-2xl border border-emerald-300/14 bg-white/[0.025] px-7 text-sm font-bold text-slate-100 transition hover:border-emerald-300/28 hover:bg-emerald-400/10"
              >
                Entrar
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Lucro real", "Potes separados", "Disponível real"].map((item) => (
                <div key={item} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-emerald-300/12 bg-white/[0.04] px-4 text-sm font-bold leading-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur-xl">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroProductCard />
          </div>
        </section>

        <section id="recursos" className="mx-auto w-full max-w-[1220px] border-t border-emerald-300/10 px-5 py-16 sm:px-8 lg:px-10">
          <SectionHeader
            eyebrow="Recursos"
            title="Controle financeiro sem bagunça"
            description="Uma base simples para enxergar o que entrou, o que saiu e o que realmente pode ser usado."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="min-h-[190px] rounded-[24px] border border-emerald-300/12 bg-[#05110e]/76 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl transition hover:border-emerald-300/28 hover:bg-emerald-400/[0.06]">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-lg font-black tracking-[-0.02em] text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="para-quem" className="mx-auto grid w-full max-w-[1220px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1fr] lg:px-10">
          <div>
            <SectionHeader
              eyebrow="Para quem é"
              title="Feito para quem trabalha e decide com o próprio dinheiro"
              description="Ideal para profissionais e pequenos negócios que precisam separar vida pessoal, caixa do negócio e reserva."
              align="left"
            />
          </div>
          <div className="grid gap-3">
            {AUDIENCES.map((item) => (
              <article key={item} className="flex items-center gap-4 rounded-[22px] border border-emerald-300/12 bg-white/[0.035] p-5 backdrop-blur-xl">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <p className="text-base font-bold leading-6 text-slate-100">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="mx-auto w-full max-w-[1220px] px-5 py-16 sm:px-8 lg:px-10">
          <div className="rounded-[32px] border border-emerald-300/12 bg-[#05110e]/70 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl sm:p-8">
            <SectionHeader
              eyebrow="Como funciona"
              title="Do registro à decisão, sem complicar"
              description="Você registra. O app organiza. Você decide o próximo passo com mais segurança."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <article key={step.title} className="rounded-[24px] border border-emerald-300/10 bg-black/20 p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/10 text-sm font-black text-emerald-300">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-black text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="precos" className="mx-auto w-full max-w-[1220px] px-5 py-16 sm:px-8 lg:px-10">
          <div className="grid gap-6 rounded-[32px] border border-emerald-300/16 bg-[radial-gradient(circle_at_12%_0%,rgba(34,197,94,0.18),transparent_34%),linear-gradient(135deg,rgba(5,17,14,0.88),rgba(2,6,23,0.86))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl lg:grid-cols-[1fr_380px] lg:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/90">Preços</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">
                Comece com clareza antes de tomar a próxima decisão financeira.
              </h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {["7 dias grátis", "Sem cartão de crédito", "Cancele quando quiser"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <article className="rounded-[26px] border border-emerald-300/14 bg-[#020617]/58 p-6">
              <p className="text-sm font-bold text-slate-400">Plano inicial</p>
              <div className="mt-4 flex items-end gap-2">
                <strong className="text-4xl font-black tracking-[-0.04em] text-white">Grátis</strong>
                <span className="pb-1 text-sm font-bold text-slate-400">para testar</span>
              </div>
              <button
                type="button"
                onClick={goToAuth}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)]"
              >
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1220px] px-5 pb-16 pt-4 sm:px-8 lg:px-10">
          <div className="rounded-[32px] border border-emerald-300/12 bg-[#05110e]/76 p-7 text-center shadow-[0_28px_80px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl sm:p-10">
            <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">
              Seu dinheiro fica mais simples quando cada parte tem um lugar.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
              Organize o caixa, proteja a reserva e saiba quanto pode usar sem depender de chute.
            </p>
            <button
              type="button"
              onClick={goToAuth}
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)]"
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-emerald-300/10 bg-[#020617]/88">
        <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-5 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <BrandLogo variant="full" className="h-9 w-auto min-w-[156px] max-w-[190px] object-contain" />
          <p>© 2026 FluxoCerto 360. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-xl"}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/90">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-400">{description}</p>
    </div>
  );
}

function HeroProductCard() {
  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="absolute inset-4 rounded-full bg-emerald-400/16 blur-[64px]" />
      <div className="relative rounded-[30px] border border-emerald-300/14 bg-[#05110e]/80 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.48),0_0_42px_rgba(34,197,94,0.10),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/90">Painel 360</p>
            <h2 className="mt-2 text-xl font-black text-white">Visão do mês</h2>
          </div>
          <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
            Seguro
          </span>
        </div>

        <div className="mt-6 rounded-[26px] border border-emerald-300/12 bg-black/24 p-5">
          <p className="text-sm font-bold text-slate-400">Lucro líquido</p>
          <strong className="mt-2 block text-[2.15rem] font-black leading-none tracking-[-0.035em] text-emerald-300">R$ 4.680,00</strong>
          <div className="mt-5 h-24 rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,0.14),transparent)] p-3">
            <svg viewBox="0 0 300 120" className="h-full w-full">
              <path d="M8 102 C58 100 82 94 116 96 C154 98 170 48 198 45 C232 41 248 20 292 16" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniMetric icon={BriefcaseBusiness} label="PJ" value="R$ 2.120" />
          <MiniMetric icon={WalletCards} label="PF" value="R$ 1.460" />
          <MiniMetric icon={PieChart} label="Reserva" value="R$ 1.100" />
        </div>

        <div className="mt-4 rounded-[24px] border border-emerald-300/12 bg-white/[0.035] p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-black text-white">Nada mistura sozinho</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Você vê o disponível real antes de decidir.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/10 bg-white/[0.035] p-4">
      <Icon className="h-4 w-4 text-emerald-300" />
      <p className="mt-3 text-xs font-bold text-slate-400">{label}</p>
      <strong className="mt-1 block text-sm font-black text-white">{value}</strong>
    </div>
  );
}
