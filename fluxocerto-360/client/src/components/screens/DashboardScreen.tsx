import { useEffect, useMemo, useState } from "react";
import { Bell, SunMoon } from "lucide-react";
import { useLocation } from "wouter";

import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { buildDashboardIntelligence } from "@/lib/dashboardIntelligence";
import { canAccessAdmin } from "@/lib/authz";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import {
  DASHBOARD_ROUTES,
  SIDEBAR_ITEMS,
  type DashboardRoutePath,
} from "@/components/dashboard/sidebarConfig";
import InicioModule from "@/components/dashboard/modules/InicioModule";
import FinanceiroModule from "@/components/dashboard/modules/FinanceiroModule";
import ConsultorModule from "@/components/dashboard/modules/ConsultorModule";
import ClientesModule from "@/components/dashboard/modules/ClientesModule";
import ItensModule from "@/components/dashboard/modules/ItensModule";
import AjustesModule from "@/components/dashboard/modules/AjustesModule";
import AdministracaoModule from "@/components/dashboard/modules/AdministracaoModule";
import GlobalFloatingAction from "@/components/dashboard/shared/GlobalFloatingAction";

type ThemeMode = "dark" | "light";

function normalizeRoute(path: string): DashboardRoutePath {
  const plainPath = path.split("?")[0] as DashboardRoutePath;
  return DASHBOARD_ROUTES.has(plainPath) ? plainPath : "/dashboard";
}

export default function DashboardScreen() {
  const { user, logout, goScreen, clients, pots, paymentAccounts, transactions } = useApp();

  const [mode, setMode] = useState<ThemeMode>("dark");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const activePath = normalizeRoute(location);
  const isAdmin = canAccessAdmin(user);

  useEffect(() => {
    if (!DASHBOARD_ROUTES.has(activePath)) {
      setLocation("/dashboard");
    }
  }, [activePath, setLocation]);

  useEffect(() => {
    if (activePath === "/administracao" && !isAdmin) {
      setLocation("/dashboard");
    }
  }, [activePath, isAdmin, setLocation]);

  useEffect(() => {
    setIsNotificationOpen(false);
  }, [activePath]);

  const currentSectionLabel = useMemo(
    () => SIDEBAR_ITEMS.find((item) => item.path === activePath)?.label ?? "Dashboard",
    [activePath]
  );
  const isDashboardHome = activePath === "/dashboard";
  const motivationalMessage = "Pequenas decisoes hoje, grandes resultados amanha.";
  const intelligence = useMemo(
    () => buildDashboardIntelligence({ clients, pots, paymentAccounts, transactions }),
    [clients, pots, paymentAccounts, transactions]
  );

  return (
    <div className="fd-shell" data-theme={mode}>
      <DashboardSidebar
        activePath={activePath}
        isAdmin={isAdmin}
        onNavigate={setLocation as (path: DashboardRoutePath) => void}
        onLogout={() => {
          logout();
          goScreen(ScreenType.LOGIN);
        }}
      />

      <main className="fd-main">
        <header className="fd-header fd-glass">
          <div className="fd-header-brand-wrap">
            {!isDashboardHome ? (
              <img
                src="/icon.png"
                alt="FluxoCerto"
                className="fd-header-brand-icon"
                style={{
                  width: "36px",
                  height: "36px",
                  objectFit: "contain",
                }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <h1 className="fd-brand-title compact">{currentSectionLabel}</h1>
            <p className={`fd-brand-caption ${isDashboardHome ? "fd-brand-motto" : ""}`}>
              {isDashboardHome ? motivationalMessage : "Painel de operacao"}
            </p>
          </div>

          <div className="fd-header-right">
            <button
              className="fd-icon-btn"
              onClick={() => setMode((prev) => (prev === "dark" ? "light" : "dark"))}
              aria-label="Alternar tema"
            >
              <SunMoon className="h-4 w-4" />
            </button>

            <button
              className="fd-icon-btn fd-notif-btn"
              aria-label="Notificacoes"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
            >
              <Bell className="h-4 w-4" />
              {intelligence.notifications.length > 0 ? (
                <span className="fd-notif-badge">{intelligence.notifications.length}</span>
              ) : null}
            </button>
          </div>
        </header>

        {isNotificationOpen ? (
          <section className="fd-panel fd-glass fd-notification-panel">
            <div className="fd-panel-head">
              <h2>Notificacoes inteligentes</h2>
              <p>Atualizadas com base nos seus dados</p>
            </div>
            <div className="fd-list">
              {intelligence.notifications.map((notification) => (
                <div key={notification.id} className={`fd-list-row fd-notif-row ${notification.type}`}>
                  <p>{notification.message}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activePath === "/dashboard" && (
          <InicioModule userName={user?.name || "Usuario"} intelligence={intelligence} />
        )}
        {activePath === "/financeiro" && <FinanceiroModule />}
        {activePath === "/consultor" && <ConsultorModule />}
        {activePath === "/clientes" && <ClientesModule />}
        {activePath === "/itens" && <ItensModule />}
        {activePath === "/ajustes" && <AjustesModule />}
        {activePath === "/administracao" && isAdmin && <AdministracaoModule />}
      </main>

      <GlobalFloatingAction />
    </div>
  );
}
