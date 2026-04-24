import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ScreenType, User } from "@/lib/types";
import { isValidEmail, isValidPassword } from "@/lib/utils";
import { Eye, EyeOff, Lock, Mail, UserCircle2 } from "lucide-react";
import { authenticateUser, createAccount, requestPasswordReset } from "@/lib/auth";

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
      setError("Email e obrigatorio");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Email invalido");
      return;
    }

    if (mode !== "recover" && !password) {
      setError("Senha e obrigatoria");
      return;
    }

    if (mode !== "recover" && !isValidPassword(password)) {
      setError("Senha deve ter no minimo 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (mode === "recover") {
        const result = requestPasswordReset(email);
        if (!result.ok) {
          setError(result.error ?? "Nao foi possivel processar sua solicitacao");
          return;
        }
        setInfo(result.message ?? "Solicitacao enviada.");
        setMode("login");
        return;
      }

      if (mode === "register") {
        const created = createAccount({ name, email, password });
        if (!created.ok || !created.user) {
          setError(created.error ?? "Nao foi possivel criar a conta");
          return;
        }

        proceedAfterAuth(created.user, false);
        return;
      }

      const authenticated = authenticateUser(email, password);
      if (!authenticated.ok || !authenticated.user) {
        setError(authenticated.error ?? "Email ou senha incorretos");
        return;
      }

      proceedAfterAuth(authenticated.user, !!authenticated.onboardingCompleted);
    } catch {
      setError("Erro ao processar autenticacao");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030706] p-4 text-[#f6fffb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(25,245,193,0.14),transparent_28%),radial-gradient(circle_at_12%_16%,rgba(25,245,193,0.18),transparent_52%),radial-gradient(circle_at_86%_8%,rgba(17,199,157,0.14),transparent_34%),radial-gradient(circle_at_50%_110%,rgba(30,220,141,0.10),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(7,20,17,0.70),rgba(3,7,6,0.95))]" />

      <div className="relative z-10 w-full max-w-[500px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo-full.png"
            alt="FluxoCerto 360"
            className="mb-3 block h-auto w-[270px] sm:w-[310px]"
            style={{
              objectFit: "contain",
              filter: "brightness(1) contrast(2) saturate(2) drop-shadow(0 0 16px rgba(25,245,193,0.20))",
            }}
          />
          <p className="max-w-[440px] text-sm font-medium leading-6 tracking-[0.01em] text-[rgba(230,255,247,0.84)] sm:text-[15px]">
            Seu controle financeiro com clareza, velocidade e elegancia.
          </p>
        </div>

        <div className="rounded-[28px] border border-[rgba(92,255,196,0.20)] bg-[linear-gradient(165deg,rgba(8,24,20,0.76),rgba(6,16,14,0.68))] p-7 shadow-[0_24px_62px_rgba(0,0,0,0.50),0_0_0_1px_rgba(255,255,255,0.04)_inset,0_0_36px_rgba(25,245,193,0.08)] backdrop-blur-[18px] sm:p-8">
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === "register" ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-[rgba(230,255,247,0.88)]">Nome (opcional)</label>
                <div className="relative">
                  <UserCircle2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[rgba(203,255,236,0.52)]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError("");
                    }}
                    placeholder="Seu nome"
                    disabled={isLoading}
                    className="h-11 w-full rounded-2xl border border-[rgba(92,255,196,0.16)] bg-[rgba(9,27,23,0.58)] pl-10 pr-3 text-sm text-[#f6fffb] outline-none transition placeholder:text-[rgba(203,255,236,0.54)] focus:border-[rgba(25,245,193,0.62)] focus:ring-2 focus:ring-[rgba(25,245,193,0.22)]"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[rgba(230,255,247,0.88)]">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[rgba(203,255,236,0.52)]" />
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
                  className="h-11 w-full rounded-2xl border border-[rgba(92,255,196,0.16)] bg-[rgba(9,27,23,0.58)] pl-10 pr-3 text-sm text-[#f6fffb] outline-none transition placeholder:text-[rgba(203,255,236,0.54)] focus:border-[rgba(25,245,193,0.62)] focus:ring-2 focus:ring-[rgba(25,245,193,0.22)]"
                />
              </div>
            </div>

            {mode !== "recover" ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-[rgba(230,255,247,0.88)]">Senha</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[rgba(203,255,236,0.52)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="h-11 w-full rounded-2xl border border-[rgba(92,255,196,0.16)] bg-[rgba(9,27,23,0.58)] pl-10 pr-10 text-sm text-[#f6fffb] outline-none transition placeholder:text-[rgba(203,255,236,0.54)] focus:border-[rgba(25,245,193,0.62)] focus:ring-2 focus:ring-[rgba(25,245,193,0.22)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-[rgba(203,255,236,0.58)] transition hover:text-[#f6fffb]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/12 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            ) : null}
            {info ? (
              <div className="rounded-2xl border border-[rgba(92,255,196,0.28)] bg-[rgba(25,245,193,0.10)] px-3 py-2 text-xs text-[rgba(230,255,247,0.9)]">
                {info}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-2xl border border-[rgba(25,245,193,0.42)] bg-gradient-to-r from-[#11c79d] via-[#19f5c1] to-[#17dcae] text-sm font-bold text-[#03231a] shadow-[0_12px_28px_rgba(25,245,193,0.24)] transition hover:brightness-110 hover:shadow-[0_14px_30px_rgba(25,245,193,0.30)] disabled:opacity-65"
            >
              {isLoading
                ? mode === "register"
                  ? "Criando conta..."
                  : mode === "recover"
                    ? "Processando..."
                    : "Entrando..."
                : mode === "register"
                  ? "Criar conta"
                  : mode === "recover"
                    ? "Recuperar senha"
                    : "Entrar"}
            </button>

            {mode === "recover" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="h-10 w-full rounded-xl border border-transparent text-xs font-semibold text-[rgba(203,255,236,0.82)] transition hover:border-[rgba(92,255,196,0.2)] hover:bg-[rgba(10,28,24,0.7)]"
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
                  className="h-11 w-full rounded-2xl border border-[rgba(92,255,196,0.20)] bg-[rgba(8,23,20,0.44)] text-sm font-semibold text-[#f6fffb] transition hover:bg-[rgba(11,37,31,0.82)]"
                >
                  {mode === "login" ? "Criar conta" : "Ja tem conta? Entrar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("recover");
                    setError("");
                    setInfo("");
                  }}
                  className="h-10 w-full rounded-xl border border-transparent text-xs font-semibold text-[rgba(203,255,236,0.82)] transition hover:border-[rgba(92,255,196,0.2)] hover:bg-[rgba(10,28,24,0.7)]"
                >
                  Esqueci minha senha
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
