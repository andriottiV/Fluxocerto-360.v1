import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  SalesItem,
  ScreenType,
  Service,
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
  bootstrapAuthUsers,
  clearUserOnboardingData,
  clearAuthSession,
  getUserOnboardingData,
  persistAuthSession,
  restoreAuthSession,
  updateAuthUserProfile,
} from "@/lib/auth";

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_DATA_KEY_PREFIX = "fc360:data:";

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

function normalizeOwnedData(userId: string, data: UserScopedData): UserScopedData {
  const distribution = normalizePotDistribution(data.potDistribution);
  return {
    accounts: attachOwner(data.accounts, userId),
    pots: attachOwner(data.pots, userId).map((pot) => ({
      ...pot,
      percentage: Number.isFinite(pot.percentage) ? pot.percentage : getPotPercentage(pot.type, distribution),
      goalValue: Number.isFinite(pot.goalValue) ? pot.goalValue : clampCurrency(pot.limit ?? 0),
      limit: clampCurrency(pot.limit ?? pot.goalValue ?? 0),
    })),
    services: attachOwner(data.services, userId),
    clients: attachOwner(data.clients, userId),
    transactions: attachOwner(data.transactions, userId),
    paymentAccounts: attachOwner(data.paymentAccounts, userId),
    insights: attachOwner(data.insights, userId),
    notifications: attachOwner(data.notifications, userId),
    achievements: attachOwner(data.achievements, userId),
    salesItems: attachOwner(data.salesItems, userId),
    costs: attachOwner(data.costs, userId),
    paymentFeeSettings: attachOwner(data.paymentFeeSettings, userId),
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
      paymentFeeSettings: parsed.paymentFeeSettings ?? fallback.paymentFeeSettings,
      adjustmentAccounts: parsed.adjustmentAccounts ?? fallback.adjustmentAccounts,
      potDistribution: normalizePotDistribution(parsed.potDistribution),
    };
  } catch {
    return null;
  }
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
    return "Tipo de transacao invalido";
  }
  if (!transaction.description?.trim()) return "Descricao obrigatoria";
  if (!transaction.category?.trim()) return "Categoria obrigatoria";

  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Valor deve ser maior que zero";

  if (!transaction.date || Number.isNaN(new Date(transaction.date).getTime())) return "Data invalida";
  if (!transaction.account?.trim()) return "Conta obrigatoria";
  return null;
}

function validateServiceInput(service: Omit<Service, "id"> & { id?: string }) {
  if (!service.name?.trim()) return "Nome do servico e obrigatorio";
  if (!service.description?.trim()) return "Descricao do servico e obrigatoria";
  if (!Number.isFinite(service.price) || service.price <= 0) return "Valor do servico invalido";
  if (!Number.isFinite(service.duration) || service.duration <= 0) return "Duracao do servico invalida";
  return null;
}

