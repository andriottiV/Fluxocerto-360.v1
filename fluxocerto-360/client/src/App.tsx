// ============================================================================
// APP - FluxoCerto 360
// Design: Roteamento principal e layout da aplicação
// ============================================================================

import { useEffect } from "react";

import { useApp, AppProvider } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";

// Telas
import LandingScreen from "@/components/screens/LandingScreen";
import LoginScreen from "@/components/screens/LoginScreen";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import DashboardScreen from "@/components/screens/DashboardScreen";
import ClientsScreen from "@/components/screens/ClientsScreen";
import AuthStatusScreen from "@/components/screens/AuthStatusScreen";

function Router() {
  const { state, currentScreen, user, logout } = useApp();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [currentScreen]);

  if (state.isLoading) {
    return <div className="min-h-screen bg-[#020b08]" />;
  }

  if (!user && currentScreen !== ScreenType.LANDING && currentScreen !== ScreenType.LOGIN) {
    return <LandingScreen />;
  }

  if (user && currentScreen !== ScreenType.LOGIN) {
    if (user.status === "blocked") {
      return <AuthStatusScreen kind="blocked" onLogout={logout} />;
    }
  }

  switch (currentScreen) {
    case ScreenType.LANDING:
      return <LandingScreen />;
    case ScreenType.LOGIN:
      return <LoginScreen />;
    case ScreenType.ONBOARDING:
      return <OnboardingScreen />;
    case ScreenType.DASHBOARD:
      return <DashboardScreen />;
    case ScreenType.CLIENTS:
      return <ClientsScreen />;
    default:
      return user ? <DashboardScreen /> : <LandingScreen />;
  }
}

function AppContent() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
