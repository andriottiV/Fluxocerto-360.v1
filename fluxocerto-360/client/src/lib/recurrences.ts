import { PaymentMethod, PotType, TransactionType } from "@/lib/types";

export type RecurrenceStatus = "active" | "paused";
export type RecurrenceFrequency = "monthly";
export type RecurrenceKind = TransactionType.INCOME | TransactionType.EXPENSE;

export type Recurrence = {
  id: string;
  ownerId?: string;
  name: string;
  type: RecurrenceKind;
  amount: number;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  potType: PotType;
  category: string;
  paymentMethod?: PaymentMethod;
  status: RecurrenceStatus;
  createdAt: string;
  ignoredPeriods?: string[];
  lastConfirmedPeriod?: string;
};

export type RecurrenceInput = Omit<Recurrence, "id" | "createdAt" | "ignoredPeriods" | "lastConfirmedPeriod">;

const STORAGE_PREFIX = "fc360:recurrences:";
const CHANGE_EVENT = "fc360:recurrences:changed";

export function getRecurrenceStorageKey(userId?: string) {
  return `${STORAGE_PREFIX}${userId ?? "anonymous"}`;
}

export function recurrencePeriodKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function createRecurrenceId() {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampDay(day: number) {
  return Math.max(1, Math.min(31, Math.round(day)));
}

function safeAmount(value: number) {
  return Number(Math.max(0, Number(value) || 0).toFixed(2));
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeRecurrences(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function readRecurrences(userId?: string): Recurrence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getRecurrenceStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id ?? createRecurrenceId()),
        ownerId: typeof item.ownerId === "string" ? item.ownerId : userId,
        name: String(item.name ?? "Recorrencia"),
        type: item.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE,
        amount: safeAmount(Number(item.amount)),
        frequency: "monthly" as const,
        dayOfMonth: clampDay(Number(item.dayOfMonth ?? 1)),
        potType:
          item.potType === PotType.BUSINESS
            ? PotType.BUSINESS
            : item.potType === PotType.RESERVE
              ? PotType.RESERVE
              : PotType.PERSONAL,
        category: String(item.category ?? "outros"),
        paymentMethod: item.paymentMethod,
        status: item.status === "paused" ? "paused" : "active",
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        ignoredPeriods: Array.isArray(item.ignoredPeriods) ? item.ignoredPeriods.map(String) : [],
        lastConfirmedPeriod: typeof item.lastConfirmedPeriod === "string" ? item.lastConfirmedPeriod : undefined,
      }));
  } catch {
    return [];
  }
}

export function writeRecurrences(userId: string | undefined, recurrences: Recurrence[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getRecurrenceStorageKey(userId), JSON.stringify(recurrences));
  emitChange();
}

export function addRecurrence(userId: string | undefined, input: RecurrenceInput) {
  const item: Recurrence = {
    ...input,
    id: createRecurrenceId(),
    ownerId: userId,
    amount: safeAmount(input.amount),
    dayOfMonth: clampDay(input.dayOfMonth),
    frequency: "monthly",
    createdAt: new Date().toISOString(),
    ignoredPeriods: [],
  };
  writeRecurrences(userId, [item, ...readRecurrences(userId)]);
  return item;
}

export function updateRecurrence(userId: string | undefined, updated: Recurrence) {
  writeRecurrences(
    userId,
    readRecurrences(userId).map((item) => (item.id === updated.id ? { ...updated, amount: safeAmount(updated.amount), dayOfMonth: clampDay(updated.dayOfMonth) } : item))
  );
}

export function ignoreRecurrence(userId: string | undefined, recurrenceId: string, date = new Date()) {
  const period = recurrencePeriodKey(date);
  writeRecurrences(
    userId,
    readRecurrences(userId).map((item) =>
      item.id === recurrenceId
        ? { ...item, ignoredPeriods: Array.from(new Set([...(item.ignoredPeriods ?? []), period])) }
        : item
    )
  );
}

export function markRecurrenceConfirmed(userId: string | undefined, recurrenceId: string, date = new Date()) {
  const period = recurrencePeriodKey(date);
  writeRecurrences(
    userId,
    readRecurrences(userId).map((item) =>
      item.id === recurrenceId ? { ...item, lastConfirmedPeriod: period } : item
    )
  );
}

export function getRecurrenceDateForPeriod(recurrence: Pick<Recurrence, "dayOfMonth">, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(recurrence.dayOfMonth, lastDay));
}

export function getNextRecurrenceDate(recurrence: Pick<Recurrence, "dayOfMonth">, date = new Date()) {
  const current = getRecurrenceDateForPeriod(recurrence, date);
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  if (current.getTime() >= todayStart.getTime()) return current;
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return getRecurrenceDateForPeriod(recurrence, nextMonth);
}

export function isRecurrenceDueToday(recurrence: Recurrence, date = new Date()) {
  if (recurrence.status !== "active") return false;
  const period = recurrencePeriodKey(date);
  if (recurrence.ignoredPeriods?.includes(period)) return false;
  if (recurrence.lastConfirmedPeriod === period) return false;
  const due = getRecurrenceDateForPeriod(recurrence, date);
  return due.getFullYear() === date.getFullYear() && due.getMonth() === date.getMonth() && due.getDate() === date.getDate();
}

export function getTodayRecurrences(recurrences: Recurrence[], date = new Date()) {
  return recurrences.filter((item) => isRecurrenceDueToday(item, date));
}

export function getRecurrenceStatusLabel(recurrence: Recurrence, date = new Date()) {
  if (recurrence.status === "paused") return "Pausada";
  if (isRecurrenceDueToday(recurrence, date)) return "Vence hoje";
  return "Próxima";
}
