import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProviderRegister from "./pages/ProviderRegister";
import ProviderDashboard from "./pages/ProviderDashboard";
import ProviderPerfil from "./pages/ProviderPerfil";
import ProviderPlans from "./pages/ProviderPlans";
import ClientRegister from "./pages/ClientRegister";
import ClientHome from "./pages/ClientHome";
import ClientOpenJobsList from "./pages/ClientOpenJobsList";
import ClientOpenJobDetail from "./pages/ClientOpenJobDetail";
import ClientPerfil from "./pages/ClientPerfil";
import ProviderOpenJob from "./pages/ProviderOpenJob";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminProviderVerifications from "./pages/AdminProviderVerifications";
import AdminLogin from "./pages/AdminLogin";
import Legal from "./pages/Legal";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/provider/register" element={<ProviderRegister />} />
          <Route path="/provider/dashboard" element={<ProviderDashboard />} />
          <Route path="/provider/perfil" element={<ProviderPerfil />} />
          <Route path="/provider/plans" element={<ProviderPlans />} />
          <Route path="/client/register" element={<ClientRegister />} />
          <Route path="/client/home" element={<ClientHome />} />
          <Route path="/client/open-jobs" element={<ClientOpenJobsList />} />
          <Route path="/client/open-jobs/:id" element={<ClientOpenJobDetail />} />
          <Route path="/client/perfil" element={<ClientPerfil />} />
          <Route path="/provider/open-jobs/:id" element={<ProviderOpenJob />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/provider-verifications" element={<AdminProviderVerifications />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
