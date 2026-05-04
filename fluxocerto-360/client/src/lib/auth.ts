import {
  OnboardingDebtInput,
  OnboardingFinancialMode,
  OnboardingFixedExpenseInput,
  OnboardingUsageMode,
  User,
  UserStatus,
} from "@/lib/types";
import { canAccessAdmin, isAdmin } from "@/lib/authz";
import { hasSupabaseConfig } from "@/lib/supabaseClient";
import {
  getCurrentSupabaseUser,
  getProfile,
  getProfiles,
  signInWithEmail,
  signOutSupabase,
  signUpWithEmail,
  updateProfileStatus,
  upsertProfile,
} from "@/lib/supabaseRepositories";

const AUTH_USERS_KEY = "fc360:auth:users:v2";
const AUTH_SESSION_KEY = "fc360:auth:session:v1";
const GLOBAL_USER_REGISTRY_KEY = "users_global_registry";
const ONBOARDING_KEY_PREFIX = "fc360:onboarding:";
const ONBOARDING_DATA_KEY_PREFIX = "fc360:onboarding:data:";
const DEFAULT_ADMIN_EMAIL = "andriottidev@gmail.com";
const LOCAL_PASSWORD_VERSION = "mvp-local-v1";

// MVP/local auth service. This is intentionally isolated so the app can migrate
// to Firebase/Supabase/backend auth without touching screens. It is not a
// production identity provider; it only avoids storing plaintext passwords.
type StoredAuthUser = User & {
  passwordHash: string;
  passwordSalt: string;
  passwordVersion: typeof LOCAL_PASSWORD_VERSION;
  password?: string;
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
  financialPain?: "mix_money" | "money_disappears" | "no_profit" | "no_reserve";
  financialStructure?: "apertado" | "equilibrado" | "folga";
  goalConfidence?: "yes" | "almost" | "far";
  personalMonthlyGoal?: number;
  estimatedGrossMonthlyRevenue?: number;
  weeklyRevenueTarget?: number;
  dailyRevenueTarget?: number;
  projectedMonthlyGrossRevenue?: number;
  projectedWeeklyGrossRevenue?: number;
  projectedDailyGrossRevenue?: number;
  debts?: OnboardingDebtInput[];
  fixedExpenses?: OnboardingFixedExpenseInput[];
  flag_separacao?: boolean;
  focus?: "precificacao" | "seguranca" | null;
  porcentagens?: {
    negocio: number;
    pessoal: number;
    reserva: number;
  };
  metaMensal?: number;
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

function createPasswordSalt() {
  if (isBrowser() && window.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (item) => item.toString(36)).join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function hashLocalPassword(password: string, salt: string) {
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;
  const input = `${salt}:${password}`;

  for (let round = 0; round < 1200; round += 1) {
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index) + round;
      hashA ^= code;
      hashA = Math.imul(hashA, 0x01000193);
      hashB ^= code + hashA;
      hashB = Math.imul(hashB, 0x85ebca6b);
    }
  }

  return `${(hashA >>> 0).toString(36)}${(hashB >>> 0).toString(36)}`;
}

function createPasswordCredential(password: string) {
  const passwordSalt = createPasswordSalt();
  return {
    passwordHash: hashLocalPassword(password, passwordSalt),
    passwordSalt,
    passwordVersion: LOCAL_PASSWORD_VERSION,
  } as const;
}

function verifyPassword(stored: StoredAuthUser, password: string) {
  if (stored.passwordHash && stored.passwordSalt) {
    return hashLocalPassword(password, stored.passwordSalt) === stored.passwordHash;
  }

  return typeof stored.password === "string" && stored.password === password;
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
  return { role: "user" as const, status: "active" as const };
}

function defaultBusinessName(name?: string) {
  const safeName = name?.trim();
  return safeName ? `${safeName} Negocio` : "Meu Negócio";
}

