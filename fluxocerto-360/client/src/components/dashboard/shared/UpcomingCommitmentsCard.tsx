import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Settings,
  WalletCards,
  X,
} from "lucide-react";

import { PotType } from "@/lib/types";
import type { UpcomingCommitment } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";
import type { Pot } from "@/lib/types";

type UpcomingCommitmentsCardProps = {
  commitments: UpcomingCommitment[];
  pots: Pot[];
  onViewAll: () => void;
  onConfigureRecurrences: () => void;
  onRegisterNow: () => void;
  onViewPot: (potType: PotType) => void;
};

function potLabel(type: PotType) {
  if (type === PotType.BUSINESS) return "PJ";
  if (type === PotType.RESERVE) return "Reserva";
  return "PF";
}

function dayLabel(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "--";
  return String(parsed.getDate()).padStart(2, "0");
}

function daysUntil(iso: string) {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function titleForCommitment(commitment: UpcomingCommitment) {
  const days = daysUntil(commitment.dueDate);
  if (days === 0) return `${commitment.name} vence hoje`;
  if (days === 1) return `${commitment.name} vence amanha`;
  if (typeof days === "number" && days > 1) return `${commitment.name} vence em ${days} dias`;
  return `${commitment.name} esta no radar`;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(2))) : 0;
}

export default function UpcomingCommitmentsCard({
  commitments,
  pots,
  onViewAll,
  onConfigureRecurrences,
  onRegisterNow,
  onViewPot,
}: UpcomingCommitmentsCardProps) {
  const [selected, setSelected] = useState<UpcomingCommitment | null>(null);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [draftAmount, setDraftAmount] = useState("");
  const visible = commitments.slice(0, 3);
  const extraCount = Math.max(0, commitments.length - visible.length);
  const selectedPot = useMemo(
    () => pots.find((pot) => pot.type === selected?.potType) ?? null,
    [pots, selected?.potType]
  );
  const detailAmount = selected ? (isEditingValue ? parseMoney(draftAmount) : selected.amount) : 0;
  const potBalance = Math.max(0, Number(selectedPot?.balance ?? 0));
  const missingAmount = Math.max(0, Number((detailAmount - potBalance).toFixed(2)));
  const isCovered = missingAmount <= 0;

  const openDetail = (commitment: UpcomingCommitment) => {
    setSelected(commitment);
    setDraftAmount(String(commitment.amount));
    setIsEditingValue(false);
  };

  const closeDetail = () => {
    setSelected(null);
    setIsEditingValue(false);
  };

  return (
    <>
      <article className="fd-upcoming-card">
        <header className="fd-upcoming-head">
          <div>
            <span>
              <CalendarClock className="h-4 w-4" />
              Vence nos proximos 10 dias
            </span>
            <p>Compromissos que podem afetar seu dinheiro disponivel.</p>
          </div>
        </header>

        <div className="fd-upcoming-list">
          {visible.length === 0 ? (
            <p className="fd-upcoming-empty">Nenhum compromisso vencendo nos proximos 10 dias.</p>
          ) : (
            visible.map((commitment) => (
              <button
                key={commitment.id}
                type="button"
                className="fd-upcoming-row"
                onClick={() => openDetail(commitment)}
              >
                <strong>{commitment.name}</strong>
                <span>
                  {formatCurrency(commitment.amount)} · dia {dayLabel(commitment.dueDate)} ·{" "}
                  {potLabel(commitment.potType)}
                </span>
              </button>
            ))
          )}
        </div>

        {extraCount > 0 ? <small className="fd-upcoming-more">+ {extraCount} compromissos proximos</small> : null}

        <p className="fd-upcoming-note">
          Compromisso futuro nao e saida lancada. Seu saldo so muda quando voce confirma.
        </p>

        <footer className="fd-upcoming-actions">
          <button type="button" className="fd-mini-btn" onClick={onViewAll}>
            Ver todos
          </button>
          <button type="button" className="fd-ghost-btn" onClick={onConfigureRecurrences}>
            <Settings className="h-3.5 w-3.5" />
            Configurar recorrencias
          </button>
        </footer>
      </article>

      {selected ? (
        <div className="fd-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDetail();
        }}>
          <article className="fd-modal-card fd-commitment-detail">
            <header className="fd-commitment-detail-head">
              <div>
                <span>Compromisso futuro</span>
                <h3>{titleForCommitment(selected)}</h3>
              </div>
              <button type="button" className="fd-icon-btn" onClick={closeDetail} aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </header>

            <section className="fd-commitment-amount">
              <strong>{formatCurrency(detailAmount)}</strong>
              {isEditingValue ? (
                <label>
                  Editar valor para analise
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftAmount}
                    onChange={(event) => setDraftAmount(event.target.value)}
                  />
                </label>
              ) : null}
            </section>

            <section className="fd-commitment-pot-situation">
              <div>
                <WalletCards className="h-4 w-4" />
                <span>Pote {potLabel(selected.potType)}</span>
              </div>
              <p>Voce tem neste pote: <strong>{formatCurrency(potBalance)}</strong></p>
              <p>Faltam: <strong>{formatCurrency(missingAmount)}</strong></p>
            </section>

            <section className={`fd-commitment-alert ${isCovered ? "covered" : "missing"}`}>
              {isCovered ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              <p>
                {isCovered
                  ? "Voce ja tem valor suficiente para este compromisso."
                  : "Esse valor ainda nao cobre o compromisso."}
              </p>
            </section>

            <section className="fd-commitment-suggestions">
              <span>Sugestoes</span>
              <ul>
                <li>Registrar uma entrada antes do vencimento</li>
                <li>Reduzir gastos proximos</li>
                <li>Avaliar outro pote, sem executar automaticamente</li>
              </ul>
            </section>

            <footer className="fd-commitment-actions">
              <button type="button" className="fd-primary-btn" onClick={onRegisterNow}>
                Registrar agora
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="fd-ghost-btn" onClick={() => setIsEditingValue((prev) => !prev)}>
                <Pencil className="h-4 w-4" />
                Editar valor
              </button>
              <button type="button" className="fd-mini-btn" onClick={() => onViewPot(selected.potType)}>
                Ver pote
              </button>
              <button type="button" className="fd-mini-btn" onClick={closeDetail}>
                Entendi
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </>
  );
}
