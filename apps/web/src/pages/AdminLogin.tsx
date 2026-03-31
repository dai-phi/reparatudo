import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getAdminProviderVerifications } from "@/lib/api";
import { toast } from "sonner";

const ADMIN_SESSION_KEY = "reparatudo_admin_session";
const ADMIN_KYC_KEY_STORAGE = "reparatudo_admin_kyc_key";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState(
    sessionStorage.getItem(ADMIN_KYC_KEY_STORAGE) || import.meta.env.VITE_ADMIN_KYC_KEY || ""
  );
  const [loading, setLoading] = useState(false);

  const expectedEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim();
  const expectedPassword = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined)?.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      toast.error("Informe a chave admin KYC.");
      return;
    }

    if (expectedEmail && email.trim() !== expectedEmail) {
      toast.error("E-mail de admin inválido.");
      return;
    }
    if (expectedPassword && password !== expectedPassword) {
      toast.error("Senha de admin inválida.");
      return;
    }

    setLoading(true);
    try {
      // Valida a chave antes de criar sessão admin local
      await getAdminProviderVerifications(adminKey.trim(), "pending");
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      sessionStorage.setItem(ADMIN_KYC_KEY_STORAGE, adminKey.trim());
      if (email.trim()) {
        sessionStorage.setItem("reparatudo_admin_email", email.trim());
      }
      toast.success("Login admin realizado.");
      navigate("/admin/provider-verifications", { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Não foi possível validar acesso admin.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login admin</CardTitle>
          <CardDescription>Acesso interno sem link público.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Sua senha de admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-key">Chave admin KYC</Label>
              <Input
                id="admin-key"
                type="password"
                placeholder="ADMIN_KYC_KEY"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
