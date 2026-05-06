import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import {
  ignoreRecurrence,
  markRecurrenceConfirmed,
  type Recurrence,
} from "@/lib/recurrences";
import { PaymentMethod, PotType, TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type RecurrenceConfirmDialogProps = {
  recurrence: Recurrence | null;
  onClose: () => void;
  onDone?: () => void;
  initialEditing?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function potLabel(type: PotType) {
  if (type === PotType.BUSINESS) return "PJ";
  if (type === PotType.RESERVE) return "Reserva";
  return "PF";
}

export default function RecurrenceConfirmDialog({
  recurrence,
  onClose,
  onDone,
  initialEditing = false,
}: RecurrenceConfirmDialogProps) {
  const { user, pots, accounts, addTransaction } = useApp();
  const [amount, setAmount] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(recurrence ? String(recurrence.amount) : "");
    setIsEditing(initialEditing);
    setError(null);
  }, [recurrence, initialEditing]);

  const targetPot = useMemo(
    () => pots.find((pot) => pot.type === recurrence?.potType) ?? pots[0],
    [pots, recurrence?.potType]
  );
  const defaultAccount = accounts[0]?.name ?? "Conta Corrente";

  if (!recurrence) return null;

  const safeAmount = Math.max(0, toNumber(amount));
  const isIncome = recurrence.type === TransactionType.INCOME;

  const confirm = () => {
    setError(null);
    if (safeAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    const result = addTransaction({
      type: recurrence.type,
      amount: safeAmount,
      grossAmount: safeAmount,
      description: recurrence.name,
      category: recurrence.category,
      date: todayIso(),
      account: defaultAccount,
      potId: targetPot?.id,
      paymentMethod: recurrence.paymentMethod as PaymentMethod | undefined,
      origin: "Recorrencias",
      source: "recurrence",
      sourceId: recurrence.id,
      notes: `Recorrencia confirmada manualmente: ${recurrence.name}`,
    });

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel registrar esta recorrencia.");
      return;
    }

    markRecurrenceConfirmed(user?.id, recurrence.id);
    onDone?.();
    onClose();
  };

  const ignore = () => {
    ignoreRecurrence(user?.id, recurrence.id);
    onDone?.();
    onClose();
  };

  return (
    <div className="fd-modal-backdrop" role="dialog" aria-modal="true">
      <article className="fd-modal-card fd-recurrence-dialog">
        <div className="fd-modal-head">
          <h3>Identificamos uma recorrencia para hoje. Deseja registrar?</h3>
          <button type="button" className="fd-icon-btn" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-recurrence-dialog-body">
          <div className={isIncome ? "income" : "expense"}>
            {isIncome ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <p>
              <strong>
                {recurrence.name} vence hoje — {formatCurrency(safeAmount || recurrence.amount)}.
              </strong>
              <span>
                Deseja registrar essa {isIncome ? "entrada" : "saida"} no pote {potLabel(recurrence.potType)}?
              </span>
            </p>
          </div>

          {isEditing ? (
            <label>
              Valor para registrar
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
          ) : null}

          {error ? <p className="fd-recurrence-error">{error}</p> : null}
        </div>

        <div className="fd-modal-actions fd-recurrence-dialog-actions">
          <button type="button" className="fd-mini-btn" onClick={ignore}>
            Ignorar
          </button>
          <button type="button" className="fd-ghost-btn" onClick={() => setIsEditing((prev) => !prev)}>
            Editar valor
          </button>
          <button type="button" className="fd-primary-btn" onClick={confirm}>
            Confirmar
          </button>
        </div>
      </article>
    </div>
  );
}
