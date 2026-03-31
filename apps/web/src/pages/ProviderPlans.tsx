import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, CreditCard, LogOut, QrCode, User, Wallet, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ProviderAccountMenu } from "@/components/ProviderAccountMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import {
  getApiErrorMessage,
  getProviderPlans,
  logout,
  purchaseProviderPlan,
  type ProviderPlanId,
  type ProviderPlanPaymentMethod,
  type ProviderPlanPaymentRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

function planLabel(planId: ProviderPlanId) {
  return planId === "standard" ? "Plano padrao" : "Plano Pro";
}

function paymentMethodLabel(method: ProviderPlanPaymentMethod) {
  switch (method) {
    case "pix":
      return "PIX";
    case "credit_card":
      return "Cartao de credito";
    case "debit_card":
      return "Cartao de debito";
    default:
      return method;
  }
}

const ProviderPlans = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();

  const [selectedPlanId, setSelectedPlanId] = useState<ProviderPlanId>("standard");
  const [paymentMethod, setPaymentMethod] = useState<ProviderPlanPaymentMethod>("pix");
  const [cardLastFour, setCardLastFour] = useState("");
  const [lastReceipt, setLastReceipt] = useState<ProviderPlanPaymentRow | null>(null);

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home");
    }
  }, [me, navigate]);

  const plansQuery = useQuery({
    queryKey: ["providerPlans"],
    queryFn: getProviderPlans,
    enabled: Boolean(me && me.role === "provider"),
  });

  useEffect(() => {
    if (!plansQuery.data) return;
    const currentPlanId = plansQuery.data.currentSubscription?.planId;
    const firstPlanId = plansQuery.data.plans[0]?.id;
    if (currentPlanId) {
      setSelectedPlanId(currentPlanId);
      return;
    }
    if (firstPlanId) {
      setSelectedPlanId(firstPlanId);
    }
  }, [plansQuery.data]);

  const selectedPlan = useMemo(
    () => plansQuery.data?.plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plansQuery.data, selectedPlanId]
  );

  const purchaseMutation = useMutation({
    mutationFn: () =>
      purchaseProviderPlan({
        planId: selectedPlanId,
        paymentMethod,
        cardLastFour: paymentMethod === "pix" ? undefined : cardLastFour,
      }),
    onSuccess: (data) => {
      setLastReceipt(data.payment);
      setCardLastFour("");
      toast.success(UI_MESSAGES.plans.purchaseCompleted);
      queryClient.invalidateQueries({ queryKey: ["providerPlans"] });
      queryClient.invalidateQueries({ queryKey: ["providerPlanPayments"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.plans.purchase));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleCopyPix = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(UI_MESSAGES.plans.pixCodeCopied);
    } catch {
      toast.error(UI_ERRORS.plans.copyPix);
    }
  };

  const currentSubscription = plansQuery.data?.currentSubscription ?? null;
  const isSelectedCurrentPlan = currentSubscription?.planId === selectedPlanId;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex flex-wrap items-center justify-between gap-3 h-auto min-h-16 py-2 sm:h-16 sm:py-0">
          <Link to="/provider/dashboard" className="flex items-center gap-2 text-primary-foreground hover:opacity-90 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Repara Tudo!</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-primary-foreground/70 hover:text-primary-foreground"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/provider/perfil"
              className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0"
              title="Meu perfil"
            >
              <User className="w-5 h-5 text-accent" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-6 sm:py-8 px-4 sm:px-6">
        <Link
          to="/provider/perfil?tab=statement"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Voltar para a conta
        </Link>

        <div className="max-w-5xl mx-auto w-full space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Planos do prestador</h1>
            <p className="text-sm text-muted-foreground">
              Escolha o plano que mantem sua conta ativa para receber servicos na plataforma.
            </p>
            <ProviderAccountMenu active="plans" />
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg sm:text-xl">Plano atual</CardTitle>
              <CardDescription>Mostra qual plano esta vinculado ao provider no momento.</CardDescription>
            </CardHeader>
            <CardContent>
              {plansQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando plano atual...</p>}
              {plansQuery.isError && <p className="text-sm text-destructive">Nao foi possivel carregar os dados do plano.</p>}
              {!plansQuery.isLoading && !plansQuery.isError && currentSubscription && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{planLabel(currentSubscription.planId)}</p>
                    <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Ativo
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vencimento em <strong>{currentSubscription.expiresAtLabel}</strong>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Restam <strong>{currentSubscription.daysRemaining}</strong> dia(s) neste ciclo.
                  </p>
                </div>
              )}
              {!plansQuery.isLoading && !plansQuery.isError && !currentSubscription && (
                <div className="rounded-xl border border-dashed border-border p-4 sm:p-5">
                  <p className="font-medium text-foreground">Nenhum plano ativo.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha um plano abaixo para ativar a assinatura do provider.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid gap-4 md:grid-cols-2">
              {plansQuery.data?.plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={cn(
                    "border transition-colors",
                    plan.id === selectedPlanId ? "border-primary shadow-card" : "border-border"
                  )}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-display text-xl">{planLabel(plan.id)}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </div>
                      {plan.isCurrent && (
                        <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                          Cadastrado
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-display text-3xl font-bold text-foreground">{plan.priceLabel}</p>
                      <p className="text-sm text-muted-foreground">por mes</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="rounded-lg bg-muted/40 px-3 py-2">
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant={plan.id === selectedPlanId ? "hero" : "outline"}
                      className="w-full"
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      {plan.id === selectedPlanId ? "Plano selecionado" : "Selecionar plano"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border h-fit">
              <CardHeader>
                <CardTitle className="font-display text-lg sm:text-xl">Pagamento mockado</CardTitle>
                <CardDescription>
                  O pagamento ainda e demonstrativo. A compra apenas registra o plano e o historico da assinatura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Plano selecionado</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedPlan ? planLabel(selectedPlan.id) : "Selecione um plano"}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedPlan?.priceLabel ?? "-"}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">Forma de pagamento</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as ProviderPlanPaymentMethod)}
                    className="grid gap-3"
                  >
                    {[
                      { id: "pix", label: "PIX", icon: QrCode },
                      { id: "credit_card", label: "Cartao de credito", icon: CreditCard },
                      { id: "debit_card", label: "Cartao de debito", icon: Wallet },
                    ].map((option) => {
                      const Icon = option.icon;

                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                            paymentMethod === option.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          )}
                        >
                          <RadioGroupItem value={option.id} id={`payment-${option.id}`} />
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">{option.label}</span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>

                {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
                  <div className="space-y-2">
                    <Label htmlFor="card-last-four">Ultimos 4 digitos do cartao</Label>
                    <Input
                      id="card-last-four"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      value={cardLastFour}
                      onChange={(event) => setCardLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  variant="hero"
                  className="w-full"
                  disabled={
                    !selectedPlan ||
                    purchaseMutation.isPending ||
                    ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && cardLastFour.length !== 4)
                  }
                  onClick={() => purchaseMutation.mutate()}
                >
                  {purchaseMutation.isPending
                    ? "Processando..."
                    : isSelectedCurrentPlan
                      ? "Renovar plano"
                      : "Comprar plano"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Metodo selecionado: <strong>{paymentMethodLabel(paymentMethod)}</strong>.
                </p>

                {lastReceipt && (
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div>
                      <p className="font-medium text-foreground">Pagamento registrado</p>
                      <p className="text-sm text-muted-foreground">
                        {planLabel(lastReceipt.planId)} • {lastReceipt.amountLabel}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">Periodo coberto</p>
                      <p className="font-medium text-foreground">
                        {lastReceipt.coverageStartsAtLabel} ate {lastReceipt.coverageEndsAtLabel}
                      </p>
                    </div>
                    {lastReceipt.pixCopyPaste && (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
                          <QrCode className="mx-auto h-10 w-10 text-muted-foreground" />
                          <p className="mt-2 text-xs text-muted-foreground">PIX mockado para demonstracao</p>
                        </div>
                        <p className="break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">
                          {lastReceipt.pixCopyPaste}
                        </p>
                        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => handleCopyPix(lastReceipt.pixCopyPaste!)}>
                          <Copy className="h-4 w-4" />
                          Copiar codigo
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderPlans;