function buildAppUserFromSupabase(params: { id: string; email?: string | null; name?: string | null }): User {
  const email = normalizeEmail(params.email ?? "");
  const access = roleAndStatusForEmail(email);
  const createdAt = nowIso();

  // TODO: migrate roles/status to Supabase profiles or server-side claims.
  return {
    id: params.id,
    name: params.name?.trim() || email.split("@")[0] || "Usuário",
    email,
    role: access.role,
    status: access.status,
    createdAt,
    lastLoginAt: createdAt,
    lastSeenAt: createdAt,
    onboardingCompleted: false,
    approvedAt: access.role === "admin" ? createdAt : undefined,
    approvedBy: access.role === "admin" ? "system" : undefined,
    phone: "",
    businessName: defaultBusinessName(params.name ?? undefined),
    businessType: "Servicos",
  };
}

function toPublicUser(stored: StoredAuthUser): User {
  const {
    password: _password,
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    passwordVersion: _passwordVersion,
    ...publicUser
  } = stored;
  return publicUser;
}

function coerceUserShape(user: Partial<StoredAuthUser>): StoredAuthUser {
  const email = normalizeEmail(user.email ?? "");
  const access = roleAndStatusForEmail(email);
  const createdAt = user.createdAt || nowIso();
  const fallbackCredential =
    user.passwordHash && user.passwordSalt
      ? {
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
          passwordVersion: LOCAL_PASSWORD_VERSION,
        } as const
      : createPasswordCredential(user.password || "123456");

  return {
    id: user.id || createUserId(),
    name: user.name || "Usuario",
    email,
    ...fallbackCredential,
    role: user.role === "admin" || user.role === "tester" || user.role === "user" ? user.role : access.role,
    status:
      user.status === "active" || user.status === "pending" || user.status === "blocked"
        ? user.status
        : access.status,
    createdAt,
    lastLoginAt: user.lastLoginAt || createdAt,
    lastSeenAt: user.lastSeenAt || user.lastLoginAt || createdAt,
    onboardingCompleted:
      typeof user.onboardingCompleted === "boolean"
        ? user.onboardingCompleted
        : user.id
          ? readOnboardingCompleted(user.id)
          : false,
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
  const safeUsers = users.map(({ password: _password, ...user }) => user);
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(safeUsers));
}

function readGlobalUserRegistry(): User[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(GLOBAL_USER_REGISTRY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<User>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => toPublicUser(coerceUserShape(item as Partial<StoredAuthUser>)));
  } catch {
    return [];
  }
}

function writeGlobalUserRegistry(users: User[]) {
  if (!isBrowser()) return;
  const unique = new Map<string, User>();
  users.forEach((item) => {
    if (!item.id) return;
    unique.set(item.id, item);
  });
  window.localStorage.setItem(GLOBAL_USER_REGISTRY_KEY, JSON.stringify(Array.from(unique.values())));
}

function persistUserInGlobalRegistry(user: User, options?: { lastLogin?: boolean; onboardingCompleted?: boolean }) {
  const now = nowIso();
  const onboardingCompleted = options?.onboardingCompleted ?? readOnboardingCompleted(user.id);
  const nextUser: User = {
    ...user,
    role: user.role ?? "user",
    createdAt: user.createdAt || now,
    lastLoginAt: options?.lastLogin ? now : user.lastLoginAt || now,
    lastSeenAt: now,
    onboardingCompleted,
  };
  const registry = readGlobalUserRegistry();
  const existing = registry.find((item) => item.id === nextUser.id);
  writeGlobalUserRegistry([
    {
      ...existing,
      ...nextUser,
      createdAt: existing?.createdAt ?? nextUser.createdAt,
      lastLoginAt: nextUser.lastLoginAt,
      lastSeenAt: nextUser.lastSeenAt,
      onboardingCompleted,
    },
    ...registry.filter((item) => item.id !== nextUser.id),
  ]);
  return nextUser;
}

