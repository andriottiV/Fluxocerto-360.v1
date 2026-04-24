import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Mic, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import { useBrowserSpeechRecognition } from "@/hooks/useBrowserSpeechRecognition";
import { parseFinancialVoiceCommand } from "@/lib/voice/financialVoiceParser";
import { Client, PaymentMethod, TransactionType } from "@/lib/types";

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
  clientName?: string;
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

function buildIncomeDescription(
  paymentMethod?: PaymentMethod,
  rawText?: string,
  clientName?: string,
  amount?: number
) {
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
  const methodLabel =
    inferred === "pix"
      ? "pix"
      : inferred === "dinheiro"
        ? "dinheiro"
        : inferred === "credito"
          ? "crédito"
          : inferred === "debito"
            ? "débito"
            : inferred === "transferencia"
              ? "transferência"
              : "";
  if (clientName?.trim() && amount && amount > 0) {
    return `Cliente ${clientName.trim()} pagou ${formatMoney(amount)}${methodLabel ? ` no ${methodLabel}` : ""}`;
  }
  if (inferred === "pix") return "Recebimento via Pix";
  if (inferred === "dinheiro") return "Recebimento em dinheiro";
  if (inferred === "credito") return "Recebimento via cartão de crédito";
  if (inferred === "debito") return "Recebimento via cartão de débito";
  if (inferred === "transferencia") return "Recebimento via transferência";
  return "Recebimento";
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeClientLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function VoiceTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  onStateChange,
}: VoiceTransactionModalProps) {
  const { accounts, pots, addTransaction, clients, addClient, updateClient } = useApp();
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
  const normalizedPreviewClient = normalizeClientLookup(preview?.clientName ?? "");
  const existingClientMatch = useMemo(
    () =>
      normalizedPreviewClient
        ? clients.find((client) => normalizeClientLookup(client.name) === normalizedPreviewClient) ?? null
        : null,
    [clients, normalizedPreviewClient]
  );

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
          ? parsed.description ??
            buildIncomeDescription(
              parsed.paymentMethod,
              parsed.correctedText || parsed.rawText,
              parsed.clientName ?? parsed.customerName,
              parsed.amount
            )
          : parsed.description ?? "",
      date: parsed.date ?? todayIso(),
      areaHint: parsed.areaHint,
      paymentMethod: parsed.paymentMethod,
      clientName: parsed.clientName ?? parsed.customerName,
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

    let linkedClient: Client | null = null;
    let createdClient = false;
    const rawClientName = (preview.clientName ?? "").trim();
    const normalizedCommandClient = normalizeClientLookup(rawClientName);
    if (preview.type === TransactionType.INCOME && normalizedCommandClient) {
      linkedClient =
        clients.find((client) => normalizeClientLookup(client.name) === normalizedCommandClient) ?? null;

      if (!linkedClient) {
        const slug = normalizedCommandClient.replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
        const newClient: Client = {
          id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: rawClientName,
          email: slug ? `${slug}@cliente.local` : `cliente-${Date.now()}@cliente.local`,
          phone: "",
          totalSpent: Number(preview.amount),
          status: "ativo",
          lastService: "Comando de voz",
        };
        addClient(newClient);
        linkedClient = newClient;
        createdClient = true;
      } else {
        updateClient({
          ...linkedClient,
          totalSpent: Number((linkedClient.totalSpent + Number(preview.amount)).toFixed(2)),
          lastService: "Comando de voz",
          status: "ativo",
        });
      }
    }

    const normalizedDescription =
      preview.type === TransactionType.INCOME
        ? buildIncomeDescription(
            preview.paymentMethod,
            preview.rawText,
            linkedClient?.name ?? preview.clientName,
            Number(preview.amount)
          )
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
      clientId: linkedClient?.id,
      clientName: linkedClient?.name,
    });

    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível salvar a movimentação por voz.");
      setIsSaving(false);
      return;
    }

    if (preview.type === TransactionType.INCOME && linkedClient) {
      const amountLabel = formatMoney(Number(preview.amount));
      if (createdClient) {
        toast.success(`Cliente ${linkedClient.name} criado e entrada de ${amountLabel} registrada.`);
      } else {
        toast.success(`Entrada de ${amountLabel} vinculada ao cliente ${linkedClient.name}.`);
      }
    } else {
      toast.success("Movimentação registrada por voz.");
    }
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
                    setPreview((prev) =>
                      prev
                        ? {
                            ...prev,
                            amount: event.target.value,
                            description:
                              prev.type === TransactionType.INCOME
                                ? buildIncomeDescription(
                                    prev.paymentMethod,
                                    prev.rawText,
                                    prev.clientName,
                                    Number(event.target.value)
                                  )
                                : prev.description,
                          }
                        : prev
                    )
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
                                    prev.rawText,
                                    prev.clientName,
                                    Number(prev.amount)
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
                <>
                  <label>
                    Cliente
                    <input
                      value={preview?.clientName ?? ""}
                      placeholder="Nome do cliente"
                      onChange={(event) =>
                        setPreview((prev) =>
                          prev
                            ? {
                                ...prev,
                                clientName: event.target.value,
                                description: buildIncomeDescription(
                                  prev.paymentMethod,
                                  prev.rawText,
                                  event.target.value,
                                  Number(prev.amount)
                                ),
                              }
                            : prev
                        )
                      }
                    />
                  </label>
                  <div className="fd-voice-income-note">
                    <span>Recebimento</span>
                    <strong>
                      {buildIncomeDescription(
                        preview?.paymentMethod,
                        preview?.rawText,
                        preview?.clientName,
                        Number(preview?.amount)
                      )}
                    </strong>
                    <small>
                      {!preview?.clientName?.trim()
                        ? "Cliente não identificado automaticamente."
                        : existingClientMatch
                          ? `Cliente selecionado: ${existingClientMatch.name}`
                          : `Novo cliente: ${preview.clientName.trim()}`}
                    </small>
                  </div>
                </>
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
