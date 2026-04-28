import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Edit3, Mic, Send, Square, Trash2, Sparkles } from "lucide-react";

import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { useApp } from "@/contexts/AppContext";
import { getUserOnboardingData } from "@/lib/auth";
import {
  buildTransactionPreview,
  cancelAssistantTransaction,
  editAssistantTransaction,
  confirmAssistantTransaction,
  formatCurrencyBRL,
  parseFinancialCommand,
  type AssistantBucket,
  type AssistantTransactionPreview,
} from "@/lib/consultorAssistant";
import {
  assistantActionLog,
  preventDuplicateResponse,
  preventCrossUserDataLeak,
  sanitizeUserInput,
  validateFinancialDataAvailability,
  type DuplicateResponseGuardState,
} from "@/lib/consultorSafety";
import {
  generateGoalInsights,
  markInsightAsRead as markInsightAsReadState,
  generateProactiveInsights,
  generateSmartNotifications,
  type SmartNotification,
} from "@/lib/consultorInsights";
import { runFinancialAdvisorEngine } from "@/lib/financialAdvisor";
import { PotType, TransactionType } from "@/lib/types";
import {
  type ConsultorRichCard,
} from "@/lib/consultorQuestion";
import { createInitialConversationState } from "@/lib/consultorAgent";
import { runFluxAiProvider } from "@/lib/fluxAiProvider";

type ChatRole = "user" | "assistant";

type PendingTransactionAction = {
  messageId: string;
  preview: AssistantTransactionPreview;
};

type ConsultorChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  riskTone?: "positive" | "attention" | "critical";
  quickActions?: string[];
  richCards?: ConsultorRichCard[];
  transactionPreview?: ReturnType<typeof buildTransactionPreview>;
};

const QUICK_QUESTIONS = [
  "Posso gastar hoje?",
  "Onde estou gastando mais?",
  "Criar plano de reserva",
  "Como ganhar mais dinheiro?",
  "Tenho risco de ficar negativo?",
];

const ACTION_TO_QUESTION: Record<string, string> = {
  "Ver valor sugerido": "Qual valor mais prudente para eu começar agora?",
  "Montar plano": "Monte um plano rápido para os próximos 14 dias.",
  "Entender o risco": "Explique o principal risco do meu momento.",
  "Mais opções": "Me dê mais opções para decidir com segurança.",
};

