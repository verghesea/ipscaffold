import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LandingPage } from "@/pages/LandingPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatentDetailPage } from "@/pages/PatentDetailPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";
import { DebugPage } from "@/pages/DebugPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/preview/:id" component={PreviewPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patent/:id" component={PatentDetailPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/debug" component={DebugPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
