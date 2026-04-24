import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Mic, Plus, Sparkles } from "lucide-react";

import TransactionModal from "@/components/dashboard/shared/TransactionModal";
import VoiceTransactionModal from "@/components/dashboard/shared/VoiceTransactionModal";
import { useApp } from "@/contexts/AppContext";
import { PotType, TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function WowPotOverlay({ open }: { open: boolean }) {
  const { pots } = useApp();

  const data = useMemo(() => {
    const pf = pots.find((pot) => pot.type === PotType.PERSONAL) ?? pots.find((pot) => pot.name.toLowerCase().includes("pess"));
    const pj = pots.find((pot) => pot.type === PotType.BUSINESS) ?? pots.find((pot) => pot.name.toLowerCase().includes("neg"));
    const reserve = pots.find((pot) => pot.type === PotType.RESERVE) ?? pots.find((pot) => pot.name.toLowerCase().includes("reserv"));
    const list = [
      { id: "pf", label: "PF", value: pf?.balance ?? 0 },
      { id: "pj", label: "PJ", value: pj?.balance ?? 0 },
      { id: "reserve", label: "Reserva", value: reserve?.balance ?? 0 },
    ];
    const total = list.reduce((sum, item) => sum + Math.max(0, item.value), 0);

    return list.map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((Math.max(0, item.value) / total) * 100) : 0,
    }));
  }, [pots]);

  if (!open) return null;

  return (
    <div className="fd-wow-overlay" aria-live="polite">
      <div className="fd-wow-card fd-glass">
        <div className="fd-wow-title">
          <Sparkles className="h-4 w-4" />
          <strong>Lancamento concluido</strong>
        </div>
        <p>Divisao de potes atualizada em tempo real</p>

        <div className="fd-wow-pots">
          {data.map((pot) => (
            <div key={pot.id} className="fd-wow-pot-item">
              <div className="fd-wow-pot-head">
                <span>{pot.label}</span>
                <small>{pot.percent}%</small>
              </div>
              <div className="fd-wow-pot-bar">
                <div style={{ width: `${pot.percent}%` }} />
              </div>
              <strong>{formatCurrency(pot.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GlobalFloatingAction() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [showWow, setShowWow] = useState(false);
  const [type, setType] = useState<TransactionType.INCOME | TransactionType.EXPENSE>(TransactionType.INCOME);
  const [voiceFabState, setVoiceFabState] = useState<"default" | "listening" | "processing" | "error" | "ready_for_confirmation">("default");
  const wowTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (wowTimeout.current) {
        window.clearTimeout(wowTimeout.current);
      }
    };
  }, []);

  const openModal = (nextType: TransactionType.INCOME | TransactionType.EXPENSE) => {
    setType(nextType);
    setIsMenuOpen(false);
    setIsModalOpen(true);
  };

  const triggerWow = () => {
    setShowWow(true);
    if (wowTimeout.current) {
      window.clearTimeout(wowTimeout.current);
    }
    wowTimeout.current = window.setTimeout(() => {
      setShowWow(false);
    }, 4000);
  };

  const handleVoiceClick = () => {
    setIsMenuOpen(false);
    setVoiceFabState("default");
    setIsVoiceModalOpen(true);
  };

  return (
    <>
      <div className="fd-fab-wrap">
        {isMenuOpen ? (
          <div className="fd-fab-menu fd-glass">
            <button type="button" onClick={() => openModal(TransactionType.INCOME)}>
              <ArrowUpCircle className="h-4 w-4" />
              Adicionar entrada
            </button>
            <button type="button" onClick={() => openModal(TransactionType.EXPENSE)}>
              <ArrowDownCircle className="h-4 w-4" />
              Adicionar saida
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`fd-fab-secondary ${voiceFabState}`}
          onClick={handleVoiceClick}
          aria-label="Registrar por voz"
          title="Registrar por voz"
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          type="button"
          className={`fd-fab ${isMenuOpen ? "open" : ""}`}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label="Acoes rapidas"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        presetType={type}
        onSuccess={triggerWow}
        onClose={() => {
          setIsModalOpen(false);
          setIsMenuOpen(false);
        }}
      />

      <VoiceTransactionModal
        isOpen={isVoiceModalOpen}
        onSuccess={triggerWow}
        onStateChange={(state) => setVoiceFabState(state)}
        onClose={() => {
          setIsVoiceModalOpen(false);
          setVoiceFabState("default");
        }}
      />

      <WowPotOverlay open={showWow} />
    </>
  );
}
