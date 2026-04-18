import {
  LayoutDashboard,
  Lightbulb,
  WalletCards,
  Users,
  Boxes,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type DashboardRoutePath =
  | "/dashboard"
  | "/financeiro"
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
  { id: "inicio", label: "Inicio", path: "/dashboard", icon: LayoutDashboard },
  { id: "financeiro", label: "Fluxo de Caixa", path: "/financeiro", icon: WalletCards },
  { id: "consultor", label: "Consultor", path: "/consultor", icon: Lightbulb },
  { id: "clientes", label: "Clientes", path: "/clientes", icon: Users },
  { id: "itens", label: "Itens / Custos", path: "/itens", icon: Boxes },
  { id: "ajustes", label: "Ajustes", path: "/ajustes", icon: Settings },
  { id: "administracao", label: "Administracao", path: "/administracao", icon: ShieldCheck, adminOnly: true },
];

export const DASHBOARD_ROUTES = new Set<DashboardRoutePath>(
  SIDEBAR_ITEMS.map((item) => item.path)
);
