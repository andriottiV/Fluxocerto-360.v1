import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Account,
  Achievement,
  AdjustmentAccount,
  AppContextType,
  Client,
  Cost,
  Insight,
  Notification,
  PaymentAccount,
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
import { bootstrapAuthUsers, updateAuthUserProfile } from "@/lib/auth";

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

function buildDefaultPaymentFees(): PaymentFeeSetting[] {
  return [
    { method: "credito", label: "Credito", enabled: true, feePercent: 3.49 },
    { method: "debito", label: "Debito", enabled: true, feePercent: 1.89 },
    { method: "voucher", label: "Voucher", enabled: false, feePercent: 4.9 },
    { method: "alimentacao", label: "Alimentacao", enabled: false, feePercent: 4.5 },
    { method: "pix", label: "PIX", enabled: true, feePercent: 0.99 },
  ];
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyData(): UserScopedData {
  return {
    accounts: cloneData(ACCOUNTS).map((account) => ({
      ...account,
      balance: 0,
    })),
    pots: cloneData(POTS).map((pot) => ({
      ...pot,
      balance: 0,
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
  };
}

function attachOwner<T extends { ownerId?: string }>(items: T[], ownerId: string) {
  return items
    .filter((item) => !item.ownerId || item.ownerId === ownerId)
    .map((item) => ({ ...item, ownerId }));
}

function normalizeOwnedData(userId: string, data: UserScopedData): UserScopedData {
  return {
    accounts: attachOwner(data.accounts, userId),
    pots: attachOwner(data.pots, userId),
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
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.LOGIN);
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
  }, []);

  const setUser = useCallback(
    (nextUser: User | null) => {
      setUserState(nextUser);

      if (!nextUser) {
        applyUserData(createEmptyData());
        return;
      }

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
  }, []);

  useEffect(() => {
    bootstrapAuthUsers();
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
  ]);

  const logout = useCallback(() => {
    setUser(null);
    setCurrentScreen(ScreenType.LOGIN);
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
  }, [user?.id]);

  const updateAccountBalance = useCallback((accountId: string, balance: number) => {
    setAccounts((prev) => prev.map((account) => (account.id === accountId ? { ...account, balance } : account)));
  }, []);

  const updatePot = useCallback((potId: string, balance: number) => {
    setPots((prev) => prev.map((pot) => (pot.id === potId ? { ...pot, balance } : pot)));
  }, []);

  const updatePotGoal = useCallback((potId: string, goal: number) => {
    setPots((prev) => prev.map((pot) => (pot.id === potId ? { ...pot, limit: goal } : pot)));
  }, []);

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

  const value: AppContextType = {
    state: {
      currentScreen,
      user,
      isLoading: false,
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
    addTransaction,
    updateAccountBalance,
    updatePot,
    updatePotGoal,
    addService,
    deleteService,
    addCost,
    deleteCost,
    setPaymentFeeSettings,
    addAdjustmentAccount,
    updateAdjustmentAccount,
    deleteAdjustmentAccount,
    syncAdjustmentAccountsCycle,
    payAdjustmentAccount,
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
