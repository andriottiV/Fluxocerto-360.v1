// ============================================================================
// TIPOS TYPESCRIPT - FluxoCerto 360
// Design: Aplicativo financeiro moderno com UI profissional
// ============================================================================

// Enums
export enum ScreenType {
  LANDING = "scrLanding",
  LOGIN = "scrLogin",
  ONBOARDING = "scrOnboarding",
  DASHBOARD = "scrDashboard",
  CLIENTS = "scrClients",
  PRODUCTS = "scrProducts",
  COSTS = "scrCosts",
  CHAT = "scrChat",
  ADMIN = "scrAdmin",
}

export enum PotType {
  PERSONAL = "pessoal",
  BUSINESS = "negocio",
  RESERVE = "reserva",
}

export type UserRole = "admin" | "tester";
export type UserStatus = "pending" | "active" | "blocked";

export type AccountTypeLink = "pf" | "pj";
export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito" | "voucher" | "alimentacao" | "transferencia";

export enum TransactionType {
  INCOME = "entrada",
  EXPENSE = "saida",
  TRANSFER = "transferencia",
}

export enum NotificationType {
  SUCCESS = "success",
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

// Tipos de Dados
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  avatar?: string;
  businessName?: string;
  businessType?: string;
  cnpj?: string;
  createdAt: string;
  lastLoginAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export type AdminUserStatus = UserStatus;
export type AdminUserPlan = "demo" | "premium" | "free";

export interface AdminManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AdminUserStatus;
  plan: AdminUserPlan;
  createdAt: string;
  lastLogin: string;
  onboardingCompleted: boolean;
}

export interface Account {
  id: string;
  ownerId?: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
}

export interface Pot {
  id: string;
  ownerId?: string;
  type: PotType;
  name: string;
  balance: number;
  percentage: number;
  goalValue: number;
  limit?: number;
  icon: string;
  color: string;
}

export interface Service {
  id: string;
  ownerId?: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  icon: string;
  color: string;
}

export interface Client {
  id: string;
  ownerId?: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  lastService?: string;
  totalSpent: number;
  status: "ativo" | "inativo";
}

export interface Transaction {
  id: string;
  ownerId?: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  category: string;
  account: string;
  origin?: string;
  source?: string;
  sourceId?: string;
  notes?: string;
  pot?: string;
  potId?: string;
  accountTypeLink?: AccountTypeLink;
  paymentMethod?: PaymentMethod;
  grossAmount?: number;
  feePercent?: number;
  feeAmount?: number;
  netAmount?: number;
  clientId?: string;
  clientName?: string;
  serviceName?: string;
  paymentStatus?: "pago" | "pendente" | "cancelado";
  paidAt?: string;
  dueDate?: string;
}

export type TransactionInput = Omit<Transaction, "id"> & { id?: string };

export interface PaymentAccount {
  id: string;
  ownerId?: string;
  name: string;
  dueDate: number;
  amount: number;
  status: "pago" | "pendente" | "atrasado";
  icon: string;
  color: string;
}

export interface Insight {
  id: string;
  ownerId?: string;
  title: string;
  description: string;
  value: string;
  trend: "up" | "down" | "stable";
  icon: string;
  color: string;
}

