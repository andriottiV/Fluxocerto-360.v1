import {
  OnboardingDebtInput,
  OnboardingFinancialMode,
  OnboardingFixedExpenseInput,
  OnboardingUsageMode,
  User,
  UserStatus,
} from "@/lib/types";
import { canAccessAdmin, isAdmin } from "@/lib/authz";

const AUTH_USERS_KEY = "fc360:auth:users:v2";
const AUTH_SESSION_KEY = "fc360:auth:session:v1";
const ONBOARDING_KEY_PREFIX = "fc360:onboarding:";
const ONBOARDING_DATA_KEY_PREFIX = "fc360:onboarding:data:";
const DEFAULT_ADMIN_EMAIL = "andriottidev@gmail.com";

type StoredAuthUser = User & {
  password: string;
};

export type AuthResult = {
  ok: boolean;
  user?: User;
  onboardingCompleted?: boolean;
  error?: string;
};

type CreateAccountInput = {
  name?: string;
  email: string;
  password: string;
};

export type OnboardingData = {
  step?: 1 | 2 | 3 | 4;
  usageMode?: OnboardingUsageMode;
  monthlyIncome?: number;
  financialMode?: OnboardingFinancialMode;
  debts?: OnboardingDebtInput[];
  fixedExpenses?: OnboardingFixedExpenseInput[];
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseAdminEmailsEnv() {
  if (typeof import.meta === "undefined") return [];
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const raw = `${env?.ADMIN_EMAILS ?? ""},${env?.VITE_ADMIN_EMAILS ?? ""},${DEFAULT_ADMIN_EMAIL}`;
  return raw
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

const ADMIN_EMAILS = new Set(parseAdminEmailsEnv());

function roleAndStatusForEmail(email: string) {
  if (ADMIN_EMAILS.has(normalizeEmail(email))) {
    return { role: "admin" as const, status: "active" as const };
  }
  return { role: "tester" as const, status: "active" as const };
}

function defaultBusinessName(name?: string) {
  const safeName = name?.trim();
  return safeName ? `${safeName} Negocio` : "Meu Negocio";
}

function toPublicUser(stored: StoredAuthUser): User {
  const { password: _password, ...publicUser } = stored;
  return publicUser;
}

function coerceUserShape(user: Partial<StoredAuthUser>): StoredAuthUser {
  const email = normalizeEmail(user.email ?? "");
  const access = roleAndStatusForEmail(email);
  const createdAt = user.createdAt || nowIso();

  return {
    id: user.id || createUserId(),
    name: user.name || "Usuario",
    email,
    password: user.password || "123456",
    role: user.role === "admin" || user.role === "tester" ? user.role : access.role,
    status:
      user.status === "active" || user.status === "pending" || user.status === "blocked"
        ? user.status
        : access.status,
    createdAt,
    lastLoginAt: user.lastLoginAt || createdAt,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    phone: user.phone,
    avatar: user.avatar,
    businessName: user.businessName || defaultBusinessName(user.name),
    businessType: user.businessType || "Servicos",
    cnpj: user.cnpj,
  };
}

function readUsers(): StoredAuthUser[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(AUTH_USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthUser>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceUserShape);
  } catch {
    return [];
  }
}

function writeUsers(users: StoredAuthUser[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function writeSession(userId: string | null) {
  if (!isBrowser()) return;
  if (!userId) {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId }));
}

function readSessionUserId(): string | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: string };
    return typeof parsed.userId === "string" && parsed.userId.trim() ? parsed.userId : null;
  } catch {
    return null;
  }
}

function readOnboardingCompleted(userId: string) {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(`${ONBOARDING_KEY_PREFIX}${userId}`) === "true";
}

function writeOnboardingCompleted(userId: string, completed: boolean) {
  if (!isBrowser()) return;
  window.localStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, completed ? "true" : "false");
}

