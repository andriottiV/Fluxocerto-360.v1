import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CreditCard, HandCoins, Mic, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import { PaymentMethod, TransactionType } from "@/lib/types";
import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { parseFinancialVoiceCommand, type ParsedVoiceCommand } from "@/lib/voice/financialVoiceParser";

type TransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  presetType?: TransactionType.INCOME | TransactionType.EXPENSE;
  startVoiceOnOpen?: boolean;
  onVoiceStateChange?: (
    state: "idle" | "listening" | "processing" | "error" | "ready_for_confirmation"
  ) => void;
};

const INCOME_PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Debito" },
  { value: "credito", label: "Credito" },
  { value: "transferencia", label: "Transferencia" },
];

const EXPENSE_CATEGORIES = [
  "insumos",
  "aluguel",
  "transporte",
  "alimentacao",
  "contas fixas",
  "marketing",
  "manutencao",
  "equipamentos",
  "taxas",
  "impostos",
  "assinatura/app",
  "pessoal",
  "outros",
] as const;

type ExpenseForm = {
  value: string;
  description: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  date: string;
  potId: string;
};

type ManualIncomeForm = {
  value: string;
  description: string;
  category: string;
  origin: string;
  paymentMethod?: PaymentMethod;
  customDateEnabled: boolean;
  date: string;
};

