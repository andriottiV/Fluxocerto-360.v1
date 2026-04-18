// ============================================================================
// APP - FluxoCerto 360
// Design: Roteamento principal e layout da aplicação
// ============================================================================

import { useApp, AppProvider } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";

// Telas
import LoginScreen from "@/components/screens/LoginScreen";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import DashboardScreen from "@/components/screens/DashboardScreen";
import ClientsScreen from "@/components/screens/ClientsScreen";
import AuthStatusScreen from "@/components/screens/AuthStatusScreen";
import { isActive } from "@/lib/authz";

function Router() {
  const { currentScreen, user, logout } = useApp();

  if (currentScreen !== ScreenType.LOGIN && !user) {
    return <LoginScreen />;
  }

  if (user && currentScreen !== ScreenType.LOGIN && !isActive(user)) {
    if (user.status === "pending") {
      return <AuthStatusScreen kind="pending" onLogout={logout} />;
    }
    if (user.status === "blocked") {
      return <AuthStatusScreen kind="blocked" onLogout={logout} />;
    }
    return <AuthStatusScreen kind="denied" onLogout={logout} />;
  }

  switch (currentScreen) {
    case ScreenType.LOGIN:
      return <LoginScreen />;
    case ScreenType.ONBOARDING:
      return <OnboardingScreen />;
    case ScreenType.DASHBOARD:
      return <DashboardScreen />;
    case ScreenType.CLIENTS:
      return <ClientsScreen />;
    default:
      return <LoginScreen />;
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
