import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Mic, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { parseFinancialVoiceCommand } from "@/lib/voice/financialVoiceParser";
import { PaymentMethod, TransactionType } from "@/lib/types";

type VoiceModalState = "default" | "listening" | "processing" | "error" | "ready_for_confirmation";

type VoicePreviewForm = {
  rawText: string;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  amount: string;
  category: string;
  description: string;
  date: string;
  areaHint: "pessoal" | "negocio" | "reserva" | "indefinido";
  paymentMethod?: PaymentMethod;
  ambiguous: boolean;
  missingFields: string[];
};

type VoiceTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onStateChange?: (state: VoiceModalState) => void;
};

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildIncomeDescription(paymentMethod?: PaymentMethod, rawText?: string) {
  const text = rawText?.toLowerCase() ?? "";
  const inferred =
    paymentMethod ??
    (text.includes("pix")
      ? "pix"
      : text.includes("dinheiro")
        ? "dinheiro"
        : text.includes("credito")
          ? "credito"
          : text.includes("debito") || text.includes("cartao")
            ? "debito"
            : text.includes("transferencia")
              ? "transferencia"
              : undefined);
  if (inferred === "pix") return "Recebimento via Pix";
  if (inferred === "dinheiro") return "Recebimento em dinheiro";
  if (inferred === "credito") return "Recebimento via cartão de crédito";
  if (inferred === "debito") return "Recebimento via cartão de débito";
  if (inferred === "transferencia") return "Recebimento via transferência";
  return "Recebimento";
}