function mergeManagedUsers(primary: User[], fallback: User[]) {
  const users = new Map<string, User>();
  [...fallback, ...primary].forEach((item) => {
    const onboardingCompleted = item.onboardingCompleted ?? readOnboardingCompleted(item.id);
    users.set(item.id, {
      ...users.get(item.id),
      ...item,
      onboardingCompleted,
      lastSeenAt: item.lastSeenAt ?? item.lastLoginAt,
    });
  });
  return Array.from(users.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  const users = readUsers();
  const found = users.find((item) => item.id === userId);
  if (found) {
    const updated = { ...found, onboardingCompleted: completed };
    writeUsers(users.map((item) => (item.id === userId ? updated : item)));
    persistUserInGlobalRegistry(toPublicUser(updated), { onboardingCompleted: completed });
  } else {
    const registryUser = readGlobalUserRegistry().find((item) => item.id === userId);
    if (registryUser) persistUserInGlobalRegistry(registryUser, { onboardingCompleted: completed });
  }
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
    const financialPain =
      parsed.financialPain === "mix_money" ||
      parsed.financialPain === "money_disappears" ||
      parsed.financialPain === "no_profit" ||
      parsed.financialPain === "no_reserve"
        ? parsed.financialPain
        : undefined;
    const financialStructure =
      parsed.financialStructure === "apertado" ||
      parsed.financialStructure === "equilibrado" ||
      parsed.financialStructure === "folga"
        ? parsed.financialStructure
        : undefined;
    const goalConfidence =
      parsed.goalConfidence === "yes" || parsed.goalConfidence === "almost" || parsed.goalConfidence === "far"
        ? parsed.goalConfidence
        : undefined;
    const personalMonthlyGoal =
      typeof parsed.personalMonthlyGoal === "number" &&
      Number.isFinite(parsed.personalMonthlyGoal) &&
      parsed.personalMonthlyGoal >= 0
        ? parsed.personalMonthlyGoal
        : undefined;
    const estimatedGrossMonthlyRevenue =
      typeof parsed.estimatedGrossMonthlyRevenue === "number" &&
      Number.isFinite(parsed.estimatedGrossMonthlyRevenue) &&
      parsed.estimatedGrossMonthlyRevenue >= 0
        ? parsed.estimatedGrossMonthlyRevenue
        : undefined;
    const weeklyRevenueTarget =
      typeof parsed.weeklyRevenueTarget === "number" &&
      Number.isFinite(parsed.weeklyRevenueTarget) &&
      parsed.weeklyRevenueTarget >= 0
        ? parsed.weeklyRevenueTarget
        : undefined;
    const dailyRevenueTarget =
      typeof parsed.dailyRevenueTarget === "number" &&
      Number.isFinite(parsed.dailyRevenueTarget) &&
      parsed.dailyRevenueTarget >= 0
        ? parsed.dailyRevenueTarget
        : undefined;
    const projectedMonthlyGrossRevenue =
      typeof parsed.projectedMonthlyGrossRevenue === "number" &&
      Number.isFinite(parsed.projectedMonthlyGrossRevenue) &&
      parsed.projectedMonthlyGrossRevenue >= 0
        ? parsed.projectedMonthlyGrossRevenue
        : undefined;
    const projectedWeeklyGrossRevenue =
      typeof parsed.projectedWeeklyGrossRevenue === "number" &&
      Number.isFinite(parsed.projectedWeeklyGrossRevenue) &&
      parsed.projectedWeeklyGrossRevenue >= 0
        ? parsed.projectedWeeklyGrossRevenue
        : undefined;
    const projectedDailyGrossRevenue =
      typeof parsed.projectedDailyGrossRevenue === "number" &&
      Number.isFinite(parsed.projectedDailyGrossRevenue) &&
      parsed.projectedDailyGrossRevenue >= 0
        ? parsed.projectedDailyGrossRevenue
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
    const focus =
      parsed.focus === "precificacao" || parsed.focus === "seguranca" || parsed.focus === null
        ? parsed.focus
        : undefined;
    const porcentagens =
      parsed.porcentagens &&
      typeof parsed.porcentagens === "object" &&
      typeof parsed.porcentagens.negocio === "number" &&
      typeof parsed.porcentagens.pessoal === "number" &&
      typeof parsed.porcentagens.reserva === "number" &&
      Number.isFinite(parsed.porcentagens.negocio) &&
      Number.isFinite(parsed.porcentagens.pessoal) &&
      Number.isFinite(parsed.porcentagens.reserva)
        ? {
            negocio: parsed.porcentagens.negocio,
            pessoal: parsed.porcentagens.pessoal,
            reserva: parsed.porcentagens.reserva,
          }
        : undefined;
    const metaMensal =
      typeof parsed.metaMensal === "number" && Number.isFinite(parsed.metaMensal) && parsed.metaMensal >= 0
        ? parsed.metaMensal
        : undefined;

    return {
      step,
      usageMode,
      monthlyIncome: metaMensal !== undefined ? undefined : monthlyIncome,
      financialMode,
      financialPain,
      financialStructure,
      goalConfidence,
      personalMonthlyGoal,
      estimatedGrossMonthlyRevenue,
      weeklyRevenueTarget,
      dailyRevenueTarget,
      projectedMonthlyGrossRevenue,
      projectedWeeklyGrossRevenue,
      projectedDailyGrossRevenue,
      debts,
      fixedExpenses,
      flag_separacao: typeof parsed.flag_separacao === "boolean" ? parsed.flag_separacao : undefined,
      focus,
      porcentagens,
      metaMensal,
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
  writeGlobalUserRegistry(mergeManagedUsers(users.map(toPublicUser), readGlobalUserRegistry()));
}

export function authenticateUser(email: string, password: string): AuthResult {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const found = users.find((item) => normalizeEmail(item.email) === normalizedEmail);

  if (!found || !verifyPassword(found, password)) {
    return { ok: false, error: "Email ou senha incorretos" };
  }

  const now = nowIso();
  const updated: StoredAuthUser = {
    ...found,
    ...createPasswordCredential(password),
    password: undefined,
    lastLoginAt: now,
    lastSeenAt: now,
    onboardingCompleted: readOnboardingCompleted(found.id),
  };
  writeUsers(users.map((item) => (item.id === updated.id ? updated : item)));
  persistUserInGlobalRegistry(toPublicUser(updated), { lastLogin: true, onboardingCompleted: updated.onboardingCompleted });
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
    return { ok: false, error: "Este email já está cadastrado" };
  }

  const safeName = input.name?.trim();
  const createdAt = nowIso();
  const access = roleAndStatusForEmail(normalizedEmail);
  const newUser: StoredAuthUser = {
    id: createUserId(),
    name: safeName || "Novo Usuário",
    email: normalizedEmail,
    ...createPasswordCredential(input.password),
    role: access.role,
    status: access.status,
    createdAt,
    lastLoginAt: createdAt,
    lastSeenAt: createdAt,
    onboardingCompleted: false,
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
  persistUserInGlobalRegistry(toPublicUser(newUser), { lastLogin: true, onboardingCompleted: false });
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
    return { ok: false, error: "Email não encontrado" };
  }
  return { ok: true, message: "Se o email existir, enviaremos instruções de recuperação." };
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
          onboardingCompleted: nextUser.onboardingCompleted ?? readOnboardingCompleted(nextUser.id),
        }
      : item
  );
  writeUsers(next);
  persistUserInGlobalRegistry(nextUser, { onboardingCompleted: nextUser.onboardingCompleted });
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
  const now = nowIso();
  const updated = {
    ...found,
    lastSeenAt: now,
    onboardingCompleted: readOnboardingCompleted(found.id),
  };
  writeUsers(users.map((item) => (item.id === updated.id ? updated : item)));
  persistUserInGlobalRegistry(toPublicUser(updated), { onboardingCompleted: updated.onboardingCompleted });

  return {
    user: toPublicUser(updated),
    onboardingCompleted: updated.onboardingCompleted,
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
    merged.monthlyIncome < 0 ||
    typeof nextData.metaMensal === "number"
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
  return mergeManagedUsers(readUsers().map(toPublicUser), readGlobalUserRegistry());
}

