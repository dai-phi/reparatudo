import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, requestPasswordReset } from "@/lib/api";
import { UI_ERRORS } from "@/value-objects/messages";

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Informe seu e-mail");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("E-mail inválido");
      return;
    }
    setLoading(true);
    try {
      const res = await requestPasswordReset({ email: email.trim() });
      setSent(true);
      toast.success(res.message);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : UI_ERRORS.auth.forgotPassword;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-hero relative items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-primary-foreground">Repara Tudo!</span>
          </div>
          <p className="text-primary-foreground/80 text-lg">
            Enviaremos um link seguro para o e-mail cadastrado, se existir conta.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar ao login
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Esqueci minha senha</h1>
          <p className="text-muted-foreground mb-8">
            Digite o e-mail da sua conta. Você receberá instruções para criar uma nova senha.
          </p>

          {sent ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              <p className="mb-3">
                Se existir uma conta com este e-mail, enviaremos instruções para redefinir a senha. Verifique também a
                pasta de spam.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(error)}
                  className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
              </div>
              <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
                Enviar link
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
