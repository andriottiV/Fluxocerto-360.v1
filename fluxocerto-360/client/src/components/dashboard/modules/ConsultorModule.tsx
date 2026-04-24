import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";

import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { useApp } from "@/contexts/AppContext";
import { getUserOnboardingData } from "@/lib/auth";
import { runFinancialAdvisorEngine } from "@/lib/financialAdvisor";
import { PotType } from "@/lib/types";
import {
  answerConsultorConversation,
  type ConsultorConversationReply,
  type ConsultorRichCard,
} from "@/lib/consultorQuestion";

type ChatRole = "user" | "assistant";

type ConsultorChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  riskTone?: "positive" | "attention" | "critical";
  quickActions?: string[];
  richCards?: ConsultorRichCard[];
};

const QUICK_QUESTIONS = [
  "Posso investir agora?",
  "Onde estou gastando mais?",
  "Quanto posso guardar este mês?",
  "Posso fazer esse gasto hoje?",
  "Meu negócio está saudável?",
  "Quanto posso tirar para mim?",
];

const ACTION_TO_QUESTION: Record<string, string> = {
  "Ver valor sugerido": "Qual valor mais prudente para eu começar agora?",
  "Montar plano": "Monte um plano rápido para os próximos 14 dias.",
  "Entender o risco": "Explique o principal risco do meu momento.",
  "Mais opções": "Me dê mais opções para decidir com segurança.",
};

