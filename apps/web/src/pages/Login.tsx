import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, login, setAuth } from "@/lib/api";
import { useAuthUser } from "@/hooks/useAuth";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const Login = () => {
  const navigate = useNavigate();
  const { data: user, isLoading } = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (isLoading || !user) return;
    navigate(user.role === "provider" ? "/provider/dashboard" : "/client/home", { replace: true });
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = await login({ email: form.email.trim(), password: form.password });
      setAuth(auth);
      toast.success(UI_MESSAGES.auth.loginSuccess);
      navigate(auth.user.role === "provider" ? "/provider/dashboard" : "/client/home");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.auth.login;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-hero relative items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-primary-foreground">Repara Tudo!</span>
          </div>
          <h2 className="font-display text-4xl font-bold text-primary-foreground mb-4">
            Volte e finalize seus serviços
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Acompanhe pedidos, conversas e historico de atendimentos.
          </p>
          <div className="mt-12 space-y-4">
            {["Chat integrado", "Historico completo", "Profissionais verificados"].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Entrar</h1>
          <p className="text-muted-foreground mb-8">Acesse sua conta</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
              Entrar
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground mt-6 space-y-2">
            <p>
              Ainda nao tem conta?{" "}
              <Link to="/client/register" className="text-accent font-medium hover:underline">
                Sou cliente
              </Link>
            </p>
            <p>
              <Link to="/provider/register" className="text-accent font-medium hover:underline">
                Sou profissional
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
