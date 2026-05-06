import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, LogOut, SunMoon, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { buildDashboardIntelligence } from "@/lib/dashboardIntelligence";
import { canAccessAdmin } from "@/lib/authz";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import AppHeader from "@/components/ui/AppHeader";
import {
  DASHBOARD_ROUTES,
  type DashboardRoutePath,
} from "@/components/dashboard/sidebarConfig";
import InicioModule from "@/components/dashboard/modules/InicioModule";
import FinanceiroModule from "@/components/dashboard/modules/FinanceiroModule";
import GlobalFloatingAction from "@/components/dashboard/shared/GlobalFloatingAction";

type ThemeMode = "dark" | "light";

const ConsultorModule = lazy(() => import("@/components/dashboard/modules/ConsultorModule"));
const ClientesModule = lazy(() => import("@/components/dashboard/modules/ClientesModule"));
const ItensModule = lazy(() => import("@/components/dashboard/modules/ItensModule"));
const AjustesModule = lazy(() => import("@/components/dashboard/modules/AjustesModule"));
const AdministracaoModule = lazy(() => import("@/components/dashboard/modules/AdministracaoModule"));
const RecorrenciasModule = lazy(() => import("@/components/dashboard/modules/RecorrenciasModule"));

function normalizeRoute(path: string): DashboardRoutePath {
  const plainPath = path.split("?")[0] as DashboardRoutePath;
  return DASHBOARD_ROUTES.has(plainPath) ? plainPath : "/dashboard";
}

const ROUTE_META: Record<DashboardRoutePath, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Início",
    subtitle: "Aqui está a saúde do seu dinheiro hoje.",
  },
  "/financeiro": {
    title: "Fluxo de Caixa",
    subtitle: "Veja o dinheiro real que entrou, saiu e ficou livre.",
  },
  "/recorrencias": {
    title: "Recorrencias",
    subtitle: "Cadastre entradas e saidas que se repetem para nao esquecer nada.",
  },
  "/consultor": {
    title: "Consultor Flux",
    subtitle: "Pergunte e receba respostas com base nos seus dados reais.",
  },
  "/clientes": {
    title: "Clientes & Vendas",
    subtitle: "Veja quem pode virar dinheiro e o que fazer hoje.",
  },
  "/itens": {
    title: "Itens / Custos",
    subtitle: "Enxergue onde seu lucro pode escapar sem você perceber.",
  },
  "/ajustes": {
    title: "Ajustes",
    subtitle: "Deixe o FluxoCerto do seu jeito, sem complicar.",
  },
  "/administracao": {
    title: "Administração",
    subtitle: "Gerencie acessos e acompanhe usuários autorizados.",
  },
};

function getNotificationReadStorageKey(userId?: string) {
  return userId ? `fc360:dashboard-notifications-read:${userId}` : null;
}

