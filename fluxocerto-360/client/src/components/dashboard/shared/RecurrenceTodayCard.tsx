import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import {
  getTodayRecurrences,
  ignoreRecurrence,
  readRecurrences,
  subscribeRecurrences,
  type Recurrence,
} from "@/lib/recurrences";
import { formatCurrency } from "@/lib/utils";
import RecurrenceConfirmDialog from "@/components/dashboard/shared/RecurrenceConfirmDialog";

type RecurrenceTodayCardProps = {
  compact?: boolean;
};

export default function RecurrenceTodayCard({ compact = false }: RecurrenceTodayCardProps) {
  const { user } = useApp();
  const [recurrences, setRecurrences] = useState<Recurrence[]>(() => readRecurrences(user?.id));
  const [selected, setSelected] = useState<Recurrence | null>(null);
  const [initialEditing, setInitialEditing] = useState(false);

  useEffect(() => {
    const refresh = () => setRecurrences(readRecurrences(user?.id));
    refresh();
    return subscribeRecurrences(refresh);
  }, [user?.id]);

  const today = useMemo(() => getTodayRecurrences(recurrences), [recurrences]);

  const openDialog = (item: Recurrence, editing = false) => {
    setInitialEditing(editing);
    setSelected(item);
  };

  const ignore = (item: Recurrence) => {
    ignoreRecurrence(user?.id, item.id);
    setRecurrences(readRecurrences(user?.id));
  };

  if (today.length === 0) return null;

  return (
    <>
      <section className={`fd-recurrence-today-card ${compact ? "compact" : ""}`}>
        <div className="fd-recurrence-today-head">
          <span>
            <CalendarClock className="h-4 w-4" />
            Recorrencias de hoje
          </span>
          <small>O app te lembra. Voce decide.</small>
        </div>
        <div className="fd-recurrence-today-list">
          {today.slice(0, compact ? 2 : 4).map((item) => (
            <article key={item.id}>
              <p>
                <strong>{item.name}</strong>
                <span>{item.name} vence hoje - {formatCurrency(item.amount)}</span>
              </p>
              <div>
                <button type="button" className="fd-mini-btn" onClick={() => openDialog(item)}>
                  Confirmar
                </button>
                <button type="button" className="fd-ghost-btn" onClick={() => openDialog(item, true)}>
                  Editar
                </button>
                <button type="button" className="fd-mini-btn" onClick={() => ignore(item)}>
                  Ignorar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <RecurrenceConfirmDialog
        recurrence={selected}
        initialEditing={initialEditing}
        onClose={() => setSelected(null)}
        onDone={() => setRecurrences(readRecurrences(user?.id))}
      />
    </>
  );
}