function validateCostInput(cost: Omit<Cost, "id"> & { id?: string }) {
  if (!cost.name?.trim()) return "Nome do custo e obrigatorio";
  if (!cost.category?.trim()) return "Categoria obrigatoria";
  if (!Number.isFinite(cost.amount) || cost.amount <= 0) return "Valor do custo invalido";
  if (!cost.date || Number.isNaN(new Date(cost.date).getTime())) return "Data invalida";
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
  const [paymentFeeSettings, setPaymentFeeSettings] = useState<PaymentFeeSetting[]>(baseData.paymentFeeSettings);
  const [adjustmentAccounts, setAdjustmentAccounts] = useState<AdjustmentAccount[]>(baseData.adjustmentAccounts);
  const [potDistribution, setPotDistributionState] = useState<PotDistribution>(baseData.potDistribution);
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
    setPaymentFeeSettings(nextData.paymentFeeSettings);
    setAdjustmentAccounts(nextData.adjustmentAccounts);
    setPotDistributionState(nextData.potDistribution);
  }, []);

  const setUser = useCallback(
    (nextUser: User | null) => {
      setUserState(nextUser);

      if (!nextUser) {
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
      updateAuthUserProfile(nextUser);
    },
    [applyUserData, user?.id]
  );

  const goScreen = useCallback((screen: ScreenType) => {
    setCurrentScreen(screen);
  }, [applyUserData]);

  useEffect(() => {
    bootstrapAuthUsers();
    const session = restoreAuthSession();

    if (!session) {
      setCurrentScreen(ScreenType.LANDING);
      setIsAuthChecking(false);
      return;
    }

    setUserState(session.user);
    const userData = loadUserScopedData(session.user.id) ?? createEmptyData();
    applyUserData(normalizeOwnedData(session.user.id, userData));

    setCurrentScreen(session.onboardingCompleted ? ScreenType.DASHBOARD : ScreenType.ONBOARDING);
    setIsAuthChecking(false);
  }, []);

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
    paymentFeeSettings,
    adjustmentAccounts,
    potDistribution,
  ]);

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
    setUser(null);
    setCurrentScreen(ScreenType.LANDING);
  }, []);

  const addTransaction = useCallback((transactionInput: TransactionInput) => {
    if (!user?.id) {
      return { ok: false, error: "Usuario nao autenticado" };
    }
    const validationError = validateTransactionInput(transactionInput);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const normalizedAmount = Math.abs(Number(transactionInput.amount));
    const transaction: Transaction = {
      ...transactionInput,
      id: transactionInput.id ?? createId("tx"),
      ownerId: user?.id,
      amount: normalizedAmount,
      description: transactionInput.description.trim(),
      category: transactionInput.category.trim(),
      account: transactionInput.account.trim(),
      origin: transactionInput.origin?.trim() || undefined,
      notes: transactionInput.notes?.trim() || undefined,
    };

    const signal = transaction.type === TransactionType.INCOME ? 1 : -1;

    setTransactions((prev) => [transaction, ...prev]);

    setAccounts((prev) =>
      prev.map((account) =>
        account.name === transaction.account
          ? {
              ...account,
              balance: Number((account.balance + normalizedAmount * signal).toFixed(2)),
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
          const personalAmount = Number(((normalizedAmount * potDistribution.personal) / 100).toFixed(2));
          const businessAmount = Number(((normalizedAmount * potDistribution.business) / 100).toFixed(2));
          const reserveAmount = Number((normalizedAmount - personalAmount - businessAmount).toFixed(2));

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
              balance: Number((pot.balance + normalizedAmount * signal).toFixed(2)),
            }
          : pot
      );
    });

    return { ok: true, data: transaction };
  }, [potDistribution, user?.id]);

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
    if (!user?.id) return;
    const safeIncome = clampCurrency(monthlyIncome);
    const blueprint = getOnboardingPotBlueprint(usageMode);
    const distribution = blueprint.distribution;
    const personalBalance = clampCurrency((safeIncome * distribution.personal) / 100);
    const businessBalance = clampCurrency((safeIncome * distribution.business) / 100);
    const reserveBalance = clampCurrency(safeIncome - personalBalance - businessBalance);

    setPotDistributionState(distribution);
    setPots((prev) =>
      prev.map((pot) => {
        if (pot.type === PotType.PERSONAL) {
          return {
            ...pot,
            name: blueprint.personal.name,
            icon: blueprint.personal.icon,
            balance: personalBalance,
            percentage: distribution.personal,
            goalValue: safeIncome,
            limit: safeIncome,
          };
        }
        if (pot.type === PotType.BUSINESS) {
          return {
            ...pot,
            name: blueprint.business.name,
            icon: blueprint.business.icon,
            balance: businessBalance,
            percentage: distribution.business,
            goalValue: clampCurrency(safeIncome * 2),
            limit: clampCurrency(safeIncome * 2),
          };
        }
        if (pot.type === PotType.RESERVE) {
          return {
            ...pot,
            name: blueprint.reserve.name,
            icon: blueprint.reserve.icon,
            balance: reserveBalance,
            percentage: distribution.reserve,
            goalValue: clampCurrency(safeIncome * 3),
            limit: clampCurrency(safeIncome * 3),
          };
        }
        return pot;
      })
    );

    setAccounts((prev) =>
      prev.map((account, index) => {
        if (index === 0) return { ...account, balance: safeIncome };
        if (index === 1) return { ...account, balance: reserveBalance };
        return account;
      })
    );

    const seedTransaction: Transaction = {
      id: createId("tx"),
      ownerId: user.id,
      type: TransactionType.INCOME,
      description: "Saldo inicial configurado no onboarding",
      amount: safeIncome,
      date: todayIso(),
      category: "onboarding",
      account: "Conta Corrente",
      origin: "Onboarding",
      notes: "onboarding-seed-income",
      potId: "pot-001",
    };
    setTransactions((prev) => {
      const next = prev.filter((tx) => tx.notes !== "onboarding-seed-income");
      return [seedTransaction, ...next];
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const onboardingIncome = getUserOnboardingData(user.id).monthlyIncome;
    const inferredIncome = calculateAverageMonthlyIncome(transactions);
    const referenceIncome = clampCurrency(
      typeof onboardingIncome === "number" && Number.isFinite(onboardingIncome) && onboardingIncome > 0
        ? onboardingIncome
        : inferredIncome
    );

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
      if (!user?.id) return { ok: false, error: "Usuario nao autenticado" };

      const totalAmount = clampCurrency(debt.totalAmount);
      const monthlyPayment = clampCurrency(debt.monthlyPayment);
      if (!debt.name.trim()) return { ok: false, error: "Nome da divida obrigatorio" };
      if (totalAmount <= 0 || monthlyPayment <= 0) return { ok: false, error: "Valores invalidos" };

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
      if (!user?.id) return { ok: false, error: "Usuario nao autenticado" };
      const amount = clampCurrency(expense.amount);
      const dueDate = expense.dueDate;
      if (!expense.name.trim()) return { ok: false, error: "Nome da despesa obrigatorio" };
      if (amount <= 0 || Number.isNaN(new Date(dueDate).getTime())) {
        return { ok: false, error: "Dados invalidos da despesa fixa" };
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
      return { ok: false, error: "Usuario nao autenticado" };
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
      addTransaction({
        type: TransactionType.EXPENSE,
        description: cost.name,
        amount: cost.amount,
        date: cost.date,
        category: cost.category,
        account: "Conta Corrente",
        origin: "Ajustes",
        potId: "pot-002",
      });

      return { ok: true, data: cost };
    },
    [addTransaction, user?.id]
  );

  const deleteCost = useCallback((costId: string) => {
    setCosts((prev) => prev.filter((cost) => cost.id !== costId));
  }, []);

  const addAdjustmentAccount = useCallback(
    (accountInput: Omit<AdjustmentAccount, "id" | "status" | "cycleMonthKey">) => {
      if (!accountInput.name.trim()) return { ok: false, error: "Nome da conta e obrigatorio" };
      if (!Number.isFinite(accountInput.amount) || accountInput.amount <= 0) {
        return { ok: false, error: "Valor da conta invalido" };
      }
      if (!accountInput.dueDate) return { ok: false, error: "Data de vencimento obrigatoria" };

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
      if (!account) return { ok: false, error: "Conta nao encontrada" };
      if (account.status === "pago" && account.type !== "fixa") {
        return { ok: false, error: "Conta ja esta paga" };
      }

      const primaryPot = pots.find((pot) =>
        account.pot === "pf"
          ? pot.type === PotType.PERSONAL || pot.name.toLowerCase().includes("pess")
          : pot.type === PotType.BUSINESS || pot.name.toLowerCase().includes("neg")
      );
      const secondaryPot = pots.find((pot) => pot.id !== primaryPot?.id);
      if (!primaryPot) return { ok: false, error: "Pote principal nao encontrado" };

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
          description: `Emprestimo entre potes: ${account.name}`,
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
    setClients((prev) => [...prev, { ...client, ownerId: user?.id }]);
  }, [user?.id]);

  const updateClient = useCallback((updatedClient: Client) => {
    setClients((prev) => prev.map((client) => (client.id === updatedClient.id ? updatedClient : client)));
  }, []);

  const deleteClient = useCallback((clientId: string) => {
    setClients((prev) => prev.filter((client) => client.id !== clientId));
  }, []);

  const resetUserFinancialData = useCallback(() => {
    if (!user?.id) {
      return { ok: false, error: "Usuario nao autenticado" };
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
