import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, Eye, Mic, Send, ShieldCheck, Sparkles, Square, WalletCards } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { getUserOnboardingData } from "@/lib/auth";
import {
  answerFluxQuestion,
  buildFluxPromptContext,
  calculateAvailableToday,
  generateLocalAction,
  getUserFinancialState,
  type FluxAdvisorContext,
  type FluxFinancialState,
} from "@/lib/fluxAdvisor";
import { formatCurrency } from "@/lib/utils";

type FluxSeverity = "safe" | "attention" | "risk";
type FluxMessageRole = "user" | "flux";

type FluxMessage = {
  id: string;
  role: FluxMessageRole;
  content: string;
  severity?: FluxSeverity;
  suggestedAction?: string;
};

const QUICK_QUESTIONS = [
  "Posso gastar hoje?",
  "Quanto tenho em caixa?",
  "Quanto faturei hoje?",
  "Onde estou perdendo dinheiro?",
  "Como melhorar meu lucro?",
  "Quanto falta pra minha meta?",
];

const STATE_COPY: Record<FluxFinancialState, { status: string; tone: FluxSeverity }> = {
  SEM_DADOS: {
    status: "Você ainda não colocou dinheiro no sistema",
    tone: "attention",
  },
  DESORGANIZADO: {
    status: "Se gastar hoje, aperta seu mês",
    tone: "risk",
  },
  SOBREVIVENDO: {
    status: "Se gastar hoje, aperta seu mês",
    tone: "risk",
  },
  CONTROLADO: {
    status: "Você tem margem controlada hoje",
    tone: "safe",
  },
  EVOLUINDO: {
    status: "Você tem margem controlada hoje",
    tone: "safe",
  },
  PERFORMANDO: {
    status: "Você tem margem controlada hoje",
    tone: "safe",
  },
};