export async function listManagedUsersFromBestSource(requester: User): Promise<User[]> {
  if (!canAccessAdmin(requester)) return [];
  const localUsers = listManagedUsers(requester);
  if (!hasSupabaseConfig) return localUsers;

  const remote = await getProfiles();
  if (remote.error || !remote.data) return localUsers;

  const merged = mergeManagedUsers(remote.data, localUsers);
  writeGlobalUserRegistry(merged);
  return merged;
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
  const registry = readGlobalUserRegistry();
  const target = users.find((item) => item.id === targetUserId) ?? registry.find((item) => item.id === targetUserId);
  if (!target) return { ok: false, error: "Usuário não encontrado" };
  if (isAdmin(target) && status === "blocked") {
    return { ok: false, error: "Não é permitido bloquear administradores" };
  }

  const approvedAt = status === "active" ? target.approvedAt ?? nowIso() : target.approvedAt;
  const approvedBy = status === "active" ? target.approvedBy ?? requester.email : target.approvedBy;

  if (users.some((item) => item.id === targetUserId)) {
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
  }
  persistUserInGlobalRegistry({ ...target, status, approvedAt, approvedBy });
  if (hasSupabaseConfig) {
    void updateProfileStatus(targetUserId, status);
  }

  return { ok: true };
}

