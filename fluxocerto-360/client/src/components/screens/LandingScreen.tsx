import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  HelpCircle,
  Laptop,
  Lock,
  PieChart,
  ShieldCheck,
  Smartphone,
  Target,
  WalletCards,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";

const FEATURES = [
  {
    icon: WalletCards,
    title: "Fluxo de caixa inteligente",
    description: "Entenda suas entradas, saídas e lucro de forma automática e clara.",
  },
  {
    icon: Target,
    title: "Potes e metas",
    description: "Organize seu dinheiro em potes e alcance seus objetivos.",
  },
  {
    icon: Bot,
    title: "Consultor IA",
    description: "Receba insights personalizados e recomendações para melhorar sua saúde financeira.",
  },
  {
    icon: BarChart3,
    title: "Relatórios avançados",
    description: "Visualize gráficos, indicadores e tome decisões com base em dados reais.",
  },
];

const HERO_BULLETS = ["Simples de usar", "100% seguro", "Resultados reais"];
const BENEFITS = ["Foco no que importa", "Clareza para decidir", "Mais lucro, menos confusão"];
const CTA_BULLETS = ["7 dias grátis para testar tudo", "Sem cartão de crédito", "Cancele quando quiser"];

export default function LandingScreen() {
  const { goScreen } = useApp();
  const [logoSrc, setLogoSrc] = useState("/logo-full.png");

  const goToAuth = () => goScreen(ScreenType.LOGIN);

  return (
    <div
      className="fc-landing min-h-screen overflow-x-hidden bg-[#020617] text-white antialiased"
      style={{ fontFamily: '"Gotan", "Inter", "Montserrat", "Arial", sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_24%_-8%,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,#020617_0%,#020617_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:30px_30px] opacity-[0.08]" />

      <header className="sticky top-0 z-50 border-b border-emerald-300/10 bg-[#020617]/74 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-5 md:px-8">
          <button type="button" onClick={goToAuth} className="flex min-w-0 items-center">
            <img
              src={logoSrc}
              alt="FluxoCerto 360"
              onError={() => setLogoSrc("/icon.png")}
              className="h-9 w-auto max-w-[188px] object-contain"
            />
          </button>

          <nav className="hidden items-center gap-8 text-[13px] font-semibold text-slate-200/90 lg:flex">
            <a className="transition hover:text-emerald-300" href="#recursos">Recursos</a>
            <a className="transition hover:text-emerald-300" href="#para-quem">Para quem é</a>
            <a className="transition hover:text-emerald-300" href="#como-funciona">Como funciona</a>
            <a className="transition hover:text-emerald-300" href="#precos">Preços</a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={goToAuth}
              className="hidden h-10 items-center rounded-full px-4 text-sm font-bold text-slate-100 transition hover:text-emerald-300 sm:inline-flex"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={goToAuth}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-5 text-sm font-black text-[#02130b] shadow-[0_0_24px_rgba(34,197,94,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_34px_rgba(34,197,94,0.42)]"
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pb-11 pt-7 md:px-8 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[minmax(0,590px)_minmax(430px,1fr)] lg:pb-12 lg:pt-8">
          <div className="max-w-[610px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300 shadow-[0_0_20px_rgba(34,197,94,0.12)]">
              <ShieldCheck className="h-4 w-4" />
              Seu dinheiro no controle. Sempre.
            </div>

            <h1 className="mt-5 text-[clamp(3.1rem,8.8vw,4.5rem)] font-black leading-[0.98] tracking-[-0.045em] text-white md:text-[clamp(3.6rem,5.3vw,5.125rem)]">
              Pare de misturar
              <br />
              seu dinheiro e
              <br />
              descubra{" "}
              <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.18)]">
                quanto
                <br />
                você realmente ganha.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-300 md:text-base">
              O FluxoCerto 360 organiza seu dinheiro pessoal e do negócio, te dá clareza total e ajuda
              você a tomar decisões melhores todos os dias.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {HERO_BULLETS.map((item) => (
                <div
                  key={item}
                  className="flex h-11 items-center gap-2 rounded-xl border border-emerald-300/15 bg-white/[0.035] px-4 text-xs font-bold text-slate-100 backdrop-blur-xl"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goToAuth}
                className="inline-flex h-13 min-h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 py-4 text-sm font-black text-[#02130b] shadow-[0_14px_32px_rgba(34,197,94,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_34px_rgba(34,197,94,0.42)]"
              >
                Começar agora gratuitamente
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#como-funciona"
                className="inline-flex h-13 min-h-13 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.025] px-6 py-4 text-sm font-black text-white backdrop-blur-xl transition hover:scale-[1.02] hover:border-emerald-300/30 hover:bg-emerald-400/10"
              >
                <HelpCircle className="h-5 w-5" />
                Ver como funciona
              </a>
            </div>
          </div>

          <HeroMockup />
        </section>

        <section id="recursos" className="mx-auto w-full max-w-[1280px] border-t border-emerald-300/10 px-5 py-10 md:px-8 lg:py-11">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-white md:text-3xl">
              Tudo que você precisa para ter controle total
            </h2>
            <p className="mt-2 text-sm text-slate-400 md:text-base">Um sistema completo, pensado para sua vida real.</p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group min-h-[184px] rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-6 shadow-[0_18px_44px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:scale-[1.02] hover:border-emerald-300/28 hover:bg-emerald-400/[0.055] hover:shadow-[0_0_30px_rgba(34,197,94,0.14)]"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-7 text-base font-black text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="para-quem" className="mx-auto grid w-full max-w-[1280px] items-center gap-9 px-5 py-10 md:px-8 lg:grid-cols-[0.72fr_1fr] lg:py-11">
          <div>
            <h2 className="text-balance text-2xl font-black leading-tight tracking-[-0.035em] text-white md:text-4xl">
              Ferramenta feita para quem quer clareza e resultado de verdade
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400 md:text-base">
              Empreendedores, autônomos e pequenos negócios que decidiram ter controle de verdade.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-sm font-bold text-slate-200">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/25 bg-emerald-400/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </span>
                  {benefit}
                </div>
              ))}
            </div>

            <article className="mt-7 rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-6 backdrop-blur-xl">
              <p className="text-base font-bold leading-7 text-white">
                "Construído para quem trabalha por conta e precisa enxergar o lucro real sem complicação."
              </p>
            </article>
          </div>

          <ProductShowcase />
        </section>

        <section id="precos" className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 lg:py-12">
          <div className="grid overflow-hidden rounded-[28px] border border-emerald-300/18 bg-[radial-gradient(circle_at_18%_45%,rgba(34,197,94,0.28),transparent_34%),linear-gradient(135deg,rgba(7,35,27,0.94),rgba(2,6,23,0.92))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.30)] backdrop-blur-xl md:grid-cols-[0.65fr_1fr] md:p-8 lg:grid-cols-[0.72fr_1fr_0.9fr]">
            <div className="relative min-h-[230px] md:min-h-[260px]">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-[60px]" />
              <img
                src="/mascoteprincipal.png"
                alt="Mascote FluxoCerto"
                className="relative mx-auto h-[260px] max-w-full object-contain md:h-[300px]"
              />
            </div>

            <div className="flex flex-col justify-center py-4 md:pl-6">
              <h2 className="text-balance text-2xl font-black leading-tight tracking-[-0.035em] text-white md:text-4xl">
                Chegou a hora de ter clareza, controle e resultados.
              </h2>
              <div className="mt-6 grid gap-3">
                {CTA_BULLETS.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center md:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={goToAuth}
                className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 text-sm font-black text-[#02130b] shadow-[0_18px_40px_rgba(34,197,94,0.30)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,197,94,0.44)] md:mt-0"
              >
                Começar agora gratuitamente
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-emerald-300/10 bg-[#020617]/88">
        <div className="mx-auto grid w-full max-w-[1280px] gap-9 px-5 py-10 md:grid-cols-2 md:px-8 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_1fr]">
          <div>
            <img src="/logo-full.png" alt="FluxoCerto 360" className="h-10 w-auto object-contain" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              Sistema completo para organizar seu dinheiro pessoal e do negócio.
            </p>
          </div>

          <FooterColumn title="Produto" items={["Recursos", "Preços", "Atualizações", "Roadmap"]} />
          <FooterColumn title="Empresa" items={["Sobre nós", "Blog", "Carreiras", "Contato"]} />
          <FooterColumn title="Suporte" items={["Central de ajuda", "Tutoriais", "Privacidade", "Termos de uso"]} />

          <div className="rounded-2xl border border-emerald-300/12 bg-white/[0.035] p-5 backdrop-blur-xl">
            <Lock className="h-10 w-10 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-300" />
            <p className="mt-4 text-sm font-black text-white">Segurança bancária</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Seus dados protegidos com criptografia de ponta a ponta.
            </p>
          </div>
        </div>
        <p className="pb-7 text-center text-xs text-slate-500">© 2025 FluxoCerto 360. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[570px] lg:h-[560px]">
      <div className="absolute left-1/2 top-[47%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/22 bg-emerald-400/10 blur-[1px]" />
      <div className="absolute left-1/2 top-[46%] h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/16 blur-[70px]" />
      <div className="absolute right-8 top-16 hidden h-[170px] w-[170px] rounded-full bg-[radial-gradient(rgba(74,222,128,0.33)_1px,transparent_1px)] bg-[size:10px_10px] opacity-30 md:block" />

      <div className="absolute left-1/2 top-0 z-10 h-[462px] w-[236px] -translate-x-1/2 rounded-[42px] border border-white/24 bg-gradient-to-b from-slate-500/60 to-slate-950 p-2 shadow-[0_28px_72px_rgba(0,0,0,0.52)] md:h-[492px] md:w-[252px]">
        <div className="h-full overflow-hidden rounded-[34px] border border-white/10 bg-[#030b08] p-4">
          <div className="mx-auto h-5 w-24 rounded-full bg-black/75" />
          <div className="mt-5 flex items-center justify-between">
            <img src="/logo-full.png" alt="FluxoCerto" className="h-auto w-28 object-contain" />
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">
              360
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-300/14 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span>Resumo do mês</span>
              <span className="text-slate-500">Maio 2025</span>
            </div>
            <p className="mt-6 text-xs text-slate-400">Lucro real</p>
            <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-emerald-400">R$ 4.680,00</p>
            <p className="mt-2 text-xs font-bold text-emerald-300">+12% vs mês anterior</p>
            <div className="mt-4 h-28 rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,0.16),transparent)] p-3">
              <svg viewBox="0 0 220 92" className="h-full w-full">
                <path d="M4 76 C30 72 46 66 64 66 C88 67 94 58 116 54 C142 49 148 35 171 30 C192 25 202 16 216 10" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
                <path d="M4 76 C30 72 46 66 64 66 C88 67 94 58 116 54 C142 49 148 35 171 30 C192 25 202 16 216 10 L216 92 L4 92 Z" fill="url(#phoneGradient)" opacity="0.38" />
                <defs>
                  <linearGradient id="phoneGradient" x1="110" x2="110" y1="10" y2="92">
                    <stop stopColor="#22c55e" />
                    <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-0 top-16 z-20 hidden w-40 rounded-2xl border border-emerald-300/14 bg-[#05110e]/78 p-4 shadow-[0_16px_46px_rgba(0,0,0,0.34)] backdrop-blur-xl md:block">
        <Lock className="h-8 w-8 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-300" />
        <p className="mt-3 text-xs font-black text-white">Seus dados 100% protegidos</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">Segurança bancária de ponta a ponta.</p>
      </div>

      <div className="absolute bottom-5 left-1/2 z-30 w-[min(94vw,510px)] -translate-x-1/2 rotate-[-6deg] rounded-[24px] border border-emerald-300/18 bg-[#06110f]/88 p-5 shadow-[0_26px_72px_rgba(0,0,0,0.50)] backdrop-blur-2xl md:bottom-8 md:left-[53%]">
        <div className="grid gap-5 sm:grid-cols-[150px_1fr]">
          <div>
            <p className="text-sm font-black text-white">Distribuição de potes</p>
            <div className="mt-5 grid h-32 w-32 place-items-center rounded-full bg-[conic-gradient(#22c55e_0_50%,#0ea5e9_50%_90%,#fbbf24_90%_100%)]">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-[#06110f] text-center">
                <span className="text-sm font-black text-white">R$ 300,00</span>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-8">
            <PotRow label="Pessoal" amount="R$ 150,00 / R$ 200,00" percent="50%" color="emerald" />
            <PotRow label="Negócio" amount="R$ 120,00 / R$ 400,00" percent="40%" color="sky" />
            <PotRow label="Reserva" amount="R$ 30,00 / R$ 600,00" percent="10%" color="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PotRow({
  label,
  amount,
  percent,
  color,
}: {
  label: string;
  amount: string;
  percent: string;
  color: "emerald" | "sky" | "amber";
}) {
  const colorClass = color === "emerald" ? "bg-emerald-400 text-emerald-300" : color === "sky" ? "bg-sky-400 text-sky-300" : "bg-amber-300 text-amber-300";
  const widthClass = percent === "50%" ? "w-1/2" : percent === "40%" ? "w-[40%]" : "w-[10%]";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="text-slate-100">{label}</span>
        <span className={colorClass.split(" ")[1]}>{percent}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{amount}</p>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div className={`${widthClass} h-full rounded-full ${colorClass.split(" ")[0]}`} />
      </div>
    </div>
  );
}

function ProductShowcase() {
  return (
    <div id="como-funciona" className="relative min-h-[420px]">
      <div className="absolute inset-0 rounded-full bg-emerald-400/13 blur-[80px]" />
      <div className="relative mx-auto mt-4 w-full max-w-[760px]">
        <div className="rounded-t-[28px] border border-emerald-300/16 bg-gradient-to-b from-slate-700/70 to-[#07120f] p-3 shadow-[0_30px_85px_rgba(0,0,0,0.46)]">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#030b08]">
            <div className="grid min-h-[310px] grid-cols-[120px_1fr]">
              <aside className="border-r border-emerald-300/10 bg-black/24 p-4">
                <img src="/logo-full.png" alt="FluxoCerto" className="h-auto w-24 object-contain" />
                <div className="mt-6 grid gap-3 text-[11px] font-bold text-slate-400">
                  {["Início", "Fluxo de Caixa", "Potes", "Metas", "Consultor IA", "Relatórios"].map((item, index) => (
                    <span key={item} className={index === 0 ? "text-emerald-300" : ""}>{item}</span>
                  ))}
                </div>
              </aside>

              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DashboardCard title="Lucro líquido" value="R$ 4.680,00" tone="green" />
                  <DashboardCard title="Entradas" value="R$ 7.500,00" tone="green" />
                  <DashboardCard title="Saídas" value="R$ 2.820,00" tone="red" />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-emerald-300/10 bg-white/[0.035] p-4">
                    <p className="text-xs font-bold text-slate-300">Evolução financeira</p>
                    <div className="mt-3 h-32 rounded-xl bg-[linear-gradient(180deg,rgba(34,197,94,0.12),transparent)] p-3">
                      <svg viewBox="0 0 300 120" className="h-full w-full">
                        <path d="M8 102 C58 100 82 94 116 96 C154 98 170 48 198 45 C232 41 248 20 292 16" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/10 bg-white/[0.035] p-4">
                    <p className="text-xs font-bold text-slate-300">Distribuição de potes</p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[conic-gradient(#22c55e_0_50%,#0ea5e9_50%_90%,#fbbf24_90%_100%)]">
                        <div className="h-14 w-14 rounded-full bg-[#030b08]" />
                      </div>
                      <div className="grid gap-2 text-xs font-bold text-slate-300">
                        <span className="text-emerald-300">Pessoal 50%</span>
                        <span className="text-sky-300">Negócio 40%</span>
                        <span className="text-amber-300">Reserva 10%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto h-4 w-[84%] rounded-b-3xl bg-gradient-to-r from-slate-900 via-slate-500 to-slate-900" />

        <div className="absolute -bottom-8 right-2 w-36 rounded-[30px] border border-white/20 bg-gradient-to-b from-slate-700 to-slate-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.48)] sm:right-8 sm:w-44">
          <div className="rounded-[24px] border border-emerald-300/10 bg-[#030b08] p-3">
            <Smartphone className="ml-auto h-4 w-4 text-emerald-300" />
            <p className="mt-4 text-[11px] font-bold text-slate-400">Resumo do mês</p>
            <p className="mt-2 text-lg font-black text-emerald-300">R$ 4.680</p>
            <div className="mt-3 h-14 rounded-xl bg-[linear-gradient(180deg,rgba(34,197,94,0.16),transparent)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, tone }: { title: string; value: string; tone: "green" | "red" }) {
  return (
    <div className="rounded-2xl border border-emerald-300/10 bg-white/[0.035] p-4">
      <p className="text-[11px] font-bold text-slate-400">{title}</p>
      <p className={`mt-2 text-base font-black ${tone === "green" ? "text-emerald-300" : "text-red-300"}`}>{value}</p>
    </div>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-black text-white">{title}</h3>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <a key={item} href="#recursos" className="text-sm text-slate-400 transition hover:text-emerald-300">
            {item}
          </a>
        ))}
      </div>
    </div>
  );
}