function readOnboardingData(userId: string): OnboardingData {
  if (!isBrowser()) return {};
  const raw = window.localStorage.getItem(`${ONBOARDING_DATA_KEY_PREFIX}${userId}`);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingData>;
    const usageMode =
      parsed.usageMode === "personal" || parsed.usageMode === "business" || parsed.usageMode === "both"
        ? parsed.usageMode
        : undefined;
    const step = parsed.step === 1 || parsed.step === 2 || parsed.step === 3 || parsed.step === 4 ? parsed.step : undefined;
    const monthlyIncome =
      typeof parsed.monthlyIncome === "number" && Number.isFinite(parsed.monthlyIncome) && parsed.monthlyIncome >= 0
        ? parsed.monthlyIncome
        : undefined;
    const financialMode =
      parsed.financialMode === "chaos" ||
      parsed.financialMode === "breakEven" ||
      parsed.financialMode === "surplus" ||
      parsed.financialMode === "growth"
        ? parsed.financialMode
        : undefined;
    const debts = Array.isArray(parsed.debts)
      ? parsed.debts
          .map((debt) => ({
            name: String(debt?.name ?? "").trim(),
            totalAmount: Number(debt?.totalAmount ?? NaN),
            monthlyPayment: Number(debt?.monthlyPayment ?? NaN),
          }))
          .filter(
            (debt) =>
              debt.name &&
              Number.isFinite(debt.totalAmount) &&
              debt.totalAmount > 0 &&
              Number.isFinite(debt.monthlyPayment) &&
              debt.monthlyPayment > 0
          )
      : undefined;
    const fixedExpenses = Array.isArray(parsed.fixedExpenses)
      ? parsed.fixedExpenses
          .map((expense) => ({
            name: String(expense?.name ?? "").trim(),
            amount: Number(expense?.amount ?? NaN),
            dueDate: String(expense?.dueDate ?? ""),
          }))
          .filter(
            (expense) =>
              expense.name &&
              Number.isFinite(expense.amount) &&
              expense.amount > 0 &&
              !Number.isNaN(new Date(expense.dueDate).getTime())
          )
      : undefined;

    return {
      step,
      usageMode,
      monthlyIncome,
      financialMode,
      debts,
      fixedExpenses,
    };
  } catch {
    return {};
  }
}

function writeOnboardingData(userId: string, data: OnboardingData) {
  if (!isBrowser()) return;
  window.localStorage.setItem(`${ONBOARDING_DATA_KEY_PREFIX}${userId}`, JSON.stringify(data));
}

function clearOnboardingData(userId: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(`${ONBOARDING_DATA_KEY_PREFIX}${userId}`);
}

export function bootstrapAuthUsers() {
  const users: StoredAuthUser[] = readUsers().map((user) => {
    const access = roleAndStatusForEmail(user.email);
    if (access.role === "admin") {
      return coerceUserShape({
        ...user,
        role: "admin",
        status: user.status === "blocked" ? "blocked" : "active",
        approvedAt: user.approvedAt ?? nowIso(),
        approvedBy: user.approvedBy ?? "system",
      });
    }
    return coerceUserShape({
      ...user,
      status: user.status === "blocked" ? "blocked" : "active",
    });
  });
  writeUsers(users);
}

export function authenticateUser(email: string, password: string): AuthResult {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const found = users.find((item) => normalizeEmail(item.email) === normalizedEmail);

  if (!found || found.password !== password) {
    return { ok: false, error: "Email ou senha incorretos" };
  }

  const updated: StoredAuthUser = {
    ...found,
    lastLoginAt: nowIso(),
  };
  writeUsers(users.map((item) => (item.id === updated.id ? updated : item)));
  writeSession(updated.id);

  return {
    ok: true,
    user: toPublicUser(updated),
    onboardingCompleted: readOnboardingCompleted(updated.id),
  };
}

export function createAccount(input: CreateAccountInput): AuthResult {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(input.email);

  if (users.some((item) => normalizeEmail(item.email) === normalizedEmail)) {
    return { ok: false, error: "Este email ja esta cadastrado" };
  }

  const safeName = input.name?.trim();
  const createdAt = nowIso();
  const access = roleAndStatusForEmail(normalizedEmail);
  const newUser: StoredAuthUser = {
    id: createUserId(),
    name: safeName || "Novo Usuario",
    email: normalizedEmail,
    password: input.password,
    role: access.role,
    status: access.status,
    createdAt,
    lastLoginAt: createdAt,
    approvedAt: access.role === "admin" ? createdAt : undefined,
    approvedBy: access.role === "admin" ? "system" : undefined,
    phone: "",
    businessName: defaultBusinessName(safeName),
    businessType: "Servicos",
    cnpj: undefined,
    avatar: undefined,
  };

  writeUsers([newUser, ...users]);
  writeOnboardingCompleted(newUser.id, false);
  writeSession(newUser.id);

  return {
    ok: true,
    user: toPublicUser(newUser),
    onboardingCompleted: false,
  };
}

