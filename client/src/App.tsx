import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LandingPage } from "@/pages/LandingPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatentDetailPage } from "@/pages/PatentDetailPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/preview/:id" component={PreviewPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patent/:id" component={PatentDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
