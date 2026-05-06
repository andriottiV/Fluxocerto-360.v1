import {
  LayoutDashboard,
  Lightbulb,
  WalletCards,
  Users,
  Boxes,
  Settings,
  ShieldCheck,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export type DashboardRoutePath =
  | "/dashboard"
  | "/financeiro"
  | "/recorrencias"
  | "/consultor"
  | "/clientes"
  | "/itens"
  | "/ajustes"
  | "/administracao";

export type SidebarRouteItem = {
  id: string;
  label: string;
  path: DashboardRoutePath;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const SIDEBAR_ITEMS: SidebarRouteItem[] = [
  { id: "inicio", label: "Início", path: "/dashboard", icon: LayoutDashboard },
  { id: "financeiro", label: "Fluxo de Caixa", path: "/financeiro", icon: WalletCards },
  { id: "recorrencias", label: "Recorrencias", path: "/recorrencias", icon: CalendarClock },
  { id: "consultor", label: "Consultor", path: "/consultor", icon: Lightbulb },
  { id: "clientes", label: "Clientes", path: "/clientes", icon: Users },
  { id: "itens", label: "Itens / Custos", path: "/itens", icon: Boxes },
  { id: "ajustes", label: "Ajustes", path: "/ajustes", icon: Settings },
  { id: "administracao", label: "Administração", path: "/administracao", icon: ShieldCheck, adminOnly: true },
];

export const DASHBOARD_ROUTES = new Set<DashboardRoutePath>(
  SIDEBAR_ITEMS.map((item) => item.path)
);
