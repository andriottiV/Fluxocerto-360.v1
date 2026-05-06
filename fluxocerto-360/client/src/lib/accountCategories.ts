import {
  PotType,
  TransactionType,
  type AdjustmentAccount,
} from "@/lib/types";

export type AccountCategoryKind = "fixa" | "variavel" | "recorrente";
export type AccountCategoryNature = TransactionType.INCOME | TransactionType.EXPENSE;

export type AccountCategory = {
  id: string;
  ownerId?: string;
  name: string;
  normalizedName: string;
  kind: AccountCategoryKind;
  nature: AccountCategoryNature;
  potType: PotType;
  createdAt: string;
  source?: "settings" | "recurrences" | "legacy";
};

export type AccountCategoryInput = Omit<AccountCategory, "id" | "normalizedName" | "createdAt">;

const STORAGE_PREFIX = "fc360:account-categories:";
const CHANGE_EVENT = "fc360:account-categories:changed";

export const DEFAULT_ACCOUNT_CATEGORIES: AccountCategory[] = [
  buildDefaultCategory("Moradia", "fixa", TransactionType.EXPENSE, PotType.PERSONAL),
  buildDefaultCategory("Internet", "fixa", TransactionType.EXPENSE, PotType.PERSONAL),
  buildDefaultCategory("Energia", "fixa", TransactionType.EXPENSE, PotType.PERSONAL),
  buildDefaultCategory("Fornecedores", "variavel", TransactionType.EXPENSE, PotType.BUSINESS),
  buildDefaultCategory("Assinaturas", "recorrente", TransactionType.EXPENSE, PotType.BUSINESS),
  buildDefaultCategory("Salario fixo", "recorrente", TransactionType.INCOME, PotType.PERSONAL),
  buildDefaultCategory("Mensalidade de cliente", "recorrente", TransactionType.INCOME, PotType.BUSINESS),
  buildDefaultCategory("Outros", "variavel", TransactionType.EXPENSE, PotType.PERSONAL),
];

function buildDefaultCategory(
  name: string,
  kind: AccountCategoryKind,
  nature: AccountCategoryNature,
  potType: PotType
): AccountCategory {
  return {
    id: `default-${normalizeCategoryName(name)}`,
    name,
    normalizedName: normalizeCategoryName(name),
    kind,
    nature,
    potType,
    createdAt: "default",
    source: "settings",
  };
}

function createCategoryId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function normalizeCategoryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function findCategoryByNormalizedName(categories: AccountCategory[], name: string) {
  const normalized = normalizeCategoryName(name);
  return categories.find((category) => category.normalizedName === normalized);
}

export function getAccountCategoryStorageKey(userId?: string) {
  return `${STORAGE_PREFIX}${userId ?? "anonymous"}`;
}

function normalizePotType(value: unknown): PotType {
  if (value === PotType.BUSINESS) return PotType.BUSINESS;
  if (value === PotType.RESERVE) return PotType.RESERVE;
  return PotType.PERSONAL;
}

function normalizeKind(value: unknown): AccountCategoryKind {
  if (value === "recorrente") return "recorrente";
  if (value === "variavel") return "variavel";
  return "fixa";
}

function normalizeNature(value: unknown): AccountCategoryNature {
  return value === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;
}

function normalizeCategoryRecord(item: Partial<AccountCategory>, userId?: string): AccountCategory | null {
  const name = String(item.name ?? "").trim();
  const normalizedName = normalizeCategoryName(name);
  if (!name || !normalizedName) return null;

  return {
    id: String(item.id ?? createCategoryId()),
    ownerId: typeof item.ownerId === "string" ? item.ownerId : userId,
    name,
    normalizedName,
    kind: normalizeKind(item.kind),
    nature: normalizeNature(item.nature),
    potType: normalizePotType(item.potType),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    source: item.source,
  };
}

function dedupeCategories(categories: AccountCategory[]) {
  const byName = new Map<string, AccountCategory>();
  categories.forEach((category) => {
    if (!byName.has(category.normalizedName)) {
      byName.set(category.normalizedName, category);
    }
  });
  return Array.from(byName.values());
}

export function categoryFromLegacyAccount(account: AdjustmentAccount, userId?: string): AccountCategory | null {
  const name = account.name.trim() || account.category;
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) return null;
  return {
    id: `legacy-${account.id}`,
    ownerId: account.ownerId ?? userId,
    name,
    normalizedName,
    kind: account.type,
    nature: TransactionType.EXPENSE,
    potType: account.pot === "pj" ? PotType.BUSINESS : PotType.PERSONAL,
    createdAt: account.dueDate || new Date().toISOString(),
    source: "legacy",
  };
}

export function readStoredAccountCategories(userId?: string): AccountCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getAccountCategoryStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return dedupeCategories(
      parsed
        .map((item) => normalizeCategoryRecord(item, userId))
        .filter((item): item is AccountCategory => Boolean(item))
    );
  } catch {
    return [];
  }
}

export function readAccountCategories(userId?: string, legacyAccounts: AdjustmentAccount[] = []) {
  const stored = readStoredAccountCategories(userId);
  const legacy = legacyAccounts
    .map((account) => categoryFromLegacyAccount(account, userId))
    .filter((item): item is AccountCategory => Boolean(item));
  return dedupeCategories([...stored, ...legacy]);
}

export function getVisibleAccountCategories(userId?: string, legacyAccounts: AdjustmentAccount[] = []) {
  const saved = readAccountCategories(userId, legacyAccounts);
  return saved.length > 0 ? saved : DEFAULT_ACCOUNT_CATEGORIES;
}

export function writeAccountCategories(userId: string | undefined, categories: AccountCategory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getAccountCategoryStorageKey(userId), JSON.stringify(dedupeCategories(categories)));
  emitChange();
}

export function addAccountCategory(userId: string | undefined, input: AccountCategoryInput) {
  const existing = readStoredAccountCategories(userId);
  const normalizedName = normalizeCategoryName(input.name);
  const found = existing.find((category) => category.normalizedName === normalizedName);
  if (found) return { ok: true as const, data: found, reused: true as const };

  const category: AccountCategory = {
    ...input,
    id: createCategoryId(),
    ownerId: userId,
    name: input.name.trim(),
    normalizedName,
    kind: input.kind,
    nature: input.nature,
    potType: input.potType,
    createdAt: new Date().toISOString(),
  };
  writeAccountCategories(userId, [category, ...existing]);
  return { ok: true as const, data: category, reused: false as const };
}

export function deleteAccountCategory(userId: string | undefined, categoryId: string) {
  writeAccountCategories(
    userId,
    readStoredAccountCategories(userId).filter((category) => category.id !== categoryId)
  );
}

export function subscribeAccountCategories(callback: () => void) {
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
