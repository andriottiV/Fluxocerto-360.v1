import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  Lock,
  Shield,
  ShieldCheck,
  User,
  Wallet,
  Zap,
  BarChart3,
  TrendingUp,
  Check,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";

const PROBLEM_ITEMS = [
  { icon: Wallet, text: "Mistura dinheiro pessoal com o do trabalho" },
  { icon: CircleHelp, text: "Não sabe se pode gastar ou não" },
  { icon: CalendarDays, text: "Fica perdido no fim do mês" },
  { icon: TrendingUp, text: "Trabalha muito mas não sabe o lucro real" },
];

export default function LandingScreen() {
  const { goScreen } = useApp();
  const [logoSrc, setLogoSrc] = useState("/logo-full.png");
  const [iconSrc, setIconSrc] = useState("/icon.png");

  const goToAuth = () => goScreen(ScreenType.LOGIN);

  return (
    <div
      className="relative min-h-screen max-w-full overflow-x-hidden bg-[#020b08] text-[#f6fffb] box-border [&_*]:box-border"
      style={{ fontFamily: "Inter, Poppins, Segoe UI, Roboto, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_6%,rgba(18,214,122,0.18),transparent_35%),radial-gradient(circle_at_78%_18%,rgba(34,197,94,0.14),transparent_40%),radial-gradient(circle_at_52%_115%,rgba(18,214,122,0.11),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,#020b08,#03110c_44%,#020b08)]" />

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-8 lg:px-16 xl:px-24">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center">
            <img
              src={logoSrc}
              alt="FluxoCerto 360"
              onError={() => setLogoSrc("/icon.png")}
              className="h-auto w-[212px] max-w-full sm:w-[262px]"
              style={{ objectFit: "contain" }}
            />
          </div>

          <button
            type="button"
            onClick={goToAuth}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[rgba(41,207,123,0.40)] bg-[rgba(5,21,16,0.62)] px-4 text-sm font-semibold text-[#d5ffea] transition hover:border-[rgba(101,241,116,0.62)] hover:shadow-[0_0_18px_rgba(34,197,94,0.24)]"
          >
            <Lock className="h-3.5 w-3.5" />
            Acesse sua conta
          </button>
        </header>

        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,520px)] lg:justify-between xl:gap-12">
          <div className="w-full max-w-[640px]">
            <h1 className="max-w-[640px] text-balance text-[2rem] font-black leading-[1.04] tracking-[-0.02em] text-white sm:text-[2.9rem] lg:text-[3.65rem]">
              Pare de misturar seu dinheiro e descubra quanto você <span className="text-[#5ff16d]">realmente ganha.</span>
            </h1>

            <p className="mt-4 text-base font-semibold leading-relaxed text-[rgba(222,255,240,0.92)] sm:text-lg">
              <span className="text-[#5ff16d]">FluxoCerto 360:</span> Onde seu dinheiro pessoal e seu negócio param de brigar.
            </p>

            <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(205,239,224,0.82)] sm:text-base">
              Se você trabalha por conta, sabe como é: entra dinheiro, sai dinheiro... e no fim do mês você não sabe quanto sobrou de verdade.
            </p>

            <button
              type="button"
              onClick={goToAuth}
              className="mt-7 inline-flex h-14 items-center gap-2 rounded-2xl border border-[rgba(99,242,116,0.52)] bg-gradient-to-r from-[#65f174] to-[#16c784] px-8 text-[17px] font-black text-[#022316] shadow-[0_14px_34px_rgba(34,197,94,0.30)] transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(101,241,116,0.44)]"
            >
              Começar agora
              <ArrowRight className="h-5 w-5" />
            </button>

            <div className="mt-6 grid gap-3 text-sm text-[rgba(211,247,229,0.84)] sm:grid-cols-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-[#62f173]" /> Seguro e privado
              </span>
              <span className="inline-flex items-center gap-2 font-semibold">
                <BarChart3 className="h-4 w-4 text-[#62f173]" /> Simples de usar
              </span>
              <span className="inline-flex items-center gap-2 font-semibold">
                <Zap className="h-4 w-4 text-[#62f173]" /> Resultados reais
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[360px] overflow-visible py-3 sm:max-w-[420px] lg:mx-0 lg:ml-auto lg:max-w-[420px] xl:max-w-[520px]">
            <div className="pointer-events-none absolute left-1/2 top-[47%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[rgba(91,241,111,0.62)] sm:h-[380px] sm:w-[380px] xl:h-[430px] xl:w-[430px]" />
            <div className="pointer-events-none absolute left-1/2 top-[47%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(20,204,110,0.30),rgba(20,204,110,0.08)_44%,transparent_72%)] blur-lg sm:h-[370px] sm:w-[370px] xl:h-[420px] xl:w-[420px]" />
            <div className="pointer-events-none absolute right-2 top-[150px] h-[140px] w-[140px] rounded-full bg-[radial-gradient(rgba(102,255,170,0.30)_1px,transparent_1px)] bg-[size:10px_10px] opacity-35 sm:h-[160px] sm:w-[160px] xl:h-[190px] xl:w-[190px]" />

            <div className="relative z-10 mx-auto h-[500px] w-[258px] rounded-[40px] border border-[rgba(129,157,145,0.66)] bg-[linear-gradient(180deg,#0c1412,#06100d)] p-[9px] shadow-[0_28px_70px_rgba(0,0,0,0.5),0_0_28px_rgba(34,197,94,0.16)] sm:h-[540px] sm:w-[278px] sm:rounded-[42px] sm:p-[10px] xl:h-[574px] xl:w-[296px] xl:rounded-[44px]">
              <div className="h-full w-full rounded-[30px] border border-[rgba(66,98,84,0.84)] bg-[linear-gradient(180deg,#08120f,#040a08)] p-3.5 sm:rounded-[32px] sm:p-4 xl:rounded-[34px]">
                <div className="mx-auto mb-4 h-[23px] w-[122px] rounded-full bg-[rgba(16,36,29,0.96)]" />

                <div className="rounded-2xl border border-[rgba(59,225,130,0.20)] bg-[rgba(9,29,21,0.72)] px-3 py-2">
                  <img
                    src="/logo-full.png"
                    alt="FluxoCerto"
                    className="h-auto w-[108px]"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />

                  <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-[rgba(214,255,236,0.86)]">
                    <span>Resumo do mês</span>
                    <span className="text-[rgba(163,213,186,0.8)]">Maio 2025</span>
                  </div>

                  <div className="mt-2 rounded-xl border border-[rgba(66,233,138,0.20)] bg-[rgba(10,35,25,0.78)] p-3">
                    <p className="text-[12px] text-[rgba(178,236,202,0.80)]">Lucro real</p>
                    <p className="mt-1 text-[31px] font-black leading-none text-[#38d970] sm:text-[33px] xl:text-[35px]">R$ 4.680,00</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#69f58b]">+12% vs mês anterior</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-20 mx-auto mt-4 grid w-full max-w-[336px] grid-cols-3 gap-2 sm:max-w-[372px] sm:gap-2.5 lg:absolute lg:left-1/2 lg:top-[308px] lg:mt-0 lg:w-[378px] lg:max-w-[378px] lg:-translate-x-1/2 xl:top-[330px] xl:w-[444px] xl:max-w-[444px]">
              <div className="rounded-xl border border-[rgba(45,204,113,0.28)] bg-[rgba(8,33,24,0.86)] p-2 backdrop-blur-xl sm:rounded-2xl sm:p-2.5 xl:p-3">
                <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[rgba(40,215,117,0.18)] text-[#7eff96] sm:h-7 sm:w-7 sm:rounded-xl xl:h-8 xl:w-8">
                  <User className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-bold text-[#cffff0] sm:text-[12px] xl:text-[13px]">Pessoal</p>
                <p className="mt-1 text-xs font-black leading-none text-[#44e370] sm:text-[13px] xl:text-base">R$ 2.100,00</p>
              </div>

              <div className="rounded-xl border border-[rgba(64,161,255,0.32)] bg-[rgba(10,28,43,0.86)] p-2 backdrop-blur-xl sm:rounded-2xl sm:p-2.5 xl:p-3">
                <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[rgba(64,161,255,0.18)] text-[#7fc4ff] sm:h-7 sm:w-7 sm:rounded-xl xl:h-8 xl:w-8">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-bold text-[#d7ebff] sm:text-[12px] xl:text-[13px]">Negócio</p>
                <p className="mt-1 text-xs font-black leading-none text-[#3ea8ff] sm:text-[13px] xl:text-base">R$ 3.800,00</p>
              </div>

              <div className="rounded-xl border border-[rgba(243,187,59,0.33)] bg-[rgba(37,28,10,0.86)] p-2 backdrop-blur-xl sm:rounded-2xl sm:p-2.5 xl:p-3">
                <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[rgba(243,187,59,0.2)] text-[#ffd56c] sm:h-7 sm:w-7 sm:rounded-xl xl:h-8 xl:w-8">
                  <Lock className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-bold text-[#ffebb2] sm:text-[12px] xl:text-[13px]">Reserva</p>
                <p className="mt-1 text-xs font-black leading-none text-[#f6bf34] sm:text-[13px] xl:text-base">R$ 1.200,00</p>
              </div>
            </div>

            <div className="absolute bottom-[20px] left-1/2 z-20 w-[96%] -translate-x-1/2 rounded-2xl border border-[rgba(53,214,120,0.20)] bg-[rgba(9,31,23,0.86)] px-3 py-2.5 backdrop-blur-xl sm:bottom-[24px] sm:px-4 sm:py-3 xl:bottom-[28px]">
              <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[#31d86f] sm:text-[12px] xl:text-[13px]">Entradas</p>
                  <p className="text-[11px] font-black leading-none text-white sm:text-[13px] xl:text-base">R$ 8.650,00</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#f56e6e] sm:text-[12px] xl:text-[13px]">Saídas</p>
                  <p className="text-[11px] font-black leading-none text-[#ff5d5d] sm:text-[13px] xl:text-base">- R$ 3.970,00</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#d6ab4b] sm:text-[12px] xl:text-[13px]">Taxas/Custos</p>
                  <p className="text-[11px] font-black leading-none text-[#f5b74a] sm:text-[13px] xl:text-base">- R$ 1.080,00</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.70)] px-5 py-4 shadow-[0_12px_34px_rgba(0,0,0,0.30)] backdrop-blur-[12px]">
          <h2 className="text-[42px] font-black leading-none tracking-[-0.02em] text-white sm:text-[34px] lg:text-[44px]">Você trabalha... mas não vê o dinheiro</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-0">
            {PROBLEM_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.text}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 xl:rounded-none xl:px-5 ${index < 3 ? "xl:border-r xl:border-[rgba(44,123,84,0.45)]" : ""}`}
                >
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(57,195,113,0.34)] bg-[rgba(10,36,26,0.78)] text-[#66ef85]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold leading-snug text-[rgba(223,250,236,0.88)]">{item.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-4">
          <article className="relative overflow-hidden rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.70)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-[12px]">
            <h3 className="text-[30px] font-black leading-tight text-[#62ef79] sm:text-[22px]">O FluxoCerto organiza tudo pra você</h3>
            <p className="mt-3 text-[15px] leading-6 text-[rgba(212,244,227,0.86)]">
              Com um sistema simples, você separa seu dinheiro automaticamente e entende exatamente o que é seu, o que é do negócio e o que pode gastar.
            </p>
            <div className="absolute bottom-3 right-3 h-[96px] w-[82px] rotate-6 rounded-2xl border border-[rgba(101,241,116,0.30)] bg-[linear-gradient(160deg,rgba(16,64,42,0.8),rgba(9,30,22,0.6))] p-3">
              <div className="mt-7 grid grid-cols-4 gap-1">
                <span className="h-4 rounded-sm bg-[#3ed76f]" />
                <span className="h-7 rounded-sm bg-[#53f178]" />
                <span className="h-10 rounded-sm bg-[#2ec867]" />
                <span className="h-8 rounded-sm bg-[#61ff83]" />
              </div>
            </div>
          </article>

          <article className="rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.70)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-[12px]">
            <h3 className="text-[30px] font-black leading-tight text-white sm:text-[22px]">Seu dinheiro separado do jeito certo</h3>
            <ul className="mt-4 space-y-4 text-[15px]">
              <li className="flex gap-3 text-[rgba(212,244,227,0.87)]"><span className="mt-1 h-3 w-3 rounded-full bg-[#62ef79]" />Pessoal<br /><span className="text-[rgba(185,228,207,0.8)]">Seu dinheiro para viver</span></li>
              <li className="flex gap-3 text-[rgba(212,244,227,0.87)]"><span className="mt-1 h-3 w-3 rounded-full bg-[#40a8ff]" />Negócio<br /><span className="text-[rgba(185,228,207,0.8)]">O dinheiro que mantém seu trabalho funcionando</span></li>
              <li className="flex gap-3 text-[rgba(212,244,227,0.87)]"><span className="mt-1 h-3 w-3 rounded-full bg-[#f0bf4d]" />Reserva<br /><span className="text-[rgba(185,228,207,0.8)]">Segurança para não ser pego de surpresa</span></li>
            </ul>
          </article>

          <article className="rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.70)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-[12px]">
            <h3 className="text-[30px] font-black leading-tight text-[#62ef79] sm:text-[22px]">Saiba quanto você realmente ganha</h3>
            <p className="mt-3 text-[15px] leading-6 text-[rgba(212,244,227,0.86)]">
              O app considera taxas, custos e gastos reais. Você não vê só o dinheiro que entrou, mas o que sobrou de verdade.
            </p>
            <svg className="mt-5 h-[88px] w-full" viewBox="0 0 260 88" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 74L35 56L60 62L85 44L108 48L130 36L153 42L178 28L202 20L228 10L254 4" stroke="rgba(99,242,116,0.92)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="35" cy="56" r="3" fill="#62ef79" />
              <circle cx="85" cy="44" r="3" fill="#62ef79" />
              <circle cx="130" cy="36" r="3" fill="#62ef79" />
              <circle cx="178" cy="28" r="3" fill="#62ef79" />
              <circle cx="228" cy="10" r="3" fill="#62ef79" />
            </svg>
          </article>

          <article className="relative overflow-hidden rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.70)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-[12px]">
            <h3 className="text-[30px] font-black leading-tight text-white sm:text-[22px]">Se você trabalha por conta, isso aqui é pra você</h3>
            <p className="mt-3 text-[15px] leading-6 text-[rgba(212,244,227,0.86)]">Chega de viver no escuro financeiro. Comece hoje a organizar sua vida e seu negócio.</p>
            <button
              type="button"
              onClick={goToAuth}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(99,242,116,0.48)] bg-gradient-to-r from-[#65f174] to-[#16c784] px-6 text-sm font-black text-[#032516] shadow-[0_12px_24px_rgba(34,197,94,0.3)] transition hover:scale-[1.02] hover:shadow-[0_0_26px_rgba(101,241,116,0.42)]"
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </button>
            <img
              src={iconSrc}
              alt="Marca"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-28 opacity-[0.13]"
            />
          </article>
        </section>

        <section className="mt-4 rounded-[20px] border border-[rgba(34,197,94,0.18)] bg-[rgba(4,24,18,0.72)] px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-[12px]">
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-[rgba(8,32,23,0.66)] px-4 py-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(39,205,118,0.2)] text-[#6ef58a]"><Lock className="h-4 w-4" /></div>
              <p className="text-[14px] leading-5 text-[rgba(217,247,232,0.9)]"><strong className="text-white">Seus dados 100% protegidos</strong><br />Privacidade é prioridade</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[rgba(8,32,23,0.66)] px-4 py-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(39,205,118,0.2)] text-[#6ef58a]"><Check className="h-4 w-4" /></div>
              <p className="text-[14px] leading-5 text-[rgba(217,247,232,0.9)]"><strong className="text-white">Feito para quem trabalha por conta</strong><br />Autônomos, freelancers e pequenos negócios</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[rgba(8,32,23,0.66)] px-4 py-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(39,205,118,0.2)] text-[#6ef58a]"><Shield className="h-4 w-4" /></div>
              <p className="text-[14px] leading-5 text-[rgba(217,247,232,0.9)]"><strong className="text-white">Sem complicação</strong><br />Tudo simples, direto e prático</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