type VoicePreviewForm = {
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  amount: string;
  category: string;
  description: string;
  date: string;
  areaHint: "pessoal" | "negocio" | "reserva" | "indefinido";
  paymentMethod?: PaymentMethod;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  presetType = TransactionType.INCOME,
  startVoiceOnOpen = false,
  onVoiceStateChange,
}: TransactionModalProps) {
  const { accounts, pots, services, addTransaction } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [type, setType] = useState<TransactionType.INCOME | TransactionType.EXPENSE>(presetType);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [servicePayment, setServicePayment] = useState<PaymentMethod | null>(null);

  const [manualIncome, setManualIncome] = useState<ManualIncomeForm>({
    value: "",
    description: "",
    category: "extra",
    origin: "",
    paymentMethod: undefined,
    customDateEnabled: false,
    date: todayIso(),
  });

  const [expense, setExpense] = useState<ExpenseForm>({
    value: "",
    description: "",
    category: EXPENSE_CATEGORIES[0],
    date: todayIso(),
    potId: "",
  });
  const [voiceDraft, setVoiceDraft] = useState<ParsedVoiceCommand | null>(null);
  const [voicePreview, setVoicePreview] = useState<VoicePreviewForm | null>(null);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceAutoStarted, setVoiceAutoStarted] = useState(false);

  const {
    supported: voiceSupported,
    listening: voiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useBrowserSpeechRecognition("pt-BR");

  const defaultAccount = accounts[0]?.name ?? "Conta Corrente";

  const personalPot = useMemo(() => pots.find((pot) => pot.name.toLowerCase().includes("pess")) ?? pots[0], [pots]);
  const businessPot = useMemo(() => pots.find((pot) => pot.name.toLowerCase().includes("neg")) ?? pots[0], [pots]);
  const reservePot = useMemo(() => pots.find((pot) => pot.name.toLowerCase().includes("reserv")) ?? pots[0], [pots]);

  useEffect(() => {
    if (!isOpen) return;
    setType(presetType);
    setIsSaving(false);
    setSelectedServiceId(null);
    setServicePayment(null);
    setManualIncome({
      value: "",
      description: "",
      category: "extra",
      origin: "",
      paymentMethod: undefined,
      customDateEnabled: false,
      date: todayIso(),
    });
    setExpense({
      value: "",
      description: "",
      category: EXPENSE_CATEGORIES[0],
      date: todayIso(),
      potId: personalPot?.id ?? "",
    });
    setVoiceDraft(null);
    setVoicePreview(null);
    setVoiceProcessing(false);
    setVoiceAutoStarted(false);
  }, [isOpen, presetType, personalPot?.id]);

  useEffect(() => {
    if (!isOpen || !startVoiceOnOpen || voiceAutoStarted || !voiceSupported) return;
    setVoiceAutoStarted(true);
    window.setTimeout(() => {
      startVoice();
    }, 120);
  }, [isOpen, startVoiceOnOpen, voiceAutoStarted, voiceSupported, startVoice]);

  useEffect(() => {
    if (!voiceTranscript) return;
    setVoiceProcessing(true);
    const draft = parseFinancialVoiceCommand(voiceTranscript);
    setVoiceDraft(draft);
    setVoicePreview({
      type: draft.type ?? TransactionType.EXPENSE,
      amount: draft.amount ? String(draft.amount) : "",
      category: draft.category ?? (draft.type === TransactionType.INCOME ? "extra" : EXPENSE_CATEGORIES[0]),
      description: draft.description ?? "",
      date: draft.date,
      areaHint: draft.areaHint,
      paymentMethod: draft.paymentMethod,
    });
    setVoiceProcessing(false);
  }, [voiceTranscript]);

  useEffect(() => {
    if (!onVoiceStateChange) return;
    if (!isOpen) {
      onVoiceStateChange("idle");
      return;
    }

    if (voiceError) {
      onVoiceStateChange("error");
      return;
    }
    if (voiceListening) {
      onVoiceStateChange("listening");
      return;
    }
    if (voiceProcessing) {
      onVoiceStateChange("processing");
      return;
    }
    if (voiceDraft) {
      onVoiceStateChange("ready_for_confirmation");
      return;
    }
    onVoiceStateChange("idle");
  }, [isOpen, onVoiceStateChange, voiceDraft, voiceError, voiceListening, voiceProcessing]);

  if (!isOpen) return null;

  const closeModal = () => {
    setIsSaving(false);
    onClose();
  };

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;

  const voiceStatus = voiceError
    ? "erro"
    : voiceListening
      ? "ouvindo"
      : voiceProcessing
        ? "processando"
        : voiceDraft
          ? "confirmacao"
          : "pronto";

  const applyVoicePreview = () => {
    if (!voicePreview?.type || !voicePreview.amount || Number(voicePreview.amount) <= 0) {
      toast.error("Comando incompleto. Revise e ajuste os campos manualmente.");
      return;
    }

    const mappedPotId =
      voicePreview.areaHint === "reserva"
        ? reservePot?.id
        : voicePreview.areaHint === "negocio"
          ? businessPot?.id
          : personalPot?.id;

    if (voicePreview.type === TransactionType.INCOME) {
      setType(TransactionType.INCOME);
      setManualIncome((prev) => ({
        ...prev,
        value: voicePreview.amount,
        description: voicePreview.description || prev.description,
        category: voicePreview.category || prev.category,
        origin:
          voicePreview.areaHint === "negocio"
            ? "Negocio"
            : voicePreview.areaHint === "pessoal"
              ? "Pessoal"
              : prev.origin,
        paymentMethod: voicePreview.paymentMethod ?? prev.paymentMethod,
        customDateEnabled: true,
        date: voicePreview.date,
      }));
      toast.success("Comando de voz aplicado. Revise os dados e confirme.");
      return;
    }

    const categoryCandidate = voicePreview.category || EXPENSE_CATEGORIES[0];
    const validCategory = EXPENSE_CATEGORIES.includes(categoryCandidate as (typeof EXPENSE_CATEGORIES)[number])
      ? (categoryCandidate as (typeof EXPENSE_CATEGORIES)[number])
      : EXPENSE_CATEGORIES[0];

    setType(TransactionType.EXPENSE);
    setExpense((prev) => ({
      ...prev,
      value: voicePreview.amount,
      description: voicePreview.description || prev.description,
      category: validCategory,
      date: voicePreview.date,
      potId: mappedPotId ?? prev.potId,
    }));
    toast.success("Comando de voz aplicado. Revise os dados e confirme.");
  };

  const saveServiceIncome = () => {
    if (!selectedService) {
      toast.error("Selecione um servico para lancamento rapido");
      return;
    }
    if (!servicePayment) {
      toast.error("Escolha a forma de pagamento");
      return;
    }

    setIsSaving(true);
    const result = addTransaction({
      type: TransactionType.INCOME,
      amount: selectedService.price,
      description: selectedService.name,
      category: "servico",
      date: todayIso(),
      account: defaultAccount,
      paymentMethod: servicePayment,
      potId: businessPot?.id,
      origin: "Lancamento rapido",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Falha ao salvar entrada");
      setIsSaving(false);
      return;
    }

    toast.success("Entrada registrada");
    onSuccess?.();
    closeModal();
  };

  const saveManualIncome = () => {
    if (!manualIncome.value || Number(manualIncome.value) <= 0) {
      toast.error("Informe um valor valido para entrada manual");
      return;
    }
    if (!manualIncome.paymentMethod) {
      toast.error("Escolha a forma de pagamento");
      return;
    }

    setIsSaving(true);
    const result = addTransaction({
      type: TransactionType.INCOME,
      amount: Number(manualIncome.value),
      description: manualIncome.description.trim() || "Entrada extra",
      category: manualIncome.category.trim() || "extra",
      date: manualIncome.customDateEnabled ? manualIncome.date : todayIso(),
      account: defaultAccount,
      paymentMethod: manualIncome.paymentMethod,
      potId: businessPot?.id,
      origin: manualIncome.origin.trim() || "Extra",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Falha ao salvar entrada manual");
      setIsSaving(false);
      return;
    }

    toast.success("Entrada manual registrada");
    onSuccess?.();
    closeModal();
  };

  const saveExpense = () => {
    if (!expense.value || Number(expense.value) <= 0) {
      toast.error("Informe um valor valido para saida");
      return;
    }
    if (!expense.description.trim()) {
      toast.error("Descricao obrigatoria");
      return;
    }
    if (!expense.potId) {
      toast.error("Selecione o pote de origem");
      return;
    }

    setIsSaving(true);
    const result = addTransaction({
      type: TransactionType.EXPENSE,
      amount: Number(expense.value),
      description: expense.description,
      category: expense.category,
      date: expense.date || todayIso(),
      account: defaultAccount,
      potId: expense.potId,
      origin: "Saida rapida",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Falha ao salvar saida");
      setIsSaving(false);
      return;
    }

    toast.success("Saida registrada");
    onSuccess?.();
    closeModal();
  };

  return (
    <div className="fd-modal-backdrop" role="dialog" aria-modal="true">
      <div className="fd-modal-card fd-transaction-flow">
        <div className="fd-modal-head">
          <h3>{type === TransactionType.INCOME ? "Nova entrada" : "Nova saida"}</h3>
          <button type="button" className="fd-icon-btn" onClick={closeModal}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-transaction-switch">
          <button
            type="button"
            className={type === TransactionType.INCOME ? "active" : ""}
            onClick={() => setType(TransactionType.INCOME)}
          >
            Entrada
          </button>
          <button
            type="button"
            className={type === TransactionType.EXPENSE ? "active" : ""}
            onClick={() => setType(TransactionType.EXPENSE)}
          >
            Saida
          </button>
        </div>

        <section className="fd-flow-panel fd-voice-panel">
          <div className="fd-flow-title">
            <Mic className="h-4 w-4" />
            <span>Comando de voz (beta)</span>
          </div>

          {voiceSupported ? (
            <>
              <div className="fd-voice-status-row">
                <span
                  className={`fd-voice-status-chip ${voiceStatus}`}
                  aria-live="polite"
                >
                  {voiceStatus === "ouvindo" && "Ouvindo..."}
                  {voiceStatus === "processando" && "Processando..."}
                  {voiceStatus === "confirmacao" && "Aguardando confirmacao"}
                  {voiceStatus === "erro" && "Falha na captura"}
                  {voiceStatus === "pronto" && "Pronto para ouvir"}
                </span>

                <button
                  type="button"
                  className="fd-mini-btn"
                  onClick={() => (voiceListening ? stopVoice() : startVoice())}
                  title={voiceListening ? "Parar escuta" : "Iniciar escuta"}
                >
                  {voiceListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
              </div>

              <p className="fd-voice-hint">
                Exemplo: "entrou 150 de corte", "gastei 120 com produto", "separei 100 para reserva".
              </p>

              {voiceError ? <p className="fd-voice-error">{voiceError}</p> : null}

              {voiceDraft ? (
                <div className="fd-voice-review">
                  <div className="fd-voice-review-head">
                    <strong>{voiceDraft.summary}</strong>
                    {voiceDraft.ambiguous ? (
                      <span className="fd-voice-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Comando ambiguo
                      </span>
                    ) : null}
                  </div>
                  <p>"{voiceDraft.rawText}"</p>
                  <small>
                    Tipo: {voiceDraft.type ?? "--"} | Valor: {voiceDraft.amount ? `R$ ${voiceDraft.amount.toFixed(2)}` : "--"} |
                    Categoria: {voiceDraft.category ?? "--"} | Area: {voiceDraft.areaHint}
                  </small>
                  {voiceDraft.missingFields.length > 0 ? (
                    <small className="fd-voice-error">
                      Campos incertos: {voiceDraft.missingFields.join(", ")}.
                    </small>
                  ) : null}

                  {voicePreview ? (
                    <div className="fd-voice-preview-grid">
                      <label>
                        Tipo
                        <select
                          value={voicePreview.type}
                          onChange={(event) =>
                            setVoicePreview((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    type: event.target.value as TransactionType.INCOME | TransactionType.EXPENSE,
                                  }
                                : prev
                            )
                          }
                        >
                          <option value={TransactionType.INCOME}>entrada</option>
                          <option value={TransactionType.EXPENSE}>saida</option>
                        </select>
                      </label>
                      <label>
                        Valor
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={voicePreview.amount}
                          onChange={(event) =>
                            setVoicePreview((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label>
                        Categoria
                        <input
                          value={voicePreview.category}
                          onChange={(event) =>
                            setVoicePreview((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label>
                        Descricao
                        <input
                          value={voicePreview.description}
                          onChange={(event) =>
                            setVoicePreview((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label>
                        Data
                        <input
                          type="date"
                          value={voicePreview.date}
                          onChange={(event) =>
                            setVoicePreview((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="fd-voice-review-actions">
                    <button type="button" className="fd-ghost-btn" onClick={applyVoicePreview}>
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="fd-mini-btn"
                      onClick={() => {
                        setVoiceDraft(null);
                        setVoicePreview(null);
                      }}
                    >
                      Cancelar comando
                    </button>
                    <button
                      type="button"
                      className="fd-mini-btn"
                      onClick={() => {
                        setVoiceDraft(null);
                        setVoicePreview(null);
                        startVoice();
                      }}
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="fd-voice-fallback">
              <p>Reconhecimento de voz nao disponivel neste navegador.</p>
              <small>Voce pode continuar registrando manualmente normalmente.</small>
            </div>
          )}
        </section>

        {type === TransactionType.INCOME ? (
          <div className="fd-income-flow">
            <section className="fd-flow-panel">
              <div className="fd-flow-title">
                <Sparkles className="h-4 w-4" />
                <span>Lancamento rapido por servico</span>
              </div>

              <div className="fd-chip-grid">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className={`fd-chip ${selectedServiceId === service.id ? "active" : ""}`}
                    onClick={() => setSelectedServiceId(service.id)}
                  >
                    <span>{service.name}</span>
                    <strong>R$ {service.price.toFixed(2)}</strong>
                  </button>
                ))}
              </div>

              <div className="fd-flow-subtitle">
                <CreditCard className="h-4 w-4" />
                <span>Forma de pagamento</span>
              </div>

              <div className="fd-chip-row">
                {INCOME_PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`fd-mini-chip ${servicePayment === option.value ? "active" : ""}`}
                    onClick={() => setServicePayment(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button type="button" className="fd-primary-btn fd-flow-submit" disabled={isSaving} onClick={saveServiceIncome}>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar entrada
              </button>
            </section>

            <section className="fd-flow-panel fd-flow-panel-muted">
              <div className="fd-flow-title">
                <HandCoins className="h-4 w-4" />
                <span>Entrada manual (extra)</span>
              </div>

              <div className="fd-flow-grid">
                <label>
                  Valor R$
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={manualIncome.value}
                    onChange={(event) => setManualIncome((prev) => ({ ...prev, value: event.target.value }))}
                    placeholder="0,00"
                  />
                </label>

                <label>
                  Forma de pagamento
                  <select
                    value={manualIncome.paymentMethod ?? ""}
                    onChange={(event) =>
                      setManualIncome((prev) => ({
                        ...prev,
                        paymentMethod: (event.target.value || undefined) as PaymentMethod | undefined,
                      }))
                    }
                  >
                    <option value="">Selecionar</option>
                    {INCOME_PAYMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Descricao (opcional)
                  <input
                    value={manualIncome.description}
                    onChange={(event) => setManualIncome((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Ex: extra de ultima hora"
                  />
                </label>

                <label>
                  Categoria
                  <input
                    value={manualIncome.category}
                    onChange={(event) => setManualIncome((prev) => ({ ...prev, category: event.target.value }))}
                    placeholder="Ex: servico, extra, comissao"
                  />
                </label>

                <label>
                  Origem (opcional)
                  <input
                    value={manualIncome.origin}
                    onChange={(event) => setManualIncome((prev) => ({ ...prev, origin: event.target.value }))}
                    placeholder="Ex: indicacao, bonus, produto"
                  />
                </label>
              </div>

              <div className="fd-inline-check">
                <label>
                  <input
                    type="checkbox"
                    checked={manualIncome.customDateEnabled}
                    onChange={(event) =>
                      setManualIncome((prev) => ({ ...prev, customDateEnabled: event.target.checked }))
                    }
                  />
                  <span>Definir data manual</span>
                </label>
                {manualIncome.customDateEnabled ? (
                  <label className="fd-inline-date">
                    <CalendarDays className="h-4 w-4" />
                    <input
                      type="date"
                      value={manualIncome.date}
                      onChange={(event) => setManualIncome((prev) => ({ ...prev, date: event.target.value }))}
                    />
                  </label>
                ) : null}
              </div>

              <button type="button" className="fd-ghost-btn fd-flow-submit" disabled={isSaving} onClick={saveManualIncome}>
                Confirmar extra manual
              </button>
            </section>
          </div>
        ) : (
          <div className="fd-expense-flow">
            <section className="fd-flow-panel">
              <div className="fd-flow-grid">
                <label>
                  Valor R$
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={expense.value}
                    onChange={(event) => setExpense((prev) => ({ ...prev, value: event.target.value }))}
                    placeholder="0,00"
                  />
                </label>

                <label>
                  Descricao
                  <input
                    value={expense.description}
                    onChange={(event) => setExpense((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Ex: compra de insumos"
                  />
                </label>

                <label>
                  Categoria
                  <select
                    value={expense.category}
                    onChange={(event) =>
                      setExpense((prev) => ({
                        ...prev,
                        category: event.target.value as (typeof EXPENSE_CATEGORIES)[number],
                      }))
                    }
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Data
                  <input
                    type="date"
                    value={expense.date}
                    onChange={(event) => setExpense((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>

                <label className="fd-modal-full">
                  Pote de origem
                  <select
                    value={expense.potId}
                    onChange={(event) => setExpense((prev) => ({ ...prev, potId: event.target.value }))}
                  >
                    <option value={personalPot?.id ?? ""}>Dinheiro pessoal (PF)</option>
                    <option value={businessPot?.id ?? ""}>Dinheiro do negocio (PJ)</option>
                    <option value={reservePot?.id ?? ""}>Reserva</option>
                  </select>
                </label>
              </div>

              <button type="button" className="fd-primary-btn fd-flow-submit" disabled={isSaving} onClick={saveExpense}>
                Confirmar saida
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