const ONBOARDING_PAIN_MESSAGE: Record<string, string> = {
  mix_money: "Seu primeiro passo é separar o que é seu do que é do negócio.",
  money_disappears: "Seu primeiro passo é entender para onde o dinheiro está indo.",
  no_profit: "Seu primeiro passo é enxergar seu lucro real sem achismo.",
  no_reserve: "Seu primeiro passo é construir segurança financeira aos poucos.",
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scopeByUser<T extends { ownerId?: string }>(items: T[], userId?: string) {
  if (!userId) return items;
  return items.filter((item) => !item.ownerId || item.ownerId === userId);
}

function normalizeSeverity(value: unknown): FluxSeverity {
  return value === "safe" || value === "attention" || value === "risk" ? value : "safe";
}

function isApiAnswerUseful(
  data: Partial<{ answer: string; severity: FluxSeverity; suggestedAction: string }>,
  localAnswer: ReturnType<typeof answerFluxQuestion>
) {
  const answer = data.answer?.trim();
  if (!answer) return false;
  if (/modo local|ainda consigo te orientar|não consegui analisar/i.test(answer)) return false;
  if (localAnswer.requiresSpecificNumbers) {
    const localAmounts = localAnswer.answer.match(/R\$\s?[\d.,]+/g) ?? [];
    return localAmounts.length > 0 && localAmounts.every((amount) => answer.includes(amount));
  }
  return answer.length > 8;
}

export default function ConsultorModule() {
  const {
    user,
    transactions,
    pots,
    costs,
    paymentAccounts,
    adjustmentAccounts,
    potDistribution,
  } = useApp();

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<FluxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const lastSubmissionRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const activeRequestRef = useRef<string | null>(null);

  const {
    supported: voiceSupported,
    listening: voiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useBrowserSpeechRecognition("pt-BR");

  const onboardingData = useMemo(() => (user?.id ? getUserOnboardingData(user.id) : {}), [user?.id]);

  const advisorContext = useMemo<FluxAdvisorContext>(() => {
    return {
      transactions: scopeByUser(transactions, user?.id),
      pots: scopeByUser(pots, user?.id),
      costs: scopeByUser(costs, user?.id),
      paymentAccounts: scopeByUser(paymentAccounts, user?.id),
      adjustmentAccounts: scopeByUser(adjustmentAccounts, user?.id),
      potDistribution,
      metaMensal: onboardingData.metaMensal ?? 0,
    };
  }, [adjustmentAccounts, costs, onboardingData.metaMensal, paymentAccounts, potDistribution, pots, transactions, user?.id]);

  const promptContext = useMemo(() => buildFluxPromptContext(advisorContext), [advisorContext]);
  const availableToday = useMemo(() => calculateAvailableToday(advisorContext), [advisorContext]);
  const financialState = useMemo(() => getUserFinancialState(advisorContext), [advisorContext]);
  const localAction = useMemo(
    () => generateLocalAction(financialState, advisorContext),
    [advisorContext, financialState]
  );
  const stateCopy = STATE_COPY[financialState];
  const hasRealIncome = promptContext.entradasReais > 0;
  const dynamicButtonLabel = hasRealIncome ? "Ver onde estou gastando" : "Registrar primeira entrada";
  const dailyRevenueTarget = useMemo(() => {
    const savedProjection = Number(onboardingData.dailyRevenueTarget ?? onboardingData.projectedDailyGrossRevenue ?? 0);
    if (Number.isFinite(savedProjection) && savedProjection > 0) return savedProjection;

    const personalMonthlyGoal = Number(onboardingData.personalMonthlyGoal ?? onboardingData.metaMensal ?? 0);
    const personalPercentage = Number(potDistribution.personal);
    if (!Number.isFinite(personalMonthlyGoal) || personalMonthlyGoal <= 0 || personalPercentage <= 0) return 0;

    return Number(((personalMonthlyGoal / (personalPercentage / 100)) / 22).toFixed(2));
  }, [onboardingData.dailyRevenueTarget, onboardingData.metaMensal, onboardingData.personalMonthlyGoal, onboardingData.projectedDailyGrossRevenue, potDistribution.personal]);
  const onboardingInitialMessage = useMemo(() => {
    const painMessage = ONBOARDING_PAIN_MESSAGE[String(onboardingData.financialPain ?? "")] ?? "Seu primeiro passo é registrar seus dados reais com consistência.";
    const targetMessage =
      dailyRevenueTarget > 0
        ? `Para buscar sua meta, sua média diária estimada é de ${formatCurrency(dailyRevenueTarget)} de faturamento bruto.`
        : "Quando sua meta estiver definida, eu mostro sua média diária estimada de faturamento bruto.";

    return `${painMessage}\n${targetMessage}`;
  }, [dailyRevenueTarget, onboardingData.financialPain]);

  useEffect(() => {
    if (!voiceTranscript) return;
    setInputValue(voiceTranscript);
  }, [voiceTranscript]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const cleanText = text.trim();
    const now = Date.now();
    const normalizedText = cleanText.toLocaleLowerCase("pt-BR");
    const lastSubmission = lastSubmissionRef.current;
    const isRecentDuplicate = lastSubmission.text === normalizedText && now - lastSubmission.at < 1200;

    if (!cleanText || loadingRef.current || isRecentDuplicate) return;

    const requestId = createId("flux-request");
    loadingRef.current = true;
    activeRequestRef.current = requestId;
    lastSubmissionRef.current = { text: normalizedText, at: now };

    const userMessage: FluxMessage = {
      id: createId("user"),
      role: "user",
      content: cleanText,
    };
    const fluxResponseId = `${userMessage.id}-flux-response`;

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const localAnswer = answerFluxQuestion(cleanText, advisorContext);

    try {
      const res = await fetch("/api/flux-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanText,
          context: {
            ...promptContext,
            respostaLocalBase: localAnswer.answer,
            acaoLocalBase: localAnswer.suggestedAction,
            intencaoDetectada: localAnswer.intent,
          },
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = (await res.json()) as Partial<{
        answer: string;
        severity: FluxSeverity;
        suggestedAction: string;
      }>;
      const useAiAnswer = isApiAnswerUseful(data, localAnswer);

      const aiMessage: FluxMessage = {
        id: fluxResponseId,
        role: "flux",
        content: useAiAnswer ? data.answer?.trim() ?? localAnswer.answer : localAnswer.answer,
        severity: useAiAnswer ? normalizeSeverity(data.severity) : localAnswer.severity,
        suggestedAction: useAiAnswer ? data.suggestedAction || localAnswer.suggestedAction : localAnswer.suggestedAction,
      };

      if (activeRequestRef.current !== requestId) return;
      setMessages((prev) => (prev.some((message) => message.id === fluxResponseId) ? prev : [...prev, aiMessage]));
    } catch {
      const fallback: FluxMessage = {
        id: fluxResponseId,
        role: "flux",
        content: `${localAnswer.answer}\n\n${localAnswer.suggestedAction}`,
        severity: localAnswer.severity,
      };

      if (activeRequestRef.current !== requestId) return;
      setMessages((prev) => (prev.some((message) => message.id === fluxResponseId) ? prev : [...prev, fallback]));
    } finally {
      if (activeRequestRef.current === requestId) {
        activeRequestRef.current = null;
        loadingRef.current = false;
        setLoading(false);
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    }
  }

  const submitCurrentInput = () => {
    const text = inputValue.trim();
    if (!text || loadingRef.current) return;
    setInputValue("");
    void sendMessage(text);
  };

  return (
    <section className="fd-flux-consultor">
      <header className="fd-flux-consultor-head">
        <span>
          <Eye className="h-4 w-4" /> Consultor Flux
        </span>
        <h2>Flux viu seu dinheiro hoje</h2>
        <p>Decisão boa hoje = dinheiro sobrando amanhã</p>
      </header>

      <div className="fd-flux-hero-grid">
        <article className={`fd-flux-main-card ${stateCopy.tone}`}>
          <div>
            <span className="fd-flux-card-kicker">Hoje você pode usar com segurança</span>
            <strong>{formatCurrency(availableToday)}</strong>
            <p>{stateCopy.status}</p>
          </div>
          <div className="fd-flux-main-orbit">
            <WalletCards className="h-7 w-7" />
          </div>
        </article>

        <aside className="fd-flux-mascot-card">
          <div className="fd-flux-mascot-glow">
            <img
              src="/mascoterosto.png"
              alt="Flux"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <span>Flux está pronto</span>
            <p>Eu não invento número. Eu leio o que você registrou.</p>
          </div>
        </aside>

        <article className="fd-flux-action-card">
          <span>
            <ShieldCheck className="h-4 w-4" /> Melhor decisão agora
          </span>
          <strong>{localAction}</strong>
          <button
            type="button"
            className="fd-primary-btn"
            disabled={loading}
            onClick={() => {
              void sendMessage(hasRealIncome ? "Onde estou gastando mais?" : "Como registrar minha primeira entrada?");
            }}
          >
            {dynamicButtonLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </article>
      </div>

      <article className="fd-flux-chat-panel">
        <div className="fd-flux-chat-top">
          <div>
            <span>
              <Bot className="h-4 w-4" /> Chat financeiro
            </span>
            <h3>Pergunte sem medo. O Flux responde com seus dados reais.</h3>
          </div>
        </div>

        <div className="fd-flux-pills" aria-label="Perguntas inteligentes">
          {QUICK_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => {
                void sendMessage(question);
              }}
              disabled={loading}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {question}
            </button>
          ))}
        </div>

        <div className="fd-flux-message-list">
          {messages.length === 0 ? (
            <div className="fd-flux-empty-chat">
              <strong>{onboardingInitialMessage.split("\n")[0]}</strong>
              <p>{onboardingInitialMessage.split("\n")[1]}</p>
              <div className="fd-flux-empty-suggestions">
                {["Posso gastar hoje?", "Quanto tenho em caixa?", "Onde estou perdendo dinheiro?"].map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => {
                      void sendMessage(question);
                    }}
                    disabled={loading}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={`fd-flux-message-row ${message.role}`}>
              {message.role === "flux" ? (
                <span className="fd-flux-avatar">
                  <Bot className="h-4 w-4" />
                </span>
              ) : null}
              <div className={`fd-flux-bubble ${message.role} ${message.severity ?? ""}`}>
                {message.content.split("\n").map((line) => (
                  <p key={`${message.id}-${line}`}>{line}</p>
                ))}
                {message.suggestedAction ? <small>{message.suggestedAction}</small> : null}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="fd-flux-message-row flux">
              <span className="fd-flux-avatar">
                <Bot className="h-4 w-4" />
              </span>
              <div className="fd-flux-bubble flux attention fd-flux-loading">
                <span>Flux está analisando seus números...</span>
              </div>
            </div>
          ) : null}

          <div ref={scrollRef} />
        </div>

        <div className="fd-flux-input-shell">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Pergunte ao Flux sobre seu dinheiro..."
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitCurrentInput();
              }
            }}
          />
          <div className="fd-flux-input-actions">
            <button
              type="button"
              className={`fd-icon-btn ${voiceListening ? "active" : ""}`}
              onClick={() => (voiceListening ? stopVoice() : startVoice())}
              disabled={!voiceSupported}
              aria-label="Perguntar por voz"
              title="Perguntar por voz"
            >
              {voiceListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button type="button" className="fd-primary-btn" onClick={submitCurrentInput} disabled={!inputValue.trim() || loading}>
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>

        {voiceError ? <p className="fd-flux-voice-error">{voiceError}</p> : null}
      </article>
    </section>
  );
}