export interface Notification {
  id: string;
  ownerId?: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Achievement {
  id: string;
  ownerId?: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt?: string;
}

export interface SalesItem {
  id: string;
  ownerId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  date: string;
}

export interface Cost {
  id: string;
  ownerId?: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  status: "pago" | "pendente";
}

export interface SupplyItem {
  id: string;
  ownerId?: string;
  name: string;
  totalValue: number;
  quantity: number;
  unitValue: number;
  date: string;
}

export type ProductType = "pago" | "consignado";

export interface ProductItem {
  id: string;
  ownerId?: string;
  name: string;
  costPrice: number;
  salePrice: number;
  type: ProductType;
  date: string;
  soldCount: number;
}

export interface ServiceSupplyLink {
  id: string;
  ownerId?: string;
  serviceId: string;
  supplyId: string;
  unitsPerService: number;
}

export type PaymentFeeMethod = PaymentMethod;

export interface PaymentFeeSetting {
  method: PaymentFeeMethod;
  ownerId?: string;
  label: string;
  enabled: boolean;
  feePercent: number;
}

export type AdjustmentAccountPot = "pf" | "pj";
export type AdjustmentAccountType = "fixa" | "variavel";
export type AdjustmentAccountStatus = "pendente" | "pago" | "atrasado";
export type AdjustmentAccountCategory =
  | "moradia"
  | "internet"
  | "transporte"
  | "alimentacao"
  | "saude"
  | "lazer"
  | "impostos"
  | "ferramentas"
  | "assinatura/app"
  | "fornecedores"
  | "cartao"
  | "outros";

export interface AdjustmentAccount {
  id: string;
  ownerId?: string;
  name: string;
  amount: number;
  category: AdjustmentAccountCategory;
  type: AdjustmentAccountType;
  dueDate: string;
  pot: AdjustmentAccountPot;
  installmentsTotal?: number;
  installmentsRemaining?: number;
  totalDebt?: number;
  status: AdjustmentAccountStatus;
  cycleMonthKey: string;
}

export interface PotDistribution {
  personal: number;
  business: number;
  reserve: number;
}

export type OnboardingUsageMode = "personal" | "business" | "both";
export type OnboardingFinancialMode = "chaos" | "breakEven" | "surplus" | "growth";

export interface OnboardingDebtInput {
  name: string;
  totalAmount: number;
  monthlyPayment: number;
}

export interface OnboardingFixedExpenseInput {
  name: string;
  amount: number;
  dueDate: string;
}

// Contexto Global
export interface AppContextType {
  // Estado
  state: AppState;

  // Navegação
  goScreen: (screen: ScreenType) => void;
  currentScreen: ScreenType;

  // Usuário
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;

  // Dados
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

  // Ações
  addTransaction: (transaction: TransactionInput) => { ok: boolean; error?: string; data?: Transaction };
  updateAccountBalance: (accountId: string, balance: number) => void;
  updatePot: (potId: string, balance: number) => void;
  updatePotGoal: (potId: string, goal: number) => void;
  addService: (service: Omit<Service, "id"> & { id?: string }) => { ok: boolean; error?: string; data?: Service };
  deleteService: (serviceId: string) => void;
  addCost: (cost: Omit<Cost, "id"> & { id?: string }) => { ok: boolean; error?: string; data?: Cost };
  deleteCost: (costId: string) => void;
  setSupplies: React.Dispatch<React.SetStateAction<SupplyItem[]>>;
  setProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  setServiceSupplyLinks: React.Dispatch<React.SetStateAction<ServiceSupplyLink[]>>;
  setPaymentFeeSettings: (settings: PaymentFeeSetting[]) => void;
  setPotDistribution: (distribution: PotDistribution) => void;
  applyOnboardingUsageMode: (usageMode: OnboardingUsageMode) => void;
  applyOnboardingIncome: (usageMode: OnboardingUsageMode, monthlyIncome: number) => void;
  applyOnboardingFinancialMode: (financialMode: OnboardingFinancialMode) => void;
  addOnboardingDebt: (debt: OnboardingDebtInput, usageMode: OnboardingUsageMode) => { ok: boolean; error?: string };
  addOnboardingFixedExpense: (
    expense: OnboardingFixedExpenseInput,
    usageMode: OnboardingUsageMode
  ) => { ok: boolean; error?: string };
  addAdjustmentAccount: (
    account: Omit<AdjustmentAccount, "id" | "status" | "cycleMonthKey">
  ) => { ok: boolean; error?: string; data?: AdjustmentAccount };
  updateAdjustmentAccount: (account: AdjustmentAccount) => void;
  deleteAdjustmentAccount: (accountId: string) => void;
  syncAdjustmentAccountsCycle: () => void;
  payAdjustmentAccount: (accountId: string) => { ok: boolean; error?: string; borrowedFromOtherPot?: boolean };
  resetUserFinancialData: () => { ok: boolean; error?: string };
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (clientId: string) => void;
}

export interface AppState {
  currentScreen: ScreenType;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  theme: "light" | "dark";
}

// Tipos de Componentes
export interface ScreenProps {
  onNavigate?: (screen: ScreenType) => void;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outline";
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export interface ToastProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

// Tipos de Tema
export interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

// Tipos de Validação
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Tipos de API (para futuras integrações)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
