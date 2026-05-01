import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Account,
  Achievement,
  AdjustmentAccount,
  AppContextType,
  Client,
  Cost,
  Insight,
  Notification,
  NotificationType,
  OnboardingDebtInput,
  OnboardingFinancialMode,
  OnboardingFixedExpenseInput,
  OnboardingUsageMode,
  PaymentAccount,
  PotDistribution,
  PaymentFeeSetting,
  Pot,
  PotType,
  ProductItem,
  SalesItem,
  ScreenType,
  Service,
  ServiceSupplyLink,
  SupplyItem,
  Transaction,
  TransactionInput,
  TransactionType,
  User,
} from "@/lib/types";
import {
  ACCOUNTS,
  ACHIEVEMENTS,
  CLIENTS,
  COSTS,
  INSIGHTS,
  NOTIFICATIONS,
  PAYMENT_ACCOUNTS,
  POTS,
  SALES_ITEMS,
  SERVICES,
} from "@/lib/constants";
import {
  AuthService,
  bootstrapAuthUsers,
  clearUserOnboardingData,
  clearAuthSession,
  persistAuthSession,
  updateAuthUserProfile,
} from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabaseClient";
import {
  getClients as getSupabaseClients,
  getCosts as getSupabaseCosts,
  getPots as getSupabasePots,
  getTransactions as getSupabaseTransactions,
  deleteClient as deleteSupabaseClient,
  deleteCost as deleteSupabaseCost,
  insertClient as insertSupabaseClient,
  insertCost as insertSupabaseCost,
  insertTransaction as insertSupabaseTransaction,
  upsertClients as upsertSupabaseClients,
  upsertCosts as upsertSupabaseCosts,
  upsertPots as upsertSupabasePots,
  upsertTransactions as upsertSupabaseTransactions,
} from "@/lib/supabaseRepositories";

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_DATA_KEY_PREFIX = "fc360:data:";
const SUPABASE_MIGRATION_KEY_PREFIX = "fc360:supabase:migrated:";

type UserScopedData = {
  accounts: Account[];
  pots: Pot[];
  services: Service[];
  clients: Client[];
  transactions: Transaction[];
  paymentAccounts: PaymentAccount[];
  insights: Insight[];
  notifications: Notification[];
  achievements: Achievement[];
  salesItems: SalesItem[];
  costs: Cost[];
  supplies: SupplyItem[];
  products: ProductItem[];
  serviceSupplyLinks: ServiceSupplyLink[];
  paymentFeeSettings: PaymentFeeSetting[];
  adjustmentAccounts: AdjustmentAccount[];
  potDistribution: PotDistribution;
};

type AchievementTemplate = Pick<Achievement, "id" | "title" | "description" | "icon" | "color"> & {
  toastMessage: string;
};