export function getConfiguredAdminEmails() {
  return Array.from(ADMIN_EMAILS.values());
}

async function loginWithSupabase(email: string, password: string): Promise<AuthResult> {
  const result = await signInWithEmail(normalizeEmail(email), password);
  if (result.error || !("data" in result) || !result.data?.user) {
    return { ok: false, error: "Email ou senha incorretos" };
  }

  const profile = await getProfile(result.data.user.id);
  let appUser = profile.data;

  if (!appUser) {
    appUser = buildAppUserFromSupabase({
      id: result.data.user.id,
      email: result.data.user.email,
      name: result.data.user.user_metadata?.name,
    });
  }
  const now = nowIso();
  appUser = {
    ...appUser,
    lastLoginAt: now,
    lastSeenAt: now,
    onboardingCompleted: readOnboardingCompleted(appUser.id),
  };
  await upsertProfile(appUser);

  persistUserInGlobalRegistry(appUser, { lastLogin: true, onboardingCompleted: appUser.onboardingCompleted });
  writeSession(appUser.id);
  return {
    ok: true,
    user: appUser,
    onboardingCompleted: readOnboardingCompleted(appUser.id),
  };
}

async function registerWithSupabase(input: CreateAccountInput): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const result = await signUpWithEmail(normalizedEmail, input.password, input.name);

  if (result.error || !("data" in result) || !result.data?.user) {
    return { ok: false, error: "Não foi possível criar a conta agora" };
  }

  const appUser = buildAppUserFromSupabase({
    id: result.data.user.id,
    email: result.data.user.email ?? normalizedEmail,
    name: input.name,
  });
  const profile = await upsertProfile({
    ...appUser,
    onboardingCompleted: false,
  });

  if (profile.error) {
    return { ok: false, error: "Conta criada, mas não foi possível preparar o perfil" };
  }

  writeOnboardingCompleted(appUser.id, false);
  persistUserInGlobalRegistry(profile.data ?? appUser, { lastLogin: true, onboardingCompleted: false });
  writeSession(appUser.id);

  return {
    ok: true,
    user: profile.data ?? appUser,
    onboardingCompleted: false,
  };
}

async function restoreSupabaseSession(): Promise<{ user: User; onboardingCompleted: boolean } | null> {
  const current = await getCurrentSupabaseUser();
  if (current.error || !current.data) {
    writeSession(null);
    return null;
  }

  const profile = await getProfile(current.data.id);
  let appUser = profile.data;

  if (!appUser) {
    appUser = buildAppUserFromSupabase({
      id: current.data.id,
      email: current.data.email,
      name: current.data.user_metadata?.name,
    });
  }
  appUser = {
    ...appUser,
    lastSeenAt: nowIso(),
    onboardingCompleted: readOnboardingCompleted(appUser.id),
  };
  await upsertProfile(appUser);

  persistUserInGlobalRegistry(appUser, { onboardingCompleted: appUser.onboardingCompleted });
  writeSession(appUser.id);
  return {
    user: appUser,
    onboardingCompleted: readOnboardingCompleted(appUser.id),
  };
}

export const AuthService = {
  login: (email: string, password: string) =>
    hasSupabaseConfig ? loginWithSupabase(email, password) : Promise.resolve(authenticateUser(email, password)),
  register: (input: CreateAccountInput) =>
    hasSupabaseConfig ? registerWithSupabase(input) : Promise.resolve(createAccount(input)),
  logout: async () => {
    if (hasSupabaseConfig) {
      await signOutSupabase();
    }
    clearAuthSession();
  },
  getCurrentUser: () =>
    hasSupabaseConfig ? restoreSupabaseSession() : Promise.resolve(restoreAuthSession()),
  isAdmin,
};
