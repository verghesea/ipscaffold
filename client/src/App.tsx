import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LandingPage } from "@/pages/LandingPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatentDetailPage } from "@/pages/PatentDetailPage";
import { ArtifactPrintPage } from "@/pages/ArtifactPrintPage";
import { ProfilePage } from "@/pages/ProfilePage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";
import { DebugPage } from "@/pages/DebugPage";
import DiagnosticsPage from "@/pages/DiagnosticsPage";
import { AlphaFullPage } from "@/pages/AlphaFullPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/preview/:id" component={PreviewPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patent/:id" component={PatentDetailPage} />
      <Route path="/artifact/:id" component={ArtifactPrintPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/debug" component={DebugPage} />
      <Route path="/diagnostics" component={DiagnosticsPage} />
      <Route path="/alpha-full" component={AlphaFullPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