const ACHIEVEMENT_TEMPLATES: Record<"first_record" | "seven_days" | "reserve_created", AchievementTemplate> = {
  first_record: {
    id: "ach-first-record",
    title: "Primeiro registro financeiro",
    description: "Você fez seu primeiro lançamento e começou a organizar seu dinheiro.",
    icon: "Primeiro passo",
    color: "from-emerald-500 to-emerald-600",
    toastMessage: "🎉 Você desbloqueou: Primeiro passo financeiro!",
  },
  seven_days: {
    id: "ach-7-days",
    title: "7 dias de uso",
    description: "Você manteve consistência e completou 7 dias de uso no FluxoCerto.",
    icon: "Consistência",
    color: "from-blue-500 to-blue-600",
    toastMessage: "🎉 Você desbloqueou: 7 dias de consistência!",
  },
  reserve_created: {
    id: "ach-reserve-created",
    title: "Criou reserva",
    description: "Sua reserva saiu do zero. Você está construindo segurança financeira.",
    icon: "Reserva",
    color: "from-amber-500 to-amber-600",
    toastMessage: "🎉 Você desbloqueou: Reserva criada!",
  },
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clampCurrency(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

function mergeRecordsById<T extends { id: string }>(localItems: T[], remoteItems: T[]) {
  const merged = new Map<string, T>();
  localItems.forEach((item) => merged.set(item.id, item));
  remoteItems.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function sortTransactionsForDisplay(items: Transaction[]) {
  return [...items].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

function resolveConfiguredFeePercent(transaction: TransactionInput, feeSettings: PaymentFeeSetting[]) {
  const fee = transaction.paymentMethod
    ? feeSettings.find((item) => item.method === transaction.paymentMethod)
    : undefined;
  return fee?.enabled ? Number(Math.max(0, fee.feePercent).toFixed(2)) : 0;
}

function normalizeNewIncomeAmounts(transaction: TransactionInput, feeSettings: PaymentFeeSetting[]) {
  const grossAmount = clampCurrency(Math.abs(Number(transaction.grossAmount ?? transaction.amount)));
  const feePercent = resolveConfiguredFeePercent(transaction, feeSettings);
  const feeAmount = clampCurrency(Math.min(grossAmount, grossAmount * (feePercent / 100)));
  return {
    amount: grossAmount,
    grossAmount,
    feePercent,
    feeAmount,
    netAmount: clampCurrency(grossAmount - feeAmount),
  };
}

function normalizeStoredIncomeAmounts(transaction: TransactionInput, feeSettings: PaymentFeeSetting[]) {
  const grossAmount = clampCurrency(Math.abs(Number(transaction.grossAmount ?? transaction.amount)));
  const feePercent = Number(transaction.feePercent);
  const feeAmount = Number(transaction.feeAmount);
  const netAmount = Number(transaction.netAmount);
  const configuredFeePercent = resolveConfiguredFeePercent(transaction, feeSettings);
  const normalizedFeePercent =
    Number.isFinite(feePercent) && feePercent >= 0 && (feePercent > 0 || configuredFeePercent === 0)
      ? Number(feePercent.toFixed(2))
      : configuredFeePercent;
  const normalizedFeeAmount =
    Number.isFinite(feeAmount) && (feeAmount > 0 || normalizedFeePercent === 0)
      ? clampCurrency(Math.min(grossAmount, feeAmount))
      : clampCurrency(Math.min(grossAmount, grossAmount * (normalizedFeePercent / 100)));

  return {
    amount: grossAmount,
    grossAmount,
    feePercent: normalizedFeePercent,
    feeAmount: normalizedFeeAmount,
    netAmount: Number.isFinite(netAmount)
      ? clampCurrency(Math.min(netAmount, grossAmount - normalizedFeeAmount))
      : clampCurrency(grossAmount - normalizedFeeAmount),
  };
}

type OnboardingPotBlueprint = {
  personal: Pick<Pot, "name" | "icon">;
  business: Pick<Pot, "name" | "icon">;
  reserve: Pick<Pot, "name" | "icon">;
  distribution: PotDistribution;
};

function getOnboardingPotBlueprint(mode: OnboardingUsageMode): OnboardingPotBlueprint {
  if (mode === "personal") {
    return {
      personal: { name: "Liberdade", icon: "Pessoal" },
      business: { name: "Contas Fixas", icon: "Contas" },
      reserve: { name: "Reserva", icon: "Reserva" },
      distribution: { personal: 50, business: 40, reserve: 10 },
    };
  }
  if (mode === "business") {
    return {
      personal: { name: "Negócio", icon: "Negocio" },
      business: { name: "Impostos/Taxas", icon: "Impostos" },
      reserve: { name: "Reserva", icon: "Reserva" },
      distribution: { personal: 70, business: 20, reserve: 10 },
    };
  }
  return {
    personal: { name: "Pessoal", icon: "Pessoal" },
    business: { name: "Negócio", icon: "Negocio" },
    reserve: { name: "Reserva", icon: "Reserva" },
    distribution: { personal: 50, business: 40, reserve: 10 },
  };
}

function buildFinancialModeMessage(mode: OnboardingFinancialMode) {
  if (mode === "chaos") {
    return {
      insight: "Modo alerta forte ativado. A prioridade agora é proteger seu caixa e cortar vazamentos.",
      action: "Sair do descontrole",
      notification: "Alerta forte ativo: evite gastos não essenciais até estabilizar o fluxo.",
    };
  }
  if (mode === "breakEven") {
    return {
      insight: "Modo controle de gastos ativado. Vamos transformar empates em sobra mensal.",
      action: "Fazer sobrar dinheiro",
      notification: "Controle de gastos ativo: revise saídas recorrentes e negocie custos.",
    };
  }
  if (mode === "surplus") {
    return {
      insight: "Modo reserva e investimento ativado. Foque em consistência e segurança.",
      action: "Fortalecer reserva",
      notification: "Reserva e investimento ativos: mantenha aportes frequentes para ganhar segurança.",
    };
  }
  return {
    insight: "Modo crescimento ativado. Priorize lucro, precificação e oportunidades de escala.",
    action: "Aumentar lucro e escala",
    notification: "Crescimento ativo: acompanhe margem e oportunidades para expandir com controle.",
  };
}

function buildDefaultPaymentFees(): PaymentFeeSetting[] {
  return [
    { method: "credito", label: "Credito", enabled: true, feePercent: 3.49 },
    { method: "debito", label: "Debito", enabled: true, feePercent: 1.89 },
    { method: "voucher", label: "Voucher", enabled: false, feePercent: 4.9 },
    { method: "alimentacao", label: "Alimentacao", enabled: false, feePercent: 4.5 },
    { method: "pix", label: "PIX", enabled: true, feePercent: 0.99 },
  ];
}

function buildDefaultPotDistribution(): PotDistribution {
  return {
    personal: 50,
    business: 40,
    reserve: 10,
  };
}

function normalizePotDistribution(value?: Partial<PotDistribution>): PotDistribution {
  const fallback = buildDefaultPotDistribution();
  if (!value) return fallback;

  const personal = Number(value.personal);
  const business = Number(value.business);
  const reserve = Number(value.reserve);
  const allValid = [personal, business, reserve].every((item) => Number.isFinite(item) && item >= 0);
  const total = personal + business + reserve;

  if (!allValid || Math.abs(total - 100) > 0.001) {
    return fallback;
  }

  return {
    personal: Number(personal.toFixed(2)),
    business: Number(business.toFixed(2)),
    reserve: Number(reserve.toFixed(2)),
  };
}

function getPotPercentage(type: PotType, distribution: PotDistribution) {
  if (type === PotType.PERSONAL) return distribution.personal;
  if (type === PotType.BUSINESS) return distribution.business;
  return distribution.reserve;
}

function calculateAverageMonthlyIncome(transactions: Transaction[]) {
  const monthTotals = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.type !== TransactionType.INCOME) return;
    const parsed = new Date(tx.date);
    if (Number.isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + Math.max(0, tx.amount));
  });
  if (monthTotals.size === 0) return 0;
  const total = Array.from(monthTotals.values()).reduce((sum, value) => sum + value, 0);
  return clampCurrency(total / monthTotals.size);
}

function resolvePotGoalValue(type: PotType, referenceMonthlyIncome: number) {
  if (referenceMonthlyIncome <= 0) return 0;
  if (type === PotType.RESERVE) return clampCurrency(referenceMonthlyIncome * 3);
  if (type === PotType.BUSINESS) return clampCurrency(referenceMonthlyIncome * 2);
  return clampCurrency(referenceMonthlyIncome);
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyData(): UserScopedData {
  const distribution = buildDefaultPotDistribution();
  return {
    accounts: cloneData(ACCOUNTS).map((account) => ({
      ...account,
      balance: 0,
    })),
    pots: cloneData(POTS).map((pot) => ({
      ...pot,
      balance: 0,
      percentage: getPotPercentage(pot.type, distribution),
      goalValue: 0,
      limit: 0,
    })),
    services: [] as Service[],
    clients: [] as Client[],
    transactions: [] as Transaction[],
    paymentAccounts: [] as PaymentAccount[],
    insights: [] as Insight[],
    notifications: [] as Notification[],
    achievements: [] as Achievement[],
    salesItems: [] as SalesItem[],
    costs: [] as Cost[],
    supplies: [] as SupplyItem[],
    products: [] as ProductItem[],
    serviceSupplyLinks: [] as ServiceSupplyLink[],
    paymentFeeSettings: buildDefaultPaymentFees(),
    adjustmentAccounts: [] as AdjustmentAccount[],
    potDistribution: distribution,
  };
}

function attachOwner<T extends { ownerId?: string }>(items: T[], ownerId: string) {
  return items
    .filter((item) => !item.ownerId || item.ownerId === ownerId)
    .map((item) => ({ ...item, ownerId }));
}

function isOnboardingSeedTransaction(transaction: Transaction) {
  return (
    transaction.notes === "onboarding-seed-income" ||
    (transaction.origin === "Onboarding" &&
      transaction.category === "onboarding" &&
      transaction.description === "Saldo inicial configurado no onboarding")
  );
}

function getTransactionMovementAmount(transaction: Transaction) {
  if (transaction.type === TransactionType.INCOME) {
    return clampCurrency(Number(transaction.netAmount ?? transaction.amount));
  }
  return clampCurrency(Number(transaction.amount));
}

function rebuildFinancialBalances(
  accounts: Account[],
  pots: Pot[],
  transactions: Transaction[],
  distribution: PotDistribution
) {
  const nextAccounts = accounts.map((account) => ({ ...account, balance: 0 }));
  const nextPots = pots.map((pot) => ({ ...pot, balance: 0 }));

  transactions.forEach((transaction) => {
    const movementAmount = getTransactionMovementAmount(transaction);

    if (transaction.type === TransactionType.INCOME) {
      nextAccounts.forEach((account) => {
        if (account.name === transaction.account) {
          account.balance = Number((account.balance + movementAmount).toFixed(2));
        }
      });

      const personalPot = nextPots.find((pot) => pot.type === PotType.PERSONAL);
      const businessPot = nextPots.find((pot) => pot.type === PotType.BUSINESS);
      const reservePot = nextPots.find((pot) => pot.type === PotType.RESERVE);

      if (personalPot && businessPot && reservePot) {
        const personalAmount = Number(((movementAmount * distribution.personal) / 100).toFixed(2));
        const businessAmount = Number(((movementAmount * distribution.business) / 100).toFixed(2));
        const reserveAmount = Number((movementAmount - personalAmount - businessAmount).toFixed(2));
        personalPot.balance = Number((personalPot.balance + personalAmount).toFixed(2));
        businessPot.balance = Number((businessPot.balance + businessAmount).toFixed(2));
        reservePot.balance = Number((reservePot.balance + reserveAmount).toFixed(2));
        return;
      }
    }

    const target = transaction.potId
      ? nextPots.find((pot) => pot.id === transaction.potId)
      : resolvePotByType(transaction.type, nextPots);

    if (!target) return;
    const signedAmount = transaction.type === TransactionType.INCOME ? movementAmount : -movementAmount;
    target.balance = Number((target.balance + signedAmount).toFixed(2));
  });

  return { accounts: nextAccounts, pots: nextPots };
}

function normalizeOwnedData(userId: string, data: UserScopedData): UserScopedData {
  const distribution = normalizePotDistribution(data.potDistribution);
  const paymentFeeSettings = attachOwner(data.paymentFeeSettings, userId);
  const normalizedAccounts = attachOwner(data.accounts, userId);
  const normalizedPots = attachOwner(data.pots, userId).map((pot) => ({
    ...pot,
    percentage: Number.isFinite(pot.percentage) ? pot.percentage : getPotPercentage(pot.type, distribution),
    goalValue: Number.isFinite(pot.goalValue) ? pot.goalValue : clampCurrency(pot.limit ?? 0),
    limit: clampCurrency(pot.limit ?? pot.goalValue ?? 0),
  }));
  const ownedTransactions = attachOwner(data.transactions, userId);
  const hadOnboardingSeed = ownedTransactions.some(isOnboardingSeedTransaction);
  const normalizedTransactions = ownedTransactions
    .filter((transaction) => !isOnboardingSeedTransaction(transaction))
    .map((transaction) => {
      if (transaction.type !== TransactionType.INCOME) return transaction;
      return {
        ...transaction,
        ...normalizeStoredIncomeAmounts(transaction, paymentFeeSettings),
      };
    });
  const rebuilt = normalizedTransactions.length || hadOnboardingSeed
    ? rebuildFinancialBalances(normalizedAccounts, normalizedPots, normalizedTransactions, distribution)
    : { accounts: normalizedAccounts, pots: normalizedPots };

  return {
    accounts: rebuilt.accounts,
    pots: rebuilt.pots,
    services: attachOwner(data.services, userId),
    clients: attachOwner(data.clients, userId),
    transactions: normalizedTransactions,
    paymentAccounts: attachOwner(data.paymentAccounts, userId),
    insights: attachOwner(data.insights, userId),
    notifications: attachOwner(data.notifications, userId),
    achievements: attachOwner(data.achievements, userId),
    salesItems: attachOwner(data.salesItems, userId),
    costs: attachOwner(data.costs, userId),
    supplies: attachOwner(data.supplies, userId),
    products: attachOwner(data.products, userId),
    serviceSupplyLinks: attachOwner(data.serviceSupplyLinks, userId),
    paymentFeeSettings,
    adjustmentAccounts: attachOwner(data.adjustmentAccounts, userId),
    potDistribution: distribution,
  };
}

function loadUserScopedData(userId: string): UserScopedData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${USER_DATA_KEY_PREFIX}${userId}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<UserScopedData>;
    const fallback = createEmptyData();
    return {
      accounts: parsed.accounts ?? fallback.accounts,
      pots: parsed.pots ?? fallback.pots,
      services: parsed.services ?? fallback.services,
      clients: parsed.clients ?? fallback.clients,
      transactions: parsed.transactions ?? fallback.transactions,
      paymentAccounts: parsed.paymentAccounts ?? fallback.paymentAccounts,
      insights: parsed.insights ?? fallback.insights,
      notifications: parsed.notifications ?? fallback.notifications,
      achievements: parsed.achievements ?? fallback.achievements,
      salesItems: parsed.salesItems ?? fallback.salesItems,
      costs: parsed.costs ?? fallback.costs,
      supplies: parsed.supplies ?? fallback.supplies,
      products: parsed.products ?? fallback.products,
      serviceSupplyLinks: parsed.serviceSupplyLinks ?? fallback.serviceSupplyLinks,
      paymentFeeSettings: parsed.paymentFeeSettings ?? fallback.paymentFeeSettings,
      adjustmentAccounts: parsed.adjustmentAccounts ?? fallback.adjustmentAccounts,
      potDistribution: normalizePotDistribution(parsed.potDistribution),
    };
  } catch {
    return null;
  }
}

