// ============================================================================
// CONSTANTES - FluxoCerto 360
// Design: Dados estáticos para o aplicativo
// ============================================================================

import {
  AdminManagedUser,
  User,
  Account,
  Pot,
  Service,
  Client,
  PaymentAccount,
  Insight,
  Notification,
  Achievement,
  SalesItem,
  Cost,
  NotificationType,
  PotType,
} from "./types";

// Usuário Padrão
export const DEFAULT_USER: User = {
  id: "user-001",
  name: "Joao Silva",
  email: "joao@fluxocerto.com",
  role: "admin",
  status: "active",
  phone: "(11) 99999-9999",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=joao",
  businessName: "Barbearia Silva",
  businessType: "Servicos",
  cnpj: "12.345.678/0001-90",
  createdAt: "2024-01-15",
  lastLoginAt: "2026-04-17T09:00:00.000Z",
  approvedAt: "2024-01-15T09:00:00.000Z",
  approvedBy: "system",
};

export const ACCOUNTS: Account[] = [
  {
    id: "acc-001",
    name: "Conta Corrente",
    type: "Banco",
    balance: 0,
    currency: "BRL",
    icon: "Banco",
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "acc-002",
    name: "Conta Reserva",
    type: "Banco",
    balance: 0,
    currency: "BRL",
    icon: "Reserva",
    color: "from-emerald-500 to-emerald-600",
  },
];

export const POTS: Pot[] = [
  {
    id: "pot-001",
    type: PotType.PERSONAL,
    name: "Pessoal",
    balance: 0,
    percentage: 50,
    goalValue: 0,
    limit: 0,
    icon: "Pessoal",
    color: "from-orange-500 to-orange-600",
  },
  {
    id: "pot-002",
    type: PotType.BUSINESS,
    name: "Negocio",
    balance: 0,
    percentage: 40,
    goalValue: 0,
    limit: 0,
    icon: "Negocio",
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "pot-003",
    type: PotType.RESERVE,
    name: "Reserva",
    balance: 0,
    percentage: 10,
    goalValue: 0,
    limit: 0,
    icon: "Reserva",
    color: "from-red-500 to-red-600",
  },
];

export const SERVICES: Service[] = [];
export const CLIENTS: Client[] = [];
export const PAYMENT_ACCOUNTS: PaymentAccount[] = [];
export const INSIGHTS: Insight[] = [];
export const NOTIFICATIONS: Notification[] = [];
export const ACHIEVEMENTS: Achievement[] = [];
export const SALES_ITEMS: SalesItem[] = [];
export const COSTS: Cost[] = [];

export const DAILY_GOAL = {
  title: "Meta do Dia",
  target: 0,
  current: 0,
  currency: "BRL",
  icon: "Meta",
};

// Onboarding Steps
export const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Bem-vindo ao FluxoCerto 360",
    description: "Gerencie suas finanças com facilidade e precisão",
    icon: "👋",
  },
  {
    id: 2,
    title: "Configure suas Contas",
    description: "Adicione suas contas bancárias e carteiras digitais",
    icon: "🏦",
  },
  {
    id: 3,
    title: "Comece a Registrar",
    description: "Registre suas receitas, despesas e clientes",
    icon: "📝",
  },
];

// Admin Users
export const ADMIN_USERS = [
  {
    id: "admin-001",
    name: "João Silva",
    email: "joao@fluxocerto.com",
    role: "Proprietário",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=joao",
  },
  {
    id: "admin-002",
    name: "Maria Santos",
    email: "maria@fluxocerto.com",
    role: "Gerente",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=maria",
  },
  {
    id: "admin-003",
    name: "Pedro Costa",
    email: "pedro@fluxocerto.com",
    role: "Funcionário",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=pedro",
  },
  {
    id: "admin-004",
    name: "Ana Oliveira",
    email: "ana@fluxocerto.com",
    role: "Funcionário",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ana",
  },
];

export const ADMIN_MOCK_USERS: AdminManagedUser[] = [
  {
    id: "adm-user-001",
    name: "Joao Silva",
    email: "joao@fluxocerto.com",
    role: "admin",
    status: "active",
    plan: "premium",
    createdAt: "2024-01-15T09:00:00",
    lastLogin: "2026-04-15T18:10:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-002",
    name: "Marina Rocha",
    email: "marina@fluxocerto.com",
    role: "tester",
    status: "active",
    plan: "premium",
    createdAt: "2025-02-11T10:45:00",
    lastLogin: "2026-04-14T22:05:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-003",
    name: "Lucas Mendes",
    email: "lucas@fluxocerto.com",
    role: "tester",
    status: "blocked",
    plan: "free",
    createdAt: "2025-06-08T13:20:00",
    lastLogin: "2026-03-30T09:15:00",
    onboardingCompleted: false,
  },
  {
    id: "adm-user-004",
    name: "Bianca Alves",
    email: "bianca@fluxocerto.com",
    role: "tester",
    status: "active",
    plan: "demo",
    createdAt: "2026-01-21T16:40:00",
    lastLogin: "2026-04-16T08:50:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-005",
    name: "Rafael Costa",
    email: "rafael@fluxocerto.com",
    role: "admin",
    status: "active",
    plan: "premium",
    createdAt: "2024-11-05T11:30:00",
    lastLogin: "2026-04-13T19:05:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-006",
    name: "Paula Nunes",
    email: "paula@fluxocerto.com",
    role: "tester",
    status: "blocked",
    plan: "demo",
    createdAt: "2025-10-19T14:10:00",
    lastLogin: "2026-02-27T21:00:00",
    onboardingCompleted: false,
  },
  {
    id: "adm-user-007",
    name: "Camila Duarte",
    email: "camila@fluxocerto.com",
    role: "tester",
    status: "active",
    plan: "free",
    createdAt: "2026-04-11T09:40:00",
    lastLogin: "2026-04-16T09:18:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-008",
    name: "Thiago Reis",
    email: "thiago@fluxocerto.com",
    role: "tester",
    status: "active",
    plan: "demo",
    createdAt: "2026-04-13T11:10:00",
    lastLogin: "2026-04-15T17:02:00",
    onboardingCompleted: false,
  },
  {
    id: "adm-user-009",
    name: "Fernanda Prado",
    email: "fernanda@fluxocerto.com",
    role: "admin",
    status: "active",
    plan: "premium",
    createdAt: "2025-08-02T12:35:00",
    lastLogin: "2026-04-16T08:26:00",
    onboardingCompleted: true,
  },
  {
    id: "adm-user-010",
    name: "Mateus Lima",
    email: "mateus@fluxocerto.com",
    role: "tester",
    status: "blocked",
    plan: "free",
    createdAt: "2026-03-19T15:45:00",
    lastLogin: "2026-03-30T10:12:00",
    onboardingCompleted: false,
  },
];