export function requestPasswordReset(email: string): { ok: boolean; error?: string; message?: string } {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const exists = users.some((item) => normalizeEmail(item.email) === normalizedEmail);
  if (!exists) {
    return { ok: false, error: "Email nao encontrado" };
  }
  return { ok: true, message: "Se o email existir, enviaremos instrucoes de recuperacao." };
}

export function updateAuthUserProfile(nextUser: User) {
  const users = readUsers();
  const next = users.map((item) =>
    item.id === nextUser.id
      ? {
          ...item,
          name: nextUser.name,
          phone: nextUser.phone,
          avatar: nextUser.avatar,
          businessName: nextUser.businessName,
          businessType: nextUser.businessType,
          cnpj: nextUser.cnpj,
        }
      : item
  );
  writeUsers(next);
}

export function markUserOnboardingCompleted(userId: string) {
  writeOnboardingCompleted(userId, true);
}

export function persistAuthSession(userId: string) {
  writeSession(userId);
}

export function clearAuthSession() {
  writeSession(null);
}

export function restoreAuthSession(): { user: User; onboardingCompleted: boolean } | null {
  const userId = readSessionUserId();
  if (!userId) return null;

  const users = readUsers();
  const found = users.find((item) => item.id === userId);
  if (!found) {
    writeSession(null);
    return null;
  }

  return {
    user: toPublicUser(found),
    onboardingCompleted: readOnboardingCompleted(found.id),
  };
}

export function isUserOnboardingCompleted(userId: string) {
  return readOnboardingCompleted(userId);
}

export function getUserOnboardingData(userId: string): OnboardingData {
  return readOnboardingData(userId);
}

export function saveUserOnboardingData(userId: string, nextData: Partial<OnboardingData>) {
  const current = readOnboardingData(userId);
  const merged: OnboardingData = {
    ...current,
    ...nextData,
  };

  if (
    typeof merged.monthlyIncome !== "number" ||
    !Number.isFinite(merged.monthlyIncome) ||
    merged.monthlyIncome < 0
  ) {
    delete merged.monthlyIncome;
  }
  if (!merged.step || merged.step < 1 || merged.step > 4) delete merged.step;
  if (!Array.isArray(merged.debts)) delete merged.debts;
  if (!Array.isArray(merged.fixedExpenses)) delete merged.fixedExpenses;

  writeOnboardingData(userId, merged);
}

export function clearUserOnboardingData(userId: string) {
  clearOnboardingData(userId);
}

export function listManagedUsers(requester: User): User[] {
  if (!canAccessAdmin(requester)) return [];
  return readUsers()
    .map(toPublicUser)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateUserStatus(
  requester: User,
  targetUserId: string,
  status: UserStatus
): { ok: boolean; error?: string } {
  if (!canAccessAdmin(requester)) {
    return { ok: false, error: "Acesso negado" };
  }

  const users = readUsers();
  const target = users.find((item) => item.id === targetUserId);
  if (!target) return { ok: false, error: "Usuario nao encontrado" };
  if (isAdmin(target) && status === "blocked") {
    return { ok: false, error: "Nao e permitido bloquear administradores" };
  }

  const approvedAt = status === "active" ? target.approvedAt ?? nowIso() : target.approvedAt;
  const approvedBy = status === "active" ? target.approvedBy ?? requester.email : target.approvedBy;

  writeUsers(
    users.map((item) =>
      item.id === targetUserId
        ? {
            ...item,
            status,
            approvedAt,
            approvedBy,
          }
        : item
    )
  );

  return { ok: true };
}

export function getConfiguredAdminEmails() {
  return Array.from(ADMIN_EMAILS.values());
}