export default function VoiceTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  onStateChange,
}: VoiceTransactionModalProps) {
  const { accounts, pots, addTransaction } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [preview, setPreview] = useState<VoicePreviewForm | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);

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
    setIsSaving(false);
    setVoiceProcessing(false);
    setPreview(null);
    setAutoStarted(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !voiceSupported || autoStarted) return;
    setAutoStarted(true);
    window.setTimeout(() => {
      startVoice();
    }, 140);
  }, [autoStarted, isOpen, startVoice, voiceSupported]);

  useEffect(() => {
    if (!voiceTranscript) return;
    setVoiceProcessing(true);
    const parsed = parseFinancialVoiceCommand(voiceTranscript);
    setPreview({
      rawText: parsed.correctedText || parsed.rawText,
      type: parsed.type ?? TransactionType.EXPENSE,
      amount: parsed.amount ? String(parsed.amount) : "",
      category: parsed.type === TransactionType.INCOME ? "nao_aplicavel" : parsed.category ?? "outros",
      description:
        parsed.type === TransactionType.INCOME
          ? buildIncomeDescription(parsed.paymentMethod, parsed.correctedText || parsed.rawText)
          : parsed.description ?? "",
      date: parsed.date ?? todayIso(),
      areaHint: parsed.areaHint,
      paymentMethod: parsed.paymentMethod,
      ambiguous: parsed.ambiguous,
      missingFields: parsed.missingFields,
    });
    setVoiceProcessing(false);
  }, [voiceTranscript]);

  const voiceStatus: VoiceModalState = !isOpen
    ? "default"
    : voiceError
      ? "error"
      : voiceListening
        ? "listening"
        : voiceProcessing
          ? "processing"
          : preview
            ? "ready_for_confirmation"
            : "default";

  useEffect(() => {
    onStateChange?.(voiceStatus);
  }, [onStateChange, voiceStatus]);

  if (!isOpen) return null;

  const resolvePotId = () => {
    if (!preview) return undefined;
    if (preview.areaHint === "reserva") return reservePot?.id;
    if (preview.areaHint === "negocio") return businessPot?.id;
    return personalPot?.id;
  };

  const confirmAndSave = () => {
    if (!preview || !preview.amount || Number(preview.amount) <= 0) {
      toast.error("Revise o valor antes de confirmar.");
      return;
    }

    if (preview.type === TransactionType.EXPENSE && !preview.category.trim()) {
      toast.error("Categoria obrigatória para saída.");
      return;
    }

    if (preview.type === TransactionType.EXPENSE && !preview.description.trim()) {
      toast.error("Descrição obrigatória para saída.");
      return;
    }

    setIsSaving(true);

    const normalizedDescription =
      preview.type === TransactionType.INCOME
        ? buildIncomeDescription(preview.paymentMethod, preview.rawText)
        : preview.description.trim();

    const result = addTransaction({
      type: preview.type,
      amount: Number(preview.amount),
      description: normalizedDescription || (preview.type === TransactionType.INCOME ? "Recebimento" : "Saída por voz"),
      category: preview.type === TransactionType.INCOME ? "nao_aplicavel" : preview.category.trim() || "outros",
      date: preview.type === TransactionType.INCOME ? todayIso() : preview.date || todayIso(),
      account: defaultAccount,
      paymentMethod: preview.paymentMethod,
      potId: resolvePotId(),
      origin: "Comando por voz",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível salvar a movimentação por voz.");
      setIsSaving(false);
      return;
    }

    toast.success("Movimentação registrada por voz.");
    onSuccess?.();
    onClose();
  };

  const tryAgain = () => {
    setPreview(null);
    startVoice();
  };

  return (
    <div className="fd-modal-backdrop" role="dialog" aria-modal="true">
      <div className="fd-modal-card fd-voice-modal-card">
        <div className="fd-modal-head">
          <div className="fd-voice-head">
            <div className="fd-voice-head-icon">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h3>Registro por voz</h3>
              <p>Fale sua movimentação e confirme os dados antes de salvar.</p>
            </div>
          </div>
          <button type="button" className="fd-icon-btn" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-voice-status-panel">
          <span className={`fd-voice-status-chip ${voiceStatus}`}>
            {voiceStatus === "listening" && "Ouvindo"}
            {voiceStatus === "processing" && "Processando"}
            {voiceStatus === "ready_for_confirmation" && "Revisar dados"}
            {voiceStatus === "error" && "Erro"}
            {voiceStatus === "default" && "Pronto"}
          </span>
          {voiceSupported ? (
            <button
              type="button"
              className="fd-mini-btn"
              onClick={() => (voiceListening ? stopVoice() : startVoice())}
              title={voiceListening ? "Parar escuta" : "Iniciar escuta"}
            >
              {voiceListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>

        {!voiceSupported ? (
          <div className="fd-voice-fallback">
            <p>Comando por voz não está disponível neste navegador.</p>
            <small>Use o cadastro manual normalmente.</small>
          </div>
        ) : (
          <div className="fd-voice-main">
            <div className="fd-voice-captured">
              <span>Frase captada</span>
              <strong>{preview?.rawText ? `"${preview.rawText}"` : "Aguardando comando de voz..."}</strong>
            </div>

            {voiceError ? <p className="fd-voice-error">{voiceError}</p> : null}
            {preview?.ambiguous ? (
              <p className="fd-voice-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Revise os dados antes de confirmar: {preview.missingFields.join(", ")}.
              </p>
            ) : null}

            <p className="fd-voice-guide-text">Revise os dados antes de confirmar.</p>

            <div className="fd-voice-fields-grid">
              <label>
                Valor
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={preview?.amount ?? ""}
                  onChange={(event) =>
                    setPreview((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                  }
                />
              </label>

              <label>
                Forma de pagamento
                <select
                  value={preview?.paymentMethod ?? ""}
                  onChange={(event) =>
                    setPreview((prev) =>
                      prev
                        ? {
                            ...prev,
                            paymentMethod: (event.target.value || undefined) as PaymentMethod | undefined,
                            description:
                              prev.type === TransactionType.INCOME
                                ? buildIncomeDescription(
                                    (event.target.value || undefined) as PaymentMethod | undefined,
                                    prev.rawText
                                  )
                                : prev.description,
                          }
                        : prev
                    )
                  }
                >
                  <option value="">Selecionar</option>
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {preview?.type === TransactionType.EXPENSE ? (
                <>
                  <label>
                    Categoria
                    <input
                      value={preview?.category ?? ""}
                      onChange={(event) =>
                        setPreview((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    Descrição
                    <input
                      value={preview?.description ?? ""}
                      onChange={(event) =>
                        setPreview((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    Data
                    <div className="fd-inline-date">
                      <CalendarDays className="h-4 w-4" />
                      <input
                        type="date"
                        value={preview?.date ?? todayIso()}
                        onChange={(event) =>
                          setPreview((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                        }
                      />
                    </div>
                  </label>
                </>
              ) : (
                <div className="fd-voice-income-note">
                  <span>Recebimento</span>
                  <strong>{buildIncomeDescription(preview?.paymentMethod, preview?.rawText)}</strong>
                  <small>Descrição e data preenchidas automaticamente.</small>
                </div>
              )}
            </div>

            <div className="fd-voice-actions">
              <button
                type="button"
                className="fd-primary-btn"
                onClick={confirmAndSave}
                disabled={isSaving || !preview}
              >
                Confirmar registro
              </button>
              <button type="button" className="fd-ghost-btn" onClick={tryAgain}>
                <RotateCcw className="h-4 w-4" />
                Tentar novamente
              </button>
              <button type="button" className="fd-mini-btn" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
