import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { ScreenType, User } from "@/lib/types";
import { isValidEmail, isValidPassword } from "@/lib/utils";
import { AuthService, requestPasswordReset } from "@/lib/auth";

type AuthMode = "login" | "register" | "recover";

export default function LoginScreen() {
  const { goScreen, setUser } = useApp();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const proceedAfterAuth = (nextUser: User, onboardingCompleted: boolean) => {
    setUser(nextUser);
    goScreen(onboardingCompleted ? ScreenType.DASHBOARD : ScreenType.ONBOARDING);
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Email é obrigatório");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Email inválido");
      return;
    }

    if (mode !== "recover" && !password) {
      setError("Senha é obrigatória");
      return;
    }

    if (mode !== "recover" && !isValidPassword(password)) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (mode === "recover") {
        const result = requestPasswordReset(email);
        if (!result.ok) {
          setError(result.error ?? "Não foi possível processar sua solicitação");
          return;
        }
        setInfo(result.message ?? "Solicitação enviada.");
        setMode("login");
        return;
      }

      if (mode === "register") {
        const created = await AuthService.register({ name, email, password });
        if (!created.ok || !created.user) {
          setError(created.error ?? "Não foi possível criar a conta");
          return;
        }

        proceedAfterAuth(created.user, false);
        return;
      }

      const authenticated = await AuthService.login(email, password);
      if (!authenticated.ok || !authenticated.user) {
        setError(authenticated.error ?? "Email ou senha incorretos");
        return;
      }

      proceedAfterAuth(authenticated.user, !!authenticated.onboardingCompleted);
    } catch {
      setError("Erro ao processar autenticação");
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    mode === "register" ? "Crie sua conta" : mode === "recover" ? "Recupere seu acesso" : "Entrar na sua conta";
  const subtitle =
    mode === "register"
      ? "Comece a organizar seu dinheiro em poucos minutos."
      : mode === "recover"
        ? "Informe seu email para receber as instruções."
        : "Continue de onde parou.";
  const submitLabel = mode === "register" ? "Criar conta" : mode === "recover" ? "Recuperar senha" : "Entrar";
  const loadingLabel = mode === "register" ? "Criando conta..." : mode === "recover" ? "Processando..." : "Entrando...";

  return (
    <div
      className="fc-auth min-h-screen overflow-x-hidden bg-[#020617] text-white antialiased"
      style={{ fontFamily: '"Gotan", "Inter", "Montserrat", "Arial", sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_55%_110%,rgba(34,197,94,0.12),transparent_40%),linear-gradient(150deg,#020617_0%,#030b0a_52%,#020617_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:30px_30px] opacity-[0.07]" />

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_minmax(450px,540px)]">
        <section className="hidden min-h-screen flex-col justify-between gap-8 border-r border-emerald-300/10 px-10 py-8 lg:flex xl:px-14">
          <div className="flex min-h-12 items-center">
            <BrandLogo
              variant="full"
              className="h-11 w-auto min-w-[174px] max-w-[210px] object-contain drop-shadow-[0_0_18px_rgba(34,197,94,0.14)]"
            />
          </div>

          <div className="max-w-[620px] py-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-[0_0_24px_rgba(34,197,94,0.08)]">
              <ShieldCheck className="h-4 w-4" />
              Acesso seguro ao seu painel
            </div>

            <h1 className="mt-6 max-w-[560px] text-[clamp(2.75rem,4.2vw,4.15rem)] font-black leading-[1.02] tracking-[-0.02em] text-white">
              Acesse seu controle financeiro.
            </h1>

            <p className="mt-5 max-w-[520px] text-base leading-7 text-slate-300">
              Entre para continuar organizando seu dinheiro pessoal e do negócio com clareza.
            </p>

            <div className="mt-7 grid gap-3.5">
              {["Separe pessoal e negócio", "Veja seu lucro real", "Tome decisões melhores"].map((benefit) => (
                <div key={benefit} className="flex min-w-0 items-center gap-3.5 text-sm font-bold leading-6 text-slate-100">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-emerald-400/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-lg rounded-3xl border border-emerald-300/12 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300 shadow-[0_20px_54px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            Seu acesso permanece protegido enquanto você acompanha fluxo, clientes, custos e decisões importantes do negócio.
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-6 sm:px-8 lg:px-10">
          <div className="w-full max-w-[460px]">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandLogo variant="full" className="h-11 w-auto min-w-[172px] max-w-[220px] object-contain" />
            </div>

            <div className="rounded-[28px] border border-emerald-300/14 bg-[#05110e]/78 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300/90">
                  FluxoCerto 360
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.02em] text-white sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {mode === "register" ? (
                  <Field label="Nome (opcional)" icon={<UserCircle2 className="h-4 w-4" />}>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setError("");
                      }}
                      placeholder="Seu nome"
                      disabled={isLoading}
                      className="h-12 w-full rounded-2xl border border-emerald-300/14 bg-black/24 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-60"
                    />
                  </Field>
                ) : null}

                <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setInfo("");
                    }}
                    placeholder="seu@email.com"
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-emerald-300/14 bg-black/24 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-60"
                  />
                </Field>

                {mode !== "recover" ? (
                  <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                      }}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className="h-12 w-full rounded-2xl border border-emerald-300/14 bg-black/24 pl-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-slate-400 transition hover:bg-emerald-400/10 hover:text-white disabled:opacity-60"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </Field>
                ) : null}

                {error ? (
                  <div className="flex gap-3 rounded-2xl border border-red-400/24 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                    <span>{error}</span>
                  </div>
                ) : null}

                {info ? (
                  <div className="flex gap-3 rounded-2xl border border-emerald-300/22 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{info}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 text-sm font-black text-[#02130b] shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(34,197,94,0.42)] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingLabel}
                    </>
                  ) : (
                    <>
                      {submitLabel}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {mode === "recover" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="h-11 w-full rounded-2xl border border-emerald-300/14 bg-white/[0.025] text-sm font-bold text-slate-100 transition hover:border-emerald-300/28 hover:bg-emerald-400/10"
                  >
                    Voltar para entrar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode((prev) => (prev === "login" ? "register" : "login"));
                        setError("");
                        setInfo("");
                      }}
                      className="h-11 w-full rounded-2xl border border-emerald-300/16 bg-white/[0.025] text-sm font-bold text-slate-100 transition hover:border-emerald-300/32 hover:bg-emerald-400/10"
                    >
                      {mode === "login" ? "Criar conta" : "Já tem conta? Entrar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setError("");
                        setInfo("");
                      }}
                      className="h-9 w-full rounded-xl text-xs font-bold text-emerald-200/85 transition hover:bg-emerald-400/8 hover:text-emerald-100"
                    >
                      Esqueci minha senha
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-200">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