type FluxActionType = "create_reserve_plan";
export default function ConsultorModule() {
  const { transactions, pots, user, addTransaction, accounts, paymentAccounts, adjustmentAccounts, clients, services, salesItems, costs } = useApp();
  const [question, setQuestion] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [messages, setMessages] = useState<ConsultorChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingTransactionAction | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Partial<AssistantTransactionPreview> | null>(null);
  const [editingAction, setEditingAction] = useState<PendingTransactionAction | null>(null);
  const [readNotifications, setReadNotifications] = useState<Record<string, boolean>>({});
  const [conversationState, setConversationState] = useState(createInitialConversationState);

  const responseRef = useRef<HTMLDivElement | null>(null);
  const responsePanelRef = useRef<HTMLElement | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isSubmittingRef = useRef(false);
  const duplicateGuardRef = useRef<DuplicateResponseGuardState>({
    processingInput: null,
    lastProcessedInput: "",
    lastAssistantReply: "",
    lastUpdatedAt: 0,
  });

  const {
    supported: voiceSupported,
    listening: voiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useBrowserSpeechRecognition("pt-BR");

  const scopedTransactions = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: transactions }),
    [user?.id, transactions]
  );
  const scopedPots = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: pots }),
    [user?.id, pots]
  );
  const scopedPaymentAccounts = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: paymentAccounts }),
    [user?.id, paymentAccounts]
  );
  const scopedAdjustmentAccounts = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: adjustmentAccounts }),
    [user?.id, adjustmentAccounts]
  );
  const scopedClients = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: clients }),
    [user?.id, clients]
  );
  const scopedServices = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: services }),
    [user?.id, services]
  );
  const scopedSalesItems = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: salesItems }),
    [user?.id, salesItems]
  );
  const scopedCosts = useMemo(
    () => preventCrossUserDataLeak({ userId: user?.id, items: costs }),
    [user?.id, costs]
  );

  const advisor = useMemo(
    () => runFinancialAdvisorEngine({ transactions: scopedTransactions, pots: scopedPots, projectionDays: 30 }),
    [scopedTransactions, scopedPots]
  );

  const onboardingData = useMemo(
    () => (user?.id ? getUserOnboardingData(user.id) : {}),
    [user?.id]
  );

  const proactiveInsights = useMemo(
    () =>
      generateProactiveInsights({
        transactions: scopedTransactions,
        pots: scopedPots,
        paymentAccounts: scopedPaymentAccounts,
        fixedExpenses: onboardingData.fixedExpenses ?? [],
        clients: scopedClients,
        salesItems: scopedSalesItems,
        costs: scopedCosts,
      }),
    [scopedTransactions, scopedPots, scopedPaymentAccounts, onboardingData.fixedExpenses, scopedClients, scopedSalesItems, scopedCosts]
  );

  const goalInsights = useMemo(
    () => generateGoalInsights({ pots: scopedPots, transactions: scopedTransactions }),
    [scopedPots, scopedTransactions]
  );

  const smartNotifications = useMemo(
    () =>
      generateSmartNotifications({
        transactions: scopedTransactions,
        pots: scopedPots,
        paymentAccounts: scopedPaymentAccounts,
        fixedExpenses: onboardingData.fixedExpenses ?? [],
      }).map((item) => ({
        ...item,
        read: !!readNotifications[item.id],
      })),
    [scopedTransactions, scopedPots, scopedPaymentAccounts, onboardingData.fixedExpenses, readNotifications]
  );
  const primaryInsight = useMemo(() => {
    if (proactiveInsights.length === 0) return null;
    const levelWeight: Record<string, number> = {
      critical: 0,
      attention: 1,
      positive: 2,
    };
    return [...proactiveInsights].sort((a, b) => {
      const readRankA = readNotifications[a.id] ? 1 : 0;
      const readRankB = readNotifications[b.id] ? 1 : 0;
      if (readRankA !== readRankB) return readRankA - readRankB;
      return (levelWeight[a.level] ?? 99) - (levelWeight[b.level] ?? 99);
    })[0];
  }, [proactiveInsights, readNotifications]);
  const secondaryInsights = proactiveInsights.filter((insight) => insight.id !== primaryInsight?.id);
  const sortedSecondaryInsights = useMemo(
    () =>
      [...secondaryInsights].sort(
        (a, b) => Number(!!readNotifications[a.id]) - Number(!!readNotifications[b.id])
      ),
    [secondaryInsights, readNotifications]
  );
  const sortedSmartNotifications = useMemo(
    () =>
      [...smartNotifications].sort(
        (a, b) => Number(!!a.read) - Number(!!b.read)
      ),
    [smartNotifications]
  );
  const unreadSecondaryInsights = secondaryInsights.filter((insight) => !readNotifications[insight.id]).length;
  const unreadSmartNotifications = smartNotifications.filter((item) => !item.read).length;
  const hasSecondaryBlocks = secondaryInsights.length > 0 || goalInsights.length > 0 || smartNotifications.length > 0;
  const dataAvailability = useMemo(
    () =>
      validateFinancialDataAvailability({
        transactions: scopedTransactions,
        pots: scopedPots,
        adjustmentAccounts: scopedAdjustmentAccounts,
      }),
    [scopedAdjustmentAccounts, scopedPots, scopedTransactions]
  );
  const availableToday = advisor.snapshot.financialSummary.currentBalance;
  const topSituation = primaryInsight?.title ?? advisor.riscoPrincipal;
  const topAction = primaryInsight?.suggestedAction ?? goalInsights[0] ?? advisor.acaoImediata;

  const reserveGoalProgressText = useMemo(() => {
    const reservePot =
      scopedPots.find((pot) => pot.type === PotType.RESERVE) ?? scopedPots.find((pot) => pot.name.toLowerCase().includes("reserv"));
    if (!reservePot) return "";
    const goalValue = reservePot.goalValue ?? reservePot.limit ?? 0;
    if (!Number.isFinite(goalValue) || goalValue <= 0) return "";
    const progress = Math.max(0, Math.min((reservePot.balance / goalValue) * 100, 999));
    return ` Você já atingiu ${progress.toFixed(0)}% da sua reserva. Continue assim.`;
  }, [scopedPots]);

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
  }, [messages, isResponding, pendingAction]);

  const appendAssistantMessage = (message: Omit<ConsultorChatMessage, "id" | "role">) => {
    const duplicateCheck = preventDuplicateResponse({
      phase: "assistant_reply",
      text: message.text,
      state: duplicateGuardRef.current,
    });
    duplicateGuardRef.current = duplicateCheck.state;
    if (duplicateCheck.blocked && !message.transactionPreview) return;

    setMessages((prev) => {
      const lastMessage = prev.at(-1);
      const isDuplicatedAssistantReply =
        lastMessage?.role === "assistant" &&
        lastMessage.text.trim() === message.text.trim() &&
        !lastMessage.transactionPreview &&
        !message.transactionPreview;

      if (isDuplicatedAssistantReply) return prev;

      return [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          ...message,
        },
      ];
    });
  };

  const markInsightAsRead = (insightId: string) => {
    setReadNotifications((prev) => markInsightAsReadState(prev, insightId));
  };

  const triggerFluxAction = (actionType: FluxActionType) => {
    if (actionType === "create_reserve_plan") {
      responsePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      void submitQuestion("Flux, cria um plano simples para melhorar minha reserva.");
    }
  };


  const handleConfirmTransaction = () => {
    if (!pendingAction) return;
    const result = confirmAssistantTransaction({
      userId: user?.id,
      userConfirmed: true,
      preview: pendingAction.preview,
      addTransaction,
      accounts,
      pots: scopedPots,
    });

    if (result.ok) {
      appendAssistantMessage({
        text: `Lançamento confirmado com sucesso.\n${pendingAction.preview.type === TransactionType.INCOME ? "Entrada" : "Saída"} de ${formatCurrencyBRL(
          pendingAction.preview.amount
        )} registrada.`,
      });
      setPendingAction(null);
      setEditingAction(null);
      setPendingDraft(null);
      return;
    }

    appendAssistantMessage({
      text: `Não consegui salvar agora: ${result.error ?? "erro inesperado"}. Quer tentar editar e confirmar novamente?`,
      riskTone: "attention",
    });
  };

  const handleCancelTransaction = () => {
    if (!pendingAction) return;
    cancelAssistantTransaction();
    if (user?.id) {
      assistantActionLog.append({
        userId: user.id,
        action: "assistant_transaction",
        status: "cancelled",
        summary: "Usuário cancelou lançamento sugerido pelo assistente.",
      });
    }
    appendAssistantMessage({
      text: "Perfeito, cancelado. Nenhum lançamento foi salvo.",
    });
    setPendingAction(null);
    setEditingAction(null);
    setPendingDraft(null);
  };

  const handleSaveEditedPreview = () => {
    if (!editingAction) return;
    const normalizedPreview = editAssistantTransaction(editingAction.preview, {});
    if (!normalizedPreview.description.trim() || normalizedPreview.amount <= 0) {
      appendAssistantMessage({
        text: "Para confirmar, preciso de descrição e valor maior que zero.",
        riskTone: "attention",
      });
      return;
    }
    setPendingAction({
      ...editingAction,
      preview: normalizedPreview,
    });
    setEditingAction(null);
  };

  const submitQuestion = async (customQuestion?: string) => {
    const prompt = sanitizeUserInput(customQuestion ?? question);
    if (!prompt || isResponding || isSubmittingRef.current) return;

    const inputDedupeCheck = preventDuplicateResponse({
      phase: "start_input",
      text: prompt,
      state: duplicateGuardRef.current,
    });
    duplicateGuardRef.current = inputDedupeCheck.state;
    if (inputDedupeCheck.blocked) return;

    isSubmittingRef.current = true;

    try {
      if (user?.id) {
        assistantActionLog.append({
          userId: user.id,
          action: "assistant_question",
          status: "requested",
          summary: `Pergunta recebida: ${prompt.slice(0, 120)}`,
        });
      }

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

      await new Promise((resolve) => window.setTimeout(resolve, 180));

      const agentResult = await runFluxAiProvider({
        userId: user?.id,
        userMessage: prompt,
        userFinancialData: {
          advisor,
          transactions: scopedTransactions,
          pots: scopedPots,
          adjustmentAccounts: scopedAdjustmentAccounts,
          clients: scopedClients,
          services: scopedServices,
        },
        conversationState,
      });
      setConversationState(agentResult.nextState);

      if (agentResult.mode === "action") {
        const pendingFromApi = agentResult.pendingAction as
          | {
              type: "transaction_preview";
              preview: ReturnType<typeof buildTransactionPreview>;
              raw: AssistantTransactionPreview;
            }
          | undefined;

        if (pendingFromApi?.type === "transaction_preview" && pendingFromApi.raw) {
          setPendingDraft(null);
          const messageId = `assistant-preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              text: agentResult.response || "Entendi assim:",
              transactionPreview: pendingFromApi.preview,
            },
          ]);
          setPendingAction({
            messageId,
            preview: pendingFromApi.raw,
          });
          if (user?.id) {
            assistantActionLog.append({
              userId: user.id,
              action: "assistant_transaction",
              status: "requested",
              summary: `Prévia criada para ${pendingFromApi.raw.type} de ${formatCurrencyBRL(pendingFromApi.raw.amount)}.`,
            });
          }
          setEditingAction(null);
          return;
        }

        const parseResult = parseFinancialCommand(prompt, pendingDraft);
        if (!parseResult.preview) {
          setPendingDraft(parseResult.draft ?? null);
          appendAssistantMessage({
            text:
              parseResult.followUpQuestion ??
              "Quase lá. Me passe mais detalhes para eu montar o lançamento com segurança.",
            riskTone: "attention",
          });
          return;
        }

        setPendingDraft(null);
        const builtPreview = buildTransactionPreview(parseResult.preview);
        const messageId = `assistant-preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: "assistant",
            text: "Entendi assim:",
            transactionPreview: builtPreview,
          },
        ]);
        setPendingAction({
          messageId,
          preview: parseResult.preview,
        });
        if (user?.id) {
          assistantActionLog.append({
            userId: user.id,
            action: "assistant_transaction",
            status: "requested",
            summary: `Prévia criada para ${parseResult.preview.type} de ${formatCurrencyBRL(parseResult.preview.amount)}.`,
          });
        }
        setEditingAction(null);
        return;
      }
      appendAssistantMessage({
        text: agentResult.response,
        riskTone: agentResult.riskTone,
        quickActions: agentResult.suggestedActions.length > 0 ? agentResult.suggestedActions : undefined,
      });
    } finally {
      duplicateGuardRef.current = preventDuplicateResponse({
        phase: "finish_input",
        text: prompt,
        state: duplicateGuardRef.current,
      }).state;
      isSubmittingRef.current = false;
      setIsResponding(false);
      window.setTimeout(() => questionInputRef.current?.focus(), 50);
    }
  };

  return (
    <section className="fd-consultor-page fd-consultor-clean-page">
      <article className="fd-panel fd-glass fd-consultor-insights-panel">
        <div className="fd-panel-head">
          <h3>Flux analisou seu momento</h3>
          <p>Resumo rápido para você decidir com clareza.</p>
        </div>
        <div
          className={`fd-consultor-mini-card fd-consultor-primary-insight ${
            primaryInsight?.level ?? "attention"
          }`}
        >
          <div className="fd-consultor-summary-grid">
            <div className="fd-consultor-summary-item">
              <span>Disponível hoje</span>
              <strong>{formatCurrencyBRL(availableToday)}</strong>
            </div>
            <div className="fd-consultor-summary-item">
              <span>Situação principal</span>
              <strong>{dataAvailability.ok ? topSituation : "Dados insuficientes por enquanto"}</strong>
            </div>
            <div className="fd-consultor-summary-item">
              <span>Melhor ação agora</span>
              <strong>
                {dataAvailability.ok ? topAction : "Cadastre algumas entradas e saídas para o Flux entender melhor seu momento."}
              </strong>
            </div>
          </div>
          <div className="fd-consultor-summary-actions">
            {primaryInsight ? (
              <span className={`fd-consultor-level ${primaryInsight.level}`}>
                {primaryInsight.level === "critical" ? "Crítico" : primaryInsight.level === "attention" ? "Atenção" : "Positivo"}
              </span>
            ) : null}
            <button
              type="button"
              className="fd-primary-btn"
              onClick={() => triggerFluxAction("create_reserve_plan")}
            >
              Criar plano simples
            </button>
          </div>
        </div>

        {hasSecondaryBlocks ? (
          <details className="fd-consultor-secondary-details">
            <summary>
              Ver alertas secundários
              {unreadSecondaryInsights + unreadSmartNotifications > 0 ? (
                <small>{unreadSecondaryInsights + unreadSmartNotifications} não lidos</small>
              ) : null}
            </summary>

            {secondaryInsights.length > 0 ? (
              <div className="fd-consultor-mini-cards fd-consultor-secondary-cards">
                {sortedSecondaryInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`fd-consultor-mini-card ${insight.level} ${readNotifications[insight.id] ? "read" : ""}`}
                  >
                    <div className="fd-consultor-mini-card-head">
                      <span className={`fd-consultor-level ${insight.level}`}>
                        {insight.level === "critical" ? "Crítico" : insight.level === "attention" ? "Atenção" : "Positivo"}
                      </span>
                      {!readNotifications[insight.id] ? (
                        <button
                          type="button"
                          className="fd-mini-btn fd-insight-read-btn"
                          onClick={() => markInsightAsRead(insight.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar como lido
                        </button>
                      ) : (
                        <span className="fd-insight-read-label">Lido</span>
                      )}
                    </div>
                    <div className="fd-consultor-mini-card-body">
                      <div className="fd-consultor-mini-card-title">
                        <Sparkles className="h-4 w-4" />
                        <strong>{insight.title}</strong>
                      </div>
                      <p>{insight.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {goalInsights.length > 0 ? (
              <div className="fd-consultor-goals">
                {goalInsights.slice(0, 2).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}

            <div className="fd-consultor-notification-center">
              <div className="fd-consultor-notification-head">
                <h4>
                  <Bell className="h-4 w-4" /> Alertas inteligentes
                </h4>
                {unreadSmartNotifications > 0 ? <small>{unreadSmartNotifications} não lidos</small> : null}
              </div>
              {smartNotifications.length > 0 ? (
                <div className="fd-consultor-notification-list">
                  {sortedSmartNotifications.map((notification: SmartNotification) => (
                    <div key={notification.id} className={`fd-consultor-notification-item ${notification.level} ${notification.read ? "read" : ""}`}>
                      <div>
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                      </div>
                      {!notification.read ? (
                        <button
                          type="button"
                          className="fd-mini-btn fd-insight-read-btn"
                          onClick={() => markInsightAsRead(notification.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar como lido
                        </button>
                      ) : (
                        <span className="fd-insight-read-label">Lido</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="fd-empty">Sem alertas críticos no momento.</p>
              )}
            </div>
          </details>
        ) : null}
      </article>
      <article className="fd-panel fd-glass fd-consultor-compose-panel">
        <div className="fd-consultor-input-shell">
          <textarea
            ref={questionInputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="fd-consultor-chat-input"
            rows={2}
            placeholder="Pergunte ou peça algo ao Flux..."
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
          Ex.: "Adicione gasto de R$ 50 com Uber hoje" | "Registra entrada de R$ 120 no Pix"
        </p>

        <div className="fd-consultor-compose-headline">
          <h4>Ações rápidas</h4>
          <p>Use um atalho para conversar com o Flux sem digitar tudo.</p>
        </div>

        <div className="fd-chip-row fd-consultor-suggestion-row">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className="fd-mini-chip"
              onClick={() => {
                if (item === "Criar plano de reserva") {
                  triggerFluxAction("create_reserve_plan");
                  return;
                }
                void submitQuestion(item);
              }}
              disabled={isResponding}
            >
              {item}
            </button>
          ))}
        </div>
      </article>

      <article ref={responsePanelRef} className="fd-panel fd-glass fd-consultor-response-panel">
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

                  {message.transactionPreview ? (
                    <div className="fd-consultor-preview-card">
                      <strong>Entendi assim:</strong>
                      <p>{message.transactionPreview.typeLabel}: {message.transactionPreview.amountLabel}</p>
                      <p>Categoria: {message.transactionPreview.category}</p>
                      <p>Conta/Pote: {message.transactionPreview.bucketLabel}</p>
                      <p>Descrição: {message.transactionPreview.description}</p>
                      {message.transactionPreview.serviceName ? <p>Serviço: {message.transactionPreview.serviceName}</p> : null}
                      {message.transactionPreview.clientName ? <p>Cliente: {message.transactionPreview.clientName}</p> : null}
                      <p>Data: {message.transactionPreview.dateLabel}</p>
                      <p>Pagamento: {message.transactionPreview.paymentLabel}</p>
                      <p>Confirmar lançamento?</p>

                      {pendingAction?.messageId === message.id ? (
                        <div className="fd-consultor-preview-actions">
                          <button type="button" className="fd-primary-btn" onClick={handleConfirmTransaction}>
                            <Check className="h-4 w-4" />
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="fd-mini-btn"
                            onClick={() => setEditingAction(pendingAction)}
                          >
                            <Edit3 className="h-4 w-4" />
                            Editar
                          </button>
                          <button type="button" className="fd-mini-btn" onClick={handleCancelTransaction}>
                            <Trash2 className="h-4 w-4" />
                            Cancelar
                          </button>
                        </div>
                      ) : null}

                      {editingAction?.messageId === message.id ? (
                        <div className="fd-consultor-preview-editor">
                          <label>
                            Valor
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editingAction.preview.amount}
                              onChange={(event) =>
                                setEditingAction((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        preview: editAssistantTransaction(prev.preview, {
                                          amount: Number(event.target.value),
                                        }),
                                      }
                                    : prev
                                )
                              }
                            />
                          </label>
                          <label>
                            Descrição
                            <input
                              type="text"
                              value={editingAction.preview.description}
                              onChange={(event) =>
                                setEditingAction((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        preview: editAssistantTransaction(prev.preview, {
                                          description: event.target.value,
                                        }),
                                      }
                                    : prev
                                )
                              }
                            />
                          </label>
                          <label>
                            Categoria
                            <input
                              type="text"
                              value={editingAction.preview.category}
                              onChange={(event) =>
                                setEditingAction((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        preview: editAssistantTransaction(prev.preview, {
                                          category: event.target.value,
                                        }),
                                      }
                                    : prev
                                )
                              }
                            />
                          </label>
                          <label>
                            Conta/Pote
                            <select
                              value={editingAction.preview.bucket}
                              onChange={(event) =>
                                setEditingAction((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        preview: editAssistantTransaction(prev.preview, {
                                          bucket: event.target.value as AssistantBucket,
                                        }),
                                      }
                                    : prev
                                )
                              }
                            >
                              <option value="pessoal">Pessoal</option>
                              <option value="negocio">Negócio</option>
                              <option value="reserva">Reserva</option>
                              <option value="auto">Automático</option>
                            </select>
                          </label>
                          <label>
                            Cliente
                            <input
                              type="text"
                              value={editingAction.preview.clientName ?? ""}
                              onChange={(event) =>
                                setEditingAction((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        preview: editAssistantTransaction(prev.preview, {
                                          clientName: event.target.value,
                                        }),
                                      }
                                    : prev
                                )
                              }
                            />
                          </label>
                          <div className="fd-consultor-preview-actions">
                            <button type="button" className="fd-primary-btn" onClick={handleSaveEditedPreview}>
                              Salvar edição
                            </button>
                            <button type="button" className="fd-mini-btn" onClick={() => setEditingAction(null)}>
                              Fechar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

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
                            if (action.toLocaleLowerCase("pt-BR").includes("plano")) {
                              triggerFluxAction("create_reserve_plan");
                              return;
                            }
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
                                  if (action.toLocaleLowerCase("pt-BR").includes("plano")) {
                                    triggerFluxAction("create_reserve_plan");
                                    return;
                                  }
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
                <span className="fd-loading-chip">Flux pensando...</span>
              </div>
            </div>
          ) : null}
        </div>

        {voiceError ? <p className="fd-consultor-voice-error">{voiceError}</p> : null}
      </article>
    </section>
  );
}