function readStoredNotificationIds(userId?: string): Record<string, boolean> {
  const storageKey = getNotificationReadStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writeStoredNotificationIds(userId: string | undefined, readIds: Record<string, boolean>) {
  const storageKey = getNotificationReadStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return;

  window.localStorage.setItem(storageKey, JSON.stringify(readIds));
}

function DashboardModuleLoading() {
  return (
    <section className="fd-panel fd-glass">
      <div className="fd-panel-head">
        <h2>Carregando módulo</h2>
        <p>Preparando a tela com seus dados.</p>
      </div>
    </section>
  );
}

export default function DashboardScreen() {
  const { user, logout, goScreen, clients, pots, paymentAccounts, transactions } = useApp();

  const [mode, setMode] = useState<ThemeMode>("dark");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Record<string, boolean>>(() =>
    readStoredNotificationIds(user?.id)
  );
  const notificationRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector(".fd-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activePath]);

  useEffect(() => {
    setReadNotificationIds(readStoredNotificationIds(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!isNotificationOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isNotificationOpen]);

  const currentSection = ROUTE_META[activePath];
  const intelligence = useMemo(
    () => buildDashboardIntelligence({ clients, pots, paymentAccounts, transactions }),
    [clients, pots, paymentAccounts, transactions]
  );
  const unreadNotifications = intelligence.notifications.filter((item) => !readNotificationIds[item.id]);

  const markNotificationAsRead = (notificationId: string) => {
    setReadNotificationIds((prev) => {
      const next = { ...prev, [notificationId]: true };
      writeStoredNotificationIds(user?.id, next);
      return next;
    });
  };

  const clearAllNotifications = () => {
    setReadNotificationIds((prev) => {
      const next = {
        ...prev,
        ...Object.fromEntries(intelligence.notifications.map((item) => [item.id, true])),
      };
      writeStoredNotificationIds(user?.id, next);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    goScreen(ScreenType.LANDING);
  };

  return (
    <div className="fd-shell" data-theme={mode}>
      <DashboardSidebar
        activePath={activePath}
        isAdmin={isAdmin}
        onNavigate={setLocation as (path: DashboardRoutePath) => void}
        onLogout={handleLogout}
      />

      <main className="fd-main">
        <AppHeader
          title={currentSection.title}
          subtitle={currentSection.subtitle}
          rightActions={
            <>
            <button
              className="fd-icon-btn"
              onClick={() => setMode((prev) => (prev === "dark" ? "light" : "dark"))}
              aria-label="Alternar tema"
            >
              <SunMoon className="h-4 w-4" />
            </button>

            <button
              className="fd-icon-btn fd-notif-btn"
              aria-label="Notificações"
              aria-expanded={isNotificationOpen}
              onClick={(event) => {
                event.stopPropagation();
                setIsNotificationOpen((prev) => !prev);
              }}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications.length > 0 ? (
                <span className="fd-notif-badge">{unreadNotifications.length}</span>
              ) : null}
            </button>

            <button
              type="button"
              className="fd-logout-top-btn"
              onClick={handleLogout}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
            </>
          }
        />

        {isNotificationOpen ? (
          <section ref={notificationRef} className="fd-panel fd-glass fd-notification-panel">
            <div className="fd-panel-head">
              <h2>Notificações inteligentes</h2>
              <p>Atualizadas com base nos seus dados reais.</p>
            </div>
            {intelligence.notifications.length > 0 ? (
              <>
                <div className="fd-notification-actions">
                  <button
                    type="button"
                    className="fd-mini-btn"
                    onClick={clearAllNotifications}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar todas
                  </button>
                </div>
                <div className="fd-list">
                  {intelligence.notifications.map((notification) => {
                    const isRead = !!readNotificationIds[notification.id];
                    return (
                      <div key={notification.id} className={`fd-list-row fd-notif-row ${notification.type} ${isRead ? "read" : ""}`}>
                        <p>{notification.message}</p>
                        {!isRead ? (
                          <button
                            type="button"
                            className="fd-mini-btn"
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Vista
                          </button>
                        ) : (
                          <span>Vista</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="fd-empty">Nenhuma notificação real por enquanto.</p>
            )}
          </section>
        ) : null}

        {activePath === "/dashboard" && (
          <InicioModule userName={user?.name || "Usuário"} intelligence={intelligence} />
        )}
        {activePath === "/financeiro" && <FinanceiroModule />}
        <Suspense fallback={<DashboardModuleLoading />}>
          {activePath === "/consultor" && <ConsultorModule />}
          {activePath === "/recorrencias" && <RecorrenciasModule />}
          {activePath === "/clientes" && <ClientesModule />}
          {activePath === "/itens" && <ItensModule />}
          {activePath === "/ajustes" && <AjustesModule />}
          {activePath === "/administracao" && isAdmin && <AdministracaoModule />}
        </Suspense>
      </main>

      <GlobalFloatingAction />
    </div>
  );
}