function getSupabaseMigrationKey(userId: string) {
  return `${SUPABASE_MIGRATION_KEY_PREFIX}${userId}`;
}

function hasMigratedToSupabase(userId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getSupabaseMigrationKey(userId)) === "true";
}

function markMigratedToSupabase(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getSupabaseMigrationKey(userId), "true");
}

function hasLocalFinancialData(data: UserScopedData) {
  return (
    data.transactions.length > 0 ||
    data.clients.length > 0 ||
    data.costs.length > 0 ||
    data.pots.some((pot) => Math.abs(pot.balance) > 0 || Math.abs(pot.goalValue ?? 0) > 0 || Math.abs(pot.limit ?? 0) > 0)
  );
}

function buildInitialTransactions(costs: Cost[]): Transaction[] {
  const baseIncome: Transaction[] = [
    {
      id: createId("tx"),
      type: TransactionType.INCOME,
      description: "Cortes do dia",
      amount: 760,
      date: todayIso(),
      category: "servico",
      account: "Conta Corrente",
      potId: "pot-002",
      origin: "Agenda",
      paymentMethod: "pix",
    },
    {
      id: createId("tx"),
      type: TransactionType.INCOME,
      description: "Vendas de produtos",
      amount: 190,
      date: todayIso(),
      category: "produto",
      account: "Conta Corrente",
      potId: "pot-002",
      origin: "Balcao",
      paymentMethod: "debito",
    },
  ];

  const costTransactions: Transaction[] = costs.slice(0, 3).map((cost) => ({
    id: createId("tx"),
    type: TransactionType.EXPENSE,
    description: cost.name,
    amount: cost.amount,
    date: cost.date,
    category: cost.category,
    account: "Conta Corrente",
    potId: "pot-002",
    origin: "Custo operacional",
    paymentMethod: "transferencia",
  }));

  return [...baseIncome, ...costTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function resolvePotByType(type: TransactionType, availablePots: Pot[]) {
  if (type === TransactionType.INCOME) {
    return availablePots.find((pot) => pot.type === PotType.BUSINESS) ?? availablePots[0];
  }
  return availablePots.find((pot) => pot.type === PotType.PERSONAL) ?? availablePots[0];
}

function validateTransactionInput(transaction: TransactionInput) {
  if (![TransactionType.INCOME, TransactionType.EXPENSE].includes(transaction.type)) {
    return "Tipo de transação inválido";
  }
  if (!transaction.description?.trim()) return "Descrição obrigatória";
  if (!transaction.category?.trim()) return "Categoria obrigatória";

  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Valor deve ser maior que zero";

  if (!transaction.date || Number.isNaN(new Date(transaction.date).getTime())) return "Data inválida";
  if (!transaction.account?.trim()) return "Conta obrigatoria";
  return null;
}

function validateServiceInput(service: Omit<Service, "id"> & { id?: string }) {
  if (!service.name?.trim()) return "Nome do serviço é obrigatório";
  if (!service.description?.trim()) return "Descrição do serviço é obrigatória";
  if (!Number.isFinite(service.price) || service.price <= 0) return "Valor do serviço inválido";
  if (!Number.isFinite(service.duration) || service.duration <= 0) return "Duração do serviço inválida";
  return null;
}

function validateCostInput(cost: Omit<Cost, "id"> & { id?: string }) {
  if (!cost.name?.trim()) return "Nome do custo é obrigatório";
  if (!cost.category?.trim()) return "Categoria obrigatória";
  if (!Number.isFinite(cost.amount) || cost.amount <= 0) return "Valor do custo inválido";
  if (!cost.date || Number.isNaN(new Date(cost.date).getTime())) return "Data inválida";
  return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const baseData = createEmptyData();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.LANDING);
  const [user, setUserState] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(baseData.accounts);
  const [pots, setPots] = useState<Pot[]>(baseData.pots);
  const [services, setServices] = useState<Service[]>(baseData.services);
  const [clients, setClients] = useState<Client[]>(baseData.clients);
  const [transactions, setTransactions] = useState<Transaction[]>(baseData.transactions);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>(baseData.paymentAccounts);
  const [insights, setInsights] = useState<Insight[]>(baseData.insights);
  const [notifications, setNotifications] = useState<Notification[]>(baseData.notifications);
  const [achievements, setAchievements] = useState<Achievement[]>(baseData.achievements);
  const [salesItems, setSalesItems] = useState<SalesItem[]>(baseData.salesItems);
  const [costs, setCosts] = useState<Cost[]>(baseData.costs);
  const [supplies, setSupplies] = useState<SupplyItem[]>(baseData.supplies);
  const [products, setProducts] = useState<ProductItem[]>(baseData.products);
  const [serviceSupplyLinks, setServiceSupplyLinks] = useState<ServiceSupplyLink[]>(baseData.serviceSupplyLinks);
  const [paymentFeeSettings, setPaymentFeeSettings] = useState<PaymentFeeSetting[]>(baseData.paymentFeeSettings);
  const [adjustmentAccounts, setAdjustmentAccounts] = useState<AdjustmentAccount[]>(baseData.adjustmentAccounts);
  const [potDistribution, setPotDistributionState] = useState<PotDistribution>(baseData.potDistribution);
  const [isSupabaseSyncReady, setIsSupabaseSyncReady] = useState(false);
  const isSupabaseHydratingRef = useRef(false);
  const lastSupabaseSyncSignatureRef = useRef("");
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const unlockAchievement = useCallback(
    (key: keyof typeof ACHIEVEMENT_TEMPLATES) => {
      if (!user?.id) return;
      const template = ACHIEVEMENT_TEMPLATES[key];
      let unlockedNow = false;

      setAchievements((prev) => {
        if (prev.some((item) => item.id === template.id)) {
          return prev;
        }
        unlockedNow = true;
        return [
          {
            id: template.id,
            ownerId: user.id,
            title: template.title,
            description: template.description,
            icon: template.icon,
            color: template.color,
            unlockedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });

      if (!unlockedNow) return;

      setNotifications((prev) => [
        {
          id: createId("notif"),
          ownerId: user.id,
          type: NotificationType.SUCCESS,
          title: "Conquista desbloqueada",
          message: template.toastMessage,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ]);
      toast.success(template.toastMessage);
    },
    [user?.id]
  );

  const applyUserData = useCallback((nextData: UserScopedData) => {
    setAccounts(nextData.accounts);
    setPots(nextData.pots);
    setServices(nextData.services);
    setClients(nextData.clients);
    setTransactions(nextData.transactions);
    setPaymentAccounts(nextData.paymentAccounts);
    setInsights(nextData.insights);
    setNotifications(nextData.notifications);
    setAchievements(nextData.achievements);
    setSalesItems(nextData.salesItems);
    setCosts(nextData.costs);
    setSupplies(nextData.supplies);
    setProducts(nextData.products);
    setServiceSupplyLinks(nextData.serviceSupplyLinks);
    setPaymentFeeSettings(nextData.paymentFeeSettings);
    setAdjustmentAccounts(nextData.adjustmentAccounts);
    setPotDistributionState(nextData.potDistribution);
  }, []);

  const hydrateSupabaseFinancialData = useCallback(
    async (nextUser: User, localData: UserScopedData) => {
      if (!hasSupabaseConfig) {
        setIsSupabaseSyncReady(false);
        return;
      }

      isSupabaseHydratingRef.current = true;
      setIsSupabaseSyncReady(false);

      try {
        const [remoteTransactions, remotePots, remoteClients, remoteCosts] = await Promise.all([
          getSupabaseTransactions(nextUser.id),
          getSupabasePots(nextUser.id),
          getSupabaseClients(nextUser.id),
          getSupabaseCosts(nextUser.id),
        ]);

        const remoteHasData = Boolean(
          (remoteTransactions.data?.length ?? 0) > 0 ||
            (remotePots.data?.length ?? 0) > 0 ||
            (remoteClients.data?.length ?? 0) > 0 ||
            (remoteCosts.data?.length ?? 0) > 0
        );

        if (remoteHasData) {
          const nextData: UserScopedData = {
            ...localData,
            transactions: remoteTransactions.error ? localData.transactions : remoteTransactions.data ?? [],
            pots: remotePots.error ? localData.pots : remotePots.data ?? [],
            clients: remoteClients.error ? localData.clients : remoteClients.data ?? [],
            costs: remoteCosts.error ? localData.costs : remoteCosts.data ?? [],
          };
          applyUserData(normalizeOwnedData(nextUser.id, nextData));
          markMigratedToSupabase(nextUser.id);
          return;
        }

        if (!hasMigratedToSupabase(nextUser.id) && hasLocalFinancialData(localData)) {
          await Promise.all([
            upsertSupabaseTransactions(localData.transactions, nextUser.id),
            upsertSupabasePots(localData.pots, nextUser.id),
            upsertSupabaseClients(localData.clients, nextUser.id),
            upsertSupabaseCosts(localData.costs, nextUser.id),
          ]);
        }

        markMigratedToSupabase(nextUser.id);
      } catch {
        // Supabase is additive in this phase. Local storage remains the source of continuity on any sync failure.
      } finally {
        isSupabaseHydratingRef.current = false;
        setIsSupabaseSyncReady(true);
      }
    },
    [applyUserData]
  );

  const syncFromSupabase = useCallback(async () => {
    if (!hasSupabaseConfig || !user?.id || isSupabaseHydratingRef.current) return;

    isSupabaseHydratingRef.current = true;
    try {
      const [remoteTransactions, remotePots, remoteClients, remoteCosts] = await Promise.all([
        getSupabaseTransactions(user.id),
        getSupabasePots(user.id),
        getSupabaseClients(user.id),
        getSupabaseCosts(user.id),
      ]);

      if (remoteTransactions.error && remotePots.error && remoteClients.error && remoteCosts.error) return;

      setTransactions((prev) =>
        sortTransactionsForDisplay(
          mergeRecordsById(prev, remoteTransactions.error ? [] : remoteTransactions.data ?? [])
        )
      );
      setPots((prev) => mergeRecordsById(prev, remotePots.error ? [] : remotePots.data ?? []));
      setClients((prev) => mergeRecordsById(prev, remoteClients.error ? [] : remoteClients.data ?? []));
      setCosts((prev) => mergeRecordsById(prev, remoteCosts.error ? [] : remoteCosts.data ?? []));
    } finally {
      isSupabaseHydratingRef.current = false;
      setIsSupabaseSyncReady(true);
    }
  }, [user?.id]);

  const setUser = useCallback(
    (nextUser: User | null) => {
      setUserState(nextUser);

      if (!nextUser) {
        setIsSupabaseSyncReady(false);
        lastSupabaseSyncSignatureRef.current = "";
        clearAuthSession();
        applyUserData(createEmptyData());
        return;
      }

      persistAuthSession(nextUser.id);

      if (user?.id === nextUser.id) {
        updateAuthUserProfile(nextUser);
        return;
      }

      const userData = loadUserScopedData(nextUser.id) ?? createEmptyData();
      applyUserData(normalizeOwnedData(nextUser.id, userData));
      void hydrateSupabaseFinancialData(nextUser, userData);
      updateAuthUserProfile(nextUser);
    },
    [applyUserData, hydrateSupabaseFinancialData, user?.id]
  );

  const goScreen = useCallback((screen: ScreenType) => {
    setCurrentScreen(screen);
  }, [applyUserData]);

  useEffect(() => {
    let cancelled = false;

    bootstrapAuthUsers();

    async function restoreSession() {
      const session = await AuthService.getCurrentUser();

      if (cancelled) return;

      if (!session) {
        setCurrentScreen(ScreenType.LANDING);
        setIsAuthChecking(false);
        return;
      }

      setUserState(session.user);
      const userData = loadUserScopedData(session.user.id) ?? createEmptyData();
      applyUserData(normalizeOwnedData(session.user.id, userData));
      void hydrateSupabaseFinancialData(session.user, userData);

      setCurrentScreen(session.onboardingCompleted ? ScreenType.DASHBOARD : ScreenType.ONBOARDING);
      setIsAuthChecking(false);
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applyUserData, hydrateSupabaseFinancialData]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const snapshot: UserScopedData = normalizeOwnedData(user.id, {
      accounts,
      pots,
      services,
      clients,
      transactions,
      paymentAccounts,
      insights,
      notifications,
      achievements,
      salesItems,
      costs,
      supplies,
      products,
      serviceSupplyLinks,
      paymentFeeSettings,
      adjustmentAccounts,
      potDistribution,
    });
    window.localStorage.setItem(`${USER_DATA_KEY_PREFIX}${user.id}`, JSON.stringify(snapshot));
  }, [
    user,
    accounts,
    pots,
    services,
    clients,
    transactions,
    paymentAccounts,
    insights,
    notifications,
    achievements,
    salesItems,
    costs,
    supplies,
    products,
    serviceSupplyLinks,
    paymentFeeSettings,
    adjustmentAccounts,
    potDistribution,
  ]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user?.id || !isSupabaseSyncReady || isSupabaseHydratingRef.current) return;

    const signature = JSON.stringify({
      userId: user.id,
      transactions,
      pots,
      clients,
      costs,
    });

    if (signature === lastSupabaseSyncSignatureRef.current) return;
    lastSupabaseSyncSignatureRef.current = signature;

    void Promise.all([
      upsertSupabaseTransactions(transactions, user.id),
      upsertSupabasePots(pots, user.id),
      upsertSupabaseClients(clients, user.id),
      upsertSupabaseCosts(costs, user.id),
    ]).catch(() => {
      // Local persistence remains the fallback if Supabase is temporarily unavailable.
    });
  }, [clients, costs, isSupabaseSyncReady, pots, transactions, user?.id]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user?.id) return;

    const handleFocus = () => {
      void syncFromSupabase();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFromSupabase();
      }
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncFromSupabase();
      }
    }, 30_000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncFromSupabase, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (transactions.length > 0) {
      unlockAchievement("first_record");
    }
  }, [transactions.length, unlockAchievement, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const reservePot =
      pots.find((pot) => pot.type === PotType.RESERVE) ??
      pots.find((pot) => pot.name.toLowerCase().includes("reserv"));
    if (!reservePot) return;
    if (reservePot.balance > 0) {
      unlockAchievement("reserve_created");
    }
  }, [pots, unlockAchievement, user?.id]);

  useEffect(() => {
    if (!user?.id || !user.createdAt) return;
    const createdAt = new Date(user.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const msSince = Date.now() - createdAt.getTime();
    if (msSince >= 7 * 24 * 60 * 60 * 1000) {
      unlockAchievement("seven_days");
    }
  }, [unlockAchievement, user?.createdAt, user?.id]);

  const logout = useCallback(() => {
    void AuthService.logout();
    setUser(null);
    setCurrentScreen(ScreenType.LANDING);
  }, []);

  const addTransaction = useCallback((transactionInput: TransactionInput) => {
    if (!user?.id) {
      return { ok: false, error: "Usuário não autenticado" };
    }
    const validationError = validateTransactionInput(transactionInput);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const normalizedAmount = clampCurrency(Math.abs(Number(transactionInput.amount)));
    const incomeAmounts =
      transactionInput.type === TransactionType.INCOME
        ? normalizeNewIncomeAmounts(transactionInput, paymentFeeSettings)
        : null;
    const movementAmount = incomeAmounts?.netAmount ?? normalizedAmount;
    const transaction: Transaction = {
      ...transactionInput,
      id: transactionInput.id ?? createId("tx"),
      ownerId: user?.id,
      ...(incomeAmounts ?? { amount: normalizedAmount }),
      createdAt: transactionInput.createdAt ?? new Date().toISOString(),
      description: transactionInput.description.trim(),
      category: transactionInput.category.trim(),
      account: transactionInput.account.trim(),
      origin: transactionInput.origin?.trim() || undefined,
      source: transactionInput.source?.trim() || undefined,
      sourceId: transactionInput.sourceId?.trim() || undefined,
      notes: transactionInput.notes?.trim() || undefined,
      potDistribution:
        transactionInput.type === TransactionType.INCOME
          ? transactionInput.potDistribution ?? potDistribution
          : transactionInput.potDistribution,
    };

    setTransactions((prev) => [transaction, ...prev]);
    if (hasSupabaseConfig) {
      void insertSupabaseTransaction(transaction);
    }

    setAccounts((prev) =>
      prev.map((account) =>
        transaction.type === TransactionType.INCOME && account.name === transaction.account
          ? {
              ...account,
              balance: Number((account.balance + movementAmount).toFixed(2)),
            }
          : account
      )
    );

    setPots((prev) => {
      if (transaction.type === TransactionType.INCOME) {
        const personalPot = prev.find((pot) => pot.type === PotType.PERSONAL);
        const businessPot = prev.find((pot) => pot.type === PotType.BUSINESS);
        const reservePot = prev.find((pot) => pot.type === PotType.RESERVE);

        if (personalPot && businessPot && reservePot) {
          const personalAmount = Number(((movementAmount * potDistribution.personal) / 100).toFixed(2));
          const businessAmount = Number(((movementAmount * potDistribution.business) / 100).toFixed(2));
          const reserveAmount = Number((movementAmount - personalAmount - businessAmount).toFixed(2));

          return prev.map((pot) => {
            if (pot.id === personalPot.id) {
              return { ...pot, balance: Number((pot.balance + personalAmount).toFixed(2)) };
            }
            if (pot.id === businessPot.id) {
              return { ...pot, balance: Number((pot.balance + businessAmount).toFixed(2)) };
            }
            if (pot.id === reservePot.id) {
              return { ...pot, balance: Number((pot.balance + reserveAmount).toFixed(2)) };
            }
            return pot;
          });
        }
      }

      const target = transaction.potId
        ? prev.find((pot) => pot.id === transaction.potId)
        : resolvePotByType(transaction.type, prev);

      if (!target) return prev;

      return prev.map((pot) =>
        pot.id === target.id
          ? {
              ...pot,
              balance: Number(
                (pot.balance + (transaction.type === TransactionType.INCOME ? movementAmount : -movementAmount)).toFixed(2)
              ),
            }
          : pot
      );
    });

    return { ok: true, data: transaction };
  }, [paymentFeeSettings, potDistribution, user?.id]);

  const updateAccountBalance = useCallback((accountId: string, balance: number) => {
    setAccounts((prev) => prev.map((account) => (account.id === accountId ? { ...account, balance } : account)));
  }, []);

  const updatePot = useCallback((potId: string, balance: number) => {
    setPots((prev) => prev.map((pot) => (pot.id === potId ? { ...pot, balance } : pot)));
  }, []);

  const updatePotGoal = useCallback((potId: string, goal: number) => {
    const safeGoal = clampCurrency(goal);
    setPots((prev) =>
      prev.map((pot) => (pot.id === potId ? { ...pot, goalValue: safeGoal, limit: safeGoal } : pot))
    );
  }, []);

  const setPotDistribution = useCallback((distribution: PotDistribution) => {
    setPotDistributionState(normalizePotDistribution(distribution));
  }, []);

  const applyOnboardingUsageMode = useCallback((usageMode: OnboardingUsageMode) => {
    const blueprint = getOnboardingPotBlueprint(usageMode);
    setPotDistributionState(blueprint.distribution);
    setPots((prev) =>
      prev.map((pot) => {
        if (pot.type === PotType.PERSONAL) {
          return {
            ...pot,
            name: blueprint.personal.name,
            icon: blueprint.personal.icon,
            percentage: blueprint.distribution.personal,
          };
        }
        if (pot.type === PotType.BUSINESS) {
          return {
            ...pot,
            name: blueprint.business.name,
            icon: blueprint.business.icon,
            percentage: blueprint.distribution.business,
          };
        }
        if (pot.type === PotType.RESERVE) {
          return {
            ...pot,
            name: blueprint.reserve.name,
            icon: blueprint.reserve.icon,
            percentage: blueprint.distribution.reserve,
          };
        }
        return pot;
      })
    );
  }, []);

  const applyOnboardingIncome = useCallback((usageMode: OnboardingUsageMode, monthlyIncome: number) => {
    void monthlyIncome;
    const blueprint = getOnboardingPotBlueprint(usageMode);
    const distribution = blueprint.distribution;

    setPotDistributionState(distribution);
    setPots((prev) =>
      prev.map((pot) => {
        if (pot.type === PotType.PERSONAL) {
          return {
            ...pot,
            name: blueprint.personal.name,
            icon: blueprint.personal.icon,
            percentage: distribution.personal,
          };
        }
        if (pot.type === PotType.BUSINESS) {
          return {
            ...pot,
            name: blueprint.business.name,
            icon: blueprint.business.icon,
            percentage: distribution.business,
          };
        }
        if (pot.type === PotType.RESERVE) {
          return {
            ...pot,
            name: blueprint.reserve.name,
            icon: blueprint.reserve.icon,
            percentage: distribution.reserve,
          };
        }
        return pot;
      })
    );
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const inferredIncome = calculateAverageMonthlyIncome(transactions.filter((tx) => !isOnboardingSeedTransaction(tx)));
    const referenceIncome = clampCurrency(inferredIncome);

    setPots((prev) => {
      let changed = false;
      const next = prev.map((pot) => {
        const nextPercentage = getPotPercentage(pot.type, potDistribution);
        const nextGoal = resolvePotGoalValue(pot.type, referenceIncome);
        const currentLimit = pot.limit ?? 0;
        if (
          Math.abs((pot.percentage ?? 0) - nextPercentage) < 0.001 &&
          Math.abs((pot.goalValue ?? 0) - nextGoal) < 0.001 &&
          Math.abs(currentLimit - nextGoal) < 0.001
        ) {
          return pot;
        }
        changed = true;
        return {
          ...pot,
          percentage: nextPercentage,
          goalValue: nextGoal,
          limit: nextGoal,
        };
      });
      return changed ? next : prev;
    });
  }, [potDistribution, transactions, user?.id]);

  const applyOnboardingFinancialMode = useCallback((financialMode: OnboardingFinancialMode) => {
    const modeCopy = buildFinancialModeMessage(financialMode);
    setInsights((prev) => {
      const filtered = prev.filter((insight) => insight.id !== "onboarding-primary-goal");
      return [
        {
          id: "onboarding-primary-goal",
          ownerId: user?.id,
          title: "Meta principal",
          description: modeCopy.action,
          value: modeCopy.insight,
          trend: financialMode === "chaos" ? "down" : "up",
          icon: "Meta",
          color: financialMode === "chaos" ? "from-rose-500 to-rose-600" : "from-emerald-500 to-emerald-600",
        },
        ...filtered,
      ];
    });

    setNotifications((prev) => {
      const filtered = prev.filter((notification) => notification.id !== "onboarding-financial-mode");
      const type =
        financialMode === "chaos"
          ? NotificationType.ERROR
          : financialMode === "breakEven"
            ? NotificationType.WARNING
            : NotificationType.INFO;
      return [
        {
          id: "onboarding-financial-mode",
          ownerId: user?.id,
          type,
          title: "Modo financeiro ativado",
          message: modeCopy.notification,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...filtered,
      ];
    });
  }, [user?.id]);

  const addOnboardingDebt = useCallback(
    (debt: OnboardingDebtInput, usageMode: OnboardingUsageMode) => {
      if (!user?.id) return { ok: false, error: "Usuário não autenticado" };

      const totalAmount = clampCurrency(debt.totalAmount);
      const monthlyPayment = clampCurrency(debt.monthlyPayment);
      if (!debt.name.trim()) return { ok: false, error: "Nome da dívida obrigatório" };
      if (totalAmount <= 0 || monthlyPayment <= 0) return { ok: false, error: "Valores inválidos" };

      const installmentsTotal = Math.max(1, Math.ceil(totalAmount / monthlyPayment));
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const dueIso = due.toISOString().slice(0, 10);
      const pot: "pf" | "pj" = usageMode === "business" ? "pj" : "pf";
      const category = usageMode === "business" ? "impostos" : "cartao";

      setAdjustmentAccounts((prev) => [
        {
          id: createId("bill"),
          ownerId: user.id,
          name: debt.name.trim(),
          amount: monthlyPayment,
          category,
          type: "variavel",
          dueDate: dueIso,
          pot,
          installmentsTotal,
          installmentsRemaining: installmentsTotal,
          totalDebt: totalAmount,
          status: "pendente",
          cycleMonthKey: monthKey(due),
        },
        ...prev,
      ]);

      setPaymentAccounts((prev) => [
        {
          id: createId("pay"),
          ownerId: user.id,
          name: debt.name.trim(),
          dueDate: due.getDate(),
          amount: monthlyPayment,
          status: "pendente",
          icon: "Divida",
          color: "from-rose-500 to-rose-600",
        },
        ...prev,
      ]);

      setNotifications((prev) => [
        {
          id: createId("notif"),
          ownerId: user.id,
          type: NotificationType.WARNING,
          title: "Plano de quitação criado",
          message: `Dívida "${debt.name.trim()}" adicionada com pagamento mensal de R$ ${monthlyPayment.toFixed(2)}.`,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ]);

      return { ok: true };
    },
    [user?.id]
  );

  const addOnboardingFixedExpense = useCallback(
    (expense: OnboardingFixedExpenseInput, usageMode: OnboardingUsageMode) => {
      if (!user?.id) return { ok: false, error: "Usuário não autenticado" };
      const amount = clampCurrency(expense.amount);
      const dueDate = expense.dueDate;
      if (!expense.name.trim()) return { ok: false, error: "Nome da despesa obrigatório" };
      if (amount <= 0 || Number.isNaN(new Date(dueDate).getTime())) {
        return { ok: false, error: "Dados inválidos da despesa fixa" };
      }

      const due = new Date(dueDate);
      const pot: "pf" | "pj" = usageMode === "business" ? "pj" : "pf";
      const category = usageMode === "business" ? "fornecedores" : "moradia";

      setAdjustmentAccounts((prev) => [
        {
          id: createId("bill"),
          ownerId: user.id,
          name: expense.name.trim(),
          amount,
          category,
          type: "fixa",
          dueDate,
          pot,
          status: "pendente",
          cycleMonthKey: monthKey(due),
        },
        ...prev,
      ]);

      setPaymentAccounts((prev) => [
        {
          id: createId("pay"),
          ownerId: user.id,
          name: expense.name.trim(),
          dueDate: due.getDate(),
          amount,
          status: "pendente",
          icon: "Conta",
          color: "from-amber-500 to-orange-600",
        },
        ...prev,
      ]);

      return { ok: true };
    },
    [user?.id]
  );

  const addService = useCallback((serviceInput: Omit<Service, "id"> & { id?: string }) => {
    if (!user?.id) {
      return { ok: false, error: "Usuário não autenticado" };
    }
    const validationError = validateServiceInput(serviceInput);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const service: Service = {
      ...serviceInput,
      id: serviceInput.id ?? createId("svc"),
      ownerId: user?.id,
      name: serviceInput.name.trim(),
      description: serviceInput.description.trim(),
      price: Number(serviceInput.price),
      duration: Number(serviceInput.duration),
    };

    setServices((prev) => [service, ...prev]);
    return { ok: true, data: service };
  }, [user?.id]);

  const deleteService = useCallback((serviceId: string) => {
    setServices((prev) => prev.filter((service) => service.id !== serviceId));
  }, []);

  const addCost = useCallback(
    (costInput: Omit<Cost, "id"> & { id?: string }) => {
      const validationError = validateCostInput(costInput);
      if (validationError) {
        return { ok: false, error: validationError };
      }

      const cost: Cost = {
        ...costInput,
        id: costInput.id ?? createId("cost"),
        ownerId: user?.id,
        name: costInput.name.trim(),
        category: costInput.category.trim(),
        amount: Number(costInput.amount),
      };

      setCosts((prev) => [cost, ...prev]);
      if (hasSupabaseConfig) {
        void insertSupabaseCost(cost);
      }
      addTransaction({
        type: TransactionType.EXPENSE,
        description: cost.name,
        amount: cost.amount,
        date: cost.date,
        category: cost.category,
        account: "Conta Corrente",
        origin: "cost",
        source: "cost",
        sourceId: cost.id,
        potId: "pot-002",
      });

      return { ok: true, data: cost };
    },
    [addTransaction, user?.id]
  );

  const deleteCost = useCallback((costId: string) => {
    setCosts((prev) => prev.filter((cost) => cost.id !== costId));
    if (hasSupabaseConfig && user?.id) {
      void deleteSupabaseCost(costId, user.id);
    }
  }, [user?.id]);

  const addAdjustmentAccount = useCallback(
    (accountInput: Omit<AdjustmentAccount, "id" | "status" | "cycleMonthKey">) => {
      if (!accountInput.name.trim()) return { ok: false, error: "Nome da conta é obrigatório" };
      if (!Number.isFinite(accountInput.amount) || accountInput.amount <= 0) {
        return { ok: false, error: "Valor da conta inválido" };
      }
      if (!accountInput.dueDate) return { ok: false, error: "Data de vencimento obrigatória" };

      const totalInstallments =
        accountInput.type === "variavel" ? Math.max(1, accountInput.installmentsTotal ?? 1) : undefined;

      const account: AdjustmentAccount = {
        ...accountInput,
        id: createId("bill"),
        ownerId: user?.id,
        status: "pendente",
        cycleMonthKey: monthKey(new Date(accountInput.dueDate)),
        installmentsTotal: totalInstallments,
        installmentsRemaining:
          accountInput.type === "variavel" ? totalInstallments : undefined,
        totalDebt:
          accountInput.type === "variavel" ? accountInput.amount * (totalInstallments ?? 1) : undefined,
      };

      setAdjustmentAccounts((prev) => [account, ...prev]);
      return { ok: true, data: account };
    },
    [user?.id]
  );

  const updateAdjustmentAccount = useCallback((updated: AdjustmentAccount) => {
    setAdjustmentAccounts((prev) => prev.map((account) => (account.id === updated.id ? updated : account)));
  }, []);

  const deleteAdjustmentAccount = useCallback((accountId: string) => {
    setAdjustmentAccounts((prev) => prev.filter((account) => account.id !== accountId));
  }, []);

  const syncAdjustmentAccountsCycle = useCallback(() => {
    const currentMonth = monthKey();
    setAdjustmentAccounts((prev) =>
      prev.map((account) => {
        if (account.type === "fixa" && account.cycleMonthKey !== currentMonth) {
          return { ...account, status: "pendente", cycleMonthKey: currentMonth };
        }
        return account;
      })
    );
  }, []);

  const payAdjustmentAccount = useCallback(
    (accountId: string) => {
      let borrowed = false;

      const account = adjustmentAccounts.find((item) => item.id === accountId);
      if (!account) return { ok: false, error: "Conta não encontrada" };
      if (account.status === "pago" && account.type !== "fixa") {
        return { ok: false, error: "Conta já está paga" };
      }

      const primaryPot = pots.find((pot) =>
        account.pot === "pf"
          ? pot.type === PotType.PERSONAL || pot.name.toLowerCase().includes("pess")
          : pot.type === PotType.BUSINESS || pot.name.toLowerCase().includes("neg")
      );
      const secondaryPot = pots.find((pot) => pot.id !== primaryPot?.id);
      if (!primaryPot) return { ok: false, error: "Pote principal não encontrado" };

      const amount = account.amount;

      const primaryUse = Math.min(primaryPot.balance, amount);
      const remaining = Number((amount - primaryUse).toFixed(2));

      if (primaryUse > 0) {
        addTransaction({
          type: TransactionType.EXPENSE,
          amount: primaryUse,
          description: `Pagamento conta: ${account.name}`,
          category: account.category,
          date: todayIso(),
          account: "Conta Corrente",
          potId: primaryPot.id,
          origin: "Ajustes/Contas",
          notes: `Conta ${account.id}`,
        });
      }

      if (remaining > 0) {
        if (!secondaryPot) {
          return { ok: false, error: "Saldo insuficiente e sem pote de apoio" };
        }
        borrowed = true;
        addTransaction({
          type: TransactionType.EXPENSE,
          amount: remaining,
          description: `Empréstimo entre potes: ${account.name}`,
          category: account.category,
          date: todayIso(),
          account: "Conta Corrente",
          potId: secondaryPot.id,
          origin: "Ajustes/Contas",
          notes: `Conta ${account.id} com emprestimo`,
        });
      }

      setAdjustmentAccounts((prev) =>
        prev.map((item) => {
          if (item.id !== accountId) return item;

          if (item.type === "fixa") {
            return { ...item, status: "pago" };
          }

          const nextRemaining = Math.max(0, (item.installmentsRemaining ?? 1) - 1);
          const totalInstallments = Math.max(1, item.installmentsTotal ?? 1);
          const nextDebt = Number((item.amount * nextRemaining).toFixed(2));

          return {
            ...item,
            installmentsRemaining: nextRemaining,
            totalDebt: nextDebt,
            status: nextRemaining === 0 ? "pago" : "pendente",
            cycleMonthKey: monthKey(),
            installmentsTotal: totalInstallments,
          };
        })
      );

      return { ok: true, borrowedFromOtherPot: borrowed };
    },
    [adjustmentAccounts, pots, addTransaction]
  );

  const addClient = useCallback((client: Client) => {
    if (!user?.id) return;
    const nextClient = { ...client, ownerId: user.id };
    setClients((prev) => [...prev, nextClient]);
    if (hasSupabaseConfig) {
      void insertSupabaseClient(nextClient);
    }
  }, [user?.id]);

  const updateClient = useCallback((updatedClient: Client) => {
    setClients((prev) => prev.map((client) => (client.id === updatedClient.id ? updatedClient : client)));
  }, []);

  const deleteClient = useCallback((clientId: string) => {
    setClients((prev) => prev.filter((client) => client.id !== clientId));
    if (hasSupabaseConfig && user?.id) {
      void deleteSupabaseClient(clientId, user.id);
    }
  }, [user?.id]);

  const resetUserFinancialData = useCallback(() => {
    if (!user?.id) {
      return { ok: false, error: "Usuário não autenticado" };
    }

    clearUserOnboardingData(user.id);
    applyUserData(createEmptyData());
    return { ok: true };
  }, [applyUserData, user?.id]);

  const value: AppContextType = {
    state: {
      currentScreen,
      user,
      isLoading: isAuthChecking,
      error: null,
      theme: "light",
    },
    goScreen,
    currentScreen,
    user,
    setUser,
    logout,
    accounts,
    pots,
    services,
    clients,
    transactions,
    paymentAccounts,
    insights,
    notifications,
    achievements,
    salesItems,
    costs,
    supplies,
    products,
    serviceSupplyLinks,
    paymentFeeSettings,
    adjustmentAccounts,
    potDistribution,
    addTransaction,
    updateAccountBalance,
    updatePot,
    updatePotGoal,
    addService,
    deleteService,
    addCost,
    deleteCost,
    setSupplies,
    setProducts,
    setServiceSupplyLinks,
    setPaymentFeeSettings,
    setPotDistribution,
    applyOnboardingUsageMode,
    applyOnboardingIncome,
    applyOnboardingFinancialMode,
    addOnboardingDebt,
    addOnboardingFixedExpense,
    addAdjustmentAccount,
    updateAdjustmentAccount,
    deleteAdjustmentAccount,
    syncAdjustmentAccountsCycle,
    payAdjustmentAccount,
    resetUserFinancialData,
    addClient,
    updateClient,
    deleteClient,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