export default function ConsultorModule() {
  const { transactions, pots, user } = useApp();
  const [question, setQuestion] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [messages, setMessages] = useState<ConsultorChatMessage[]>([]);

  const responseRef = useRef<HTMLDivElement | null>(null);

  const {
    supported: voiceSupported,
    listening: voiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useBrowserSpeechRecognition("pt-BR");

  const advisor = useMemo(
    () => runFinancialAdvisorEngine({ transactions, pots, projectionDays: 30 }),
    [transactions, pots]
  );

  const reserveGoalProgressText = useMemo(() => {
    const reservePot =
      pots.find((pot) => pot.type === PotType.RESERVE) ?? pots.find((pot) => pot.name.toLowerCase().includes("reserv"));
    if (!reservePot) return "";
    const goalValue = reservePot.goalValue ?? reservePot.limit ?? 0;
    if (!Number.isFinite(goalValue) || goalValue <= 0) return "";
    const progress = Math.max(0, Math.min((reservePot.balance / goalValue) * 100, 999));
    return ` Você já atingiu ${progress.toFixed(0)}% da sua reserva. Continue assim.`;
  }, [pots]);

  const initialAdvisorMessage = useMemo(() => {
    const mode = user?.id ? getUserOnboardingData(user.id).financialMode : undefined;
    if (mode === "chaos") {
      return `Percebi que seu foco agora é sair do descontrole. Vou te ajudar a proteger seu dinheiro e evitar gastos que possam te apertar.${reserveGoalProgressText}`;
    }
    if (mode === "breakEven") {
      return `Seu objetivo agora é fazer sobrar. Vou te ajudar a enxergar para onde o dinheiro está indo.${reserveGoalProgressText}`;
    }
    if (mode === "surplus") {
      return `Você já consegue fazer sobrar um pouco. Agora o foco é fortalecer sua reserva e dar mais segurança para suas decisões.${reserveGoalProgressText}`;
    }
    if (mode === "growth") {
      return `Seu foco é crescimento. Vou te ajudar a acompanhar lucro, custos e oportunidades para evoluir com mais clareza.${reserveGoalProgressText}`;
    }
    return `Olá! 👋 Sou seu consultor financeiro. Estou aqui pra te ajudar a tomar decisões melhores com seu dinheiro.${reserveGoalProgressText}`;
  }, [reserveGoalProgressText, user?.id]);

  useEffect(() => {
    if (!voiceTranscript) return;
    setQuestion(voiceTranscript);
  }, [voiceTranscript]);

  useEffect(() => {
    const node = responseRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isResponding]);

  const appendConsultorReply = (reply: ConsultorConversationReply) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${reply.answer.id}`,
        role: "assistant",
        text: reply.message,
        riskTone: reply.riskTone,
        quickActions: reply.quickActions,
        richCards: reply.richCards,
      },
    ]);
  };

  const submitQuestion = async (customQuestion?: string) => {
    const prompt = (customQuestion ?? question).trim();
    if (!prompt || isResponding) return;

    setQuestion("");
    setIsResponding(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        text: prompt,
      },
    ]);

    await new Promise((resolve) => window.setTimeout(resolve, 220));

    const reply = answerConsultorConversation({
      question: prompt,
      advisor,
      transactions,
    });

    appendConsultorReply(reply);
    setIsResponding(false);
  };

  return (
    <section className="fd-consultor-page fd-consultor-clean-page">
      <article className="fd-panel fd-glass fd-consultor-clean-hero">
        <div className="fd-consultor-hero-copy">
          <h2>Flux, seu consultor inteligente</h2>
          <p>Converse com seu consultor financeiro e receba orientações práticas para decidir melhor hoje.</p>
          <span className="fd-consultor-hero-badge">IA do FluxoCerto</span>
        </div>
        <img
          src="/mascoteprincipal.png"
          alt="Flux, consultor inteligente"
          className="fd-consultor-hero-mascot mascote-principal-consultor"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </article>

      <article className="fd-panel fd-glass fd-consultor-compose-panel">
        <div className="fd-consultor-input-shell">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="fd-consultor-chat-input"
            rows={2}
            placeholder="Pergunte qualquer coisa sobre sua situação financeira..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitQuestion();
              }
            }}
          />

          <div className="fd-consultor-chat-actions">
            <button
              type="button"
              className={`fd-icon-btn ${voiceListening ? "active" : ""}`}
              onClick={() => (voiceListening ? stopVoice() : startVoice())}
              title="Perguntar por voz"
              aria-label="Perguntar por voz"
              disabled={!voiceSupported}
            >
              {voiceListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="fd-primary-btn"
              onClick={() => {
                void submitQuestion();
              }}
              disabled={!question.trim() || isResponding}
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>

        <p className="fd-consultor-examples">
          Ex.: Posso investir este mês? | Quanto posso gastar hoje sem me apertar? | Quanto posso tirar para mim?
        </p>

        <div className="fd-chip-row fd-consultor-suggestion-row">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className="fd-mini-chip"
              onClick={() => {
                void submitQuestion(item);
              }}
              disabled={isResponding}
            >
              {item}
            </button>
          ))}
        </div>
      </article>

      <article className="fd-panel fd-glass fd-consultor-response-panel">
        <div className="fd-consultor-response-headline">
          <h3>Resposta do consultor</h3>
          <p>Orientação clara, humana e baseada no seu momento atual.</p>
        </div>

        <div ref={responseRef} className="fd-consultor-response-list">
          {messages.length === 0 ? (
            <div className="fd-chat-bubble-wrap assistant fd-consultor-assistant-row">
              <img
                src="/mascoterosto.png"
                alt="Consultor Fluxo"
                className="fd-consultor-avatar"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <div className="fd-chat-bubble assistant fd-consultor-chat-card">
                <p>{initialAdvisorMessage}</p>
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="fd-chat-bubble-wrap user">
                <div className="fd-chat-bubble user">
                  {message.text.split("\n").map((line) => (
                    <p key={`${message.id}-${line}`}>{line}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div key={message.id} className="fd-chat-bubble-wrap assistant fd-consultor-assistant-row">
                <img
                  src="/mascoterosto.png"
                  alt="Consultor Fluxo"
                  className="fd-consultor-avatar"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <div className="fd-chat-bubble assistant fd-consultor-chat-card">
                  {message.text.split("\n").map((line) => (
                    <p key={`${message.id}-${line}`}>{line}</p>
                  ))}

                  {message.riskTone ? (
                    <span className={`fd-consultor-risk-chip ${message.riskTone}`}>
                      {message.riskTone === "critical" && "Atenção"}
                      {message.riskTone === "attention" && "Cautela"}
                      {message.riskTone === "positive" && "Seguro"}
                    </span>
                  ) : null}

                  {message.richCards && message.richCards.length > 0 ? (
                    <div className="fd-consultor-rich-grid">
                      {message.richCards.map((card) => (
                        <div key={`${message.id}-${card.title}`} className="fd-consultor-rich-card">
                          <strong>{card.title}</strong>
                          <p>{card.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {message.quickActions && message.quickActions.length > 0 ? (
                    <div className="fd-consultor-action-row">
                      {message.quickActions.slice(0, 3).map((action) => (
                        <button
                          key={`${message.id}-${action}`}
                          type="button"
                          className="fd-mini-btn"
                          onClick={() => {
                            void submitQuestion(ACTION_TO_QUESTION[action] ?? action);
                          }}
                        >
                          {action}
                        </button>
                      ))}
                      {message.quickActions.length > 3 ? (
                        <details className="fd-consultor-more-actions">
                          <summary>Mais opções</summary>
                          <div className="fd-consultor-more-actions-list">
                            {message.quickActions.slice(3).map((action) => (
                              <button
                                key={`${message.id}-extra-${action}`}
                                type="button"
                                className="fd-mini-btn"
                                onClick={() => {
                                  void submitQuestion(ACTION_TO_QUESTION[action] ?? action);
                                }}
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}

          {isResponding ? (
            <div className="fd-chat-bubble-wrap assistant fd-consultor-assistant-row">
              <img
                src="/mascoterosto.png"
                alt="Consultor Fluxo"
                className="fd-consultor-avatar"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <div className="fd-chat-bubble assistant loading fd-consultor-chat-card">
                <span className="fd-loading-chip">consultor analisando seu contexto...</span>
              </div>
            </div>
          ) : null}
        </div>

        {voiceError ? <p className="fd-consultor-voice-error">{voiceError}</p> : null}
      </article>
    </section>
  );
}
