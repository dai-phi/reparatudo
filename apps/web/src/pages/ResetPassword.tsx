import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, resetPasswordWithToken } from "@/lib/api";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tokenFromUrl) {
      setErrors({ token: "Link inválido ou incompleto. Solicite um novo e-mail na recuperação de senha." });
    }
  }, [tokenFromUrl]);

  const inputErrorClass = (key: string) =>
    errors[key] ? "border-destructive focus-visible:ring-destructive" : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!tokenFromUrl) next.token = "Link inválido.";
    if (password.length < 6) next.password = "Senha deve ter no mínimo 6 caracteres";
    if (password !== passwordConfirm) next.passwordConfirm = "As senhas não conferem";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await resetPasswordWithToken({
        token: tokenFromUrl,
        password,
        passwordConfirm,
      });
      toast.success(UI_MESSAGES.auth.passwordResetSuccess);
      toast.info(res.message);
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : UI_ERRORS.auth.resetPassword;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = !tokenFromUrl;

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
          <p className="text-primary-foreground/80 text-lg">Escolha uma senha nova e segura para sua conta.</p>
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

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Nova senha</h1>
          <p className="text-muted-foreground mb-8">Defina uma nova senha para acessar sua conta.</p>

          {errors.token && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive mb-6">
              {errors.token}
              <div className="mt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/forgot-password">Pedir novo link</Link>
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={invalidLink}
                aria-invalid={Boolean(errors.password)}
                className={inputErrorClass("password")}
                autoComplete="new-password"
              />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <div>
              <Label htmlFor="passwordConfirm">Confirmar senha</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="Repita a senha"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={invalidLink}
                aria-invalid={Boolean(errors.passwordConfirm)}
                className={inputErrorClass("passwordConfirm")}
                autoComplete="new-password"
              />
              {errors.passwordConfirm && (
                <p className="text-xs text-destructive mt-1">{errors.passwordConfirm}</p>
              )}
            </div>
            <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading || invalidLink}>
              Salvar nova senha
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
