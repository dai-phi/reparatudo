import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Bell, Copy, CreditCard, LogOut, QrCode, User, Wallet, Wrench } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ApiError,
  createProviderBillingPayment,
  getProviderBillingPayments,
  getProviderBillingSummary,
  logout,
  setStoredUser,
  updateMe,
  type ProviderPaymentMethod,
  type ProviderPaymentStatus,
} from "@/lib/api";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

function paymentMethodLabel(f: ProviderPaymentMethod) {
  switch (f) {
    case "pix":
      return "PIX";
    case "cartao_credito":
      return "Cartão de crédito";
    case "cartao_debito":
      return "Cartão de débito";
    default:
      return f;
  }
}

function paymentStatusLabel(s: ProviderPaymentStatus) {
  switch (s) {
    case "paid":
      return "Pago";
    case "pending":
      return "Pendente";
    case "cancelled":
      return "Cancelado";
    default:
      return s;
  }
}

const ProviderPerfil = () => {
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    radiusKm: "",
    workCep: "",
    workAddress: "",
    photoUrl: "",
  });
  const [payMethod, setPayMethod] = useState<ProviderPaymentMethod>("pix");
  const [cardLast4, setCardLast4] = useState("");
  const [lastPixPayload, setLastPixPayload] = useState<string | null>(null);

  const billingSummaryQuery = useQuery({
    queryKey: ["providerBillingSummary"],
    queryFn: getProviderBillingSummary,
    enabled: Boolean(me && me.role === "provider"),
  });

  const billingPaymentsQuery = useQuery({
    queryKey: ["providerBillingPayments"],
    queryFn: getProviderBillingPayments,
    enabled: Boolean(me && me.role === "provider"),
  });

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home");
    }
  }, [me, navigate]);

  useEffect(() => {
    if (me) {
      setProfileForm({
        name: me.name ?? "",
        phone: me.phone ?? "",
        radiusKm: me.radiusKm ? String(me.radiusKm) : "10",
        workCep: me.workCep ?? "",
        workAddress: me.workAddress ?? "",
        photoUrl: me.photoUrl ?? "",
      });
    }
  }, [me]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setStoredUser(user);
      toast.success(UI_MESSAGES.profile.updated);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.profile.update;
      toast.error(message);
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      createProviderBillingPayment({
        paymentMethod: payMethod,
        cardLastFour:
          payMethod === "cartao_credito" || payMethod === "cartao_debito" ? cardLast4.replace(/\D/g, "").slice(0, 4) : undefined,
      }),
    onSuccess: (data) => {
      toast.success(UI_MESSAGES.billing.paymentRegistered);
      setLastPixPayload(data.pixCopyPaste ?? null);
      queryClient.invalidateQueries({ queryKey: ["providerBillingSummary"] });
      queryClient.invalidateQueries({ queryKey: ["providerBillingPayments"] });
      setCardLast4("");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.billing.pay;
      toast.error(message);
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = () => {
    updateMutation.mutate({
      name: profileForm.name.trim() || undefined,
      phone: profileForm.phone.trim() || undefined,
      radiusKm: profileForm.radiusKm ? Number(profileForm.radiusKm) : undefined,
      workCep: profileForm.workCep.replace(/\D/g, "") || undefined,
      workAddress: profileForm.workAddress.trim() || undefined,
      photoUrl: profileForm.photoUrl.trim() || undefined,
    });
  };

  const copyPix = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(UI_MESSAGES.billing.pixCodeCopied);
    } catch {
      toast.error(UI_ERRORS.billing.copyPix);
    }
  };

  const summary = billingSummaryQuery.data;

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
            <Link
              to="/provider/dashboard"
              className="relative p-2 text-primary-foreground/70 hover:text-primary-foreground"
              title="Pedidos"
            >
              <Bell className="w-5 h-5" />
            </Link>
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
          to="/provider/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Voltar ao painel
        </Link>

        <div className="max-w-3xl mx-auto w-full space-y-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Conta do prestador</h1>

          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md h-auto p-1 sm:inline-flex sm:w-auto">
              <TabsTrigger value="perfil" className="text-sm sm:text-base px-4 py-2.5">
                Perfil
              </TabsTrigger>
              <TabsTrigger value="extrato" className="text-sm sm:text-base px-4 py-2.5">
                Extrato
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-6 space-y-4 sm:mt-8">
              <div className="rounded-xl bg-card shadow-card p-4 sm:p-6 space-y-4 sm:max-w-2xl">
                <h2 className="font-display text-xl font-semibold text-card-foreground">Meu perfil</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  {profileForm.photoUrl ? (
                    <img
                      src={profileForm.photoUrl}
                      alt="Foto"
                      className="w-24 h-24 sm:w-16 sm:h-16 rounded-full object-cover mx-auto sm:mx-0"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-16 sm:h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto sm:mx-0">
                      <User className="w-10 h-10 sm:w-8 sm:h-8 text-accent" />
                    </div>
                  )}
                  <div className="text-center sm:text-left">
                    <p className="font-bold text-card-foreground">{me?.name ?? "Profissional"}</p>
                    <p className="text-sm text-muted-foreground break-all">{me?.email ?? "email@exemplo.com"}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Raio de atuação (km)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={profileForm.radiusKm}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, radiusKm: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Endereço do local de trabalho</Label>
                    <Input
                      placeholder="Rua, número, bairro, cidade, UF"
                      value={profileForm.workAddress}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, workAddress: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>CEP do local de trabalho</Label>
                    <Input
                      placeholder="00000-000"
                      value={profileForm.workCep}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, workCep: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Foto (URL)</Label>
                    <Input
                      placeholder="https://..."
                      value={profileForm.photoUrl}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Cole o link de uma imagem para sua foto de perfil</p>
                  </div>
                  <Button variant="hero" className="w-full sm:w-auto" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="extrato" className="mt-6 space-y-6 sm:mt-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="font-display text-lg sm:text-xl">Mensalidade Repara Tudo!</CardTitle>
                    <CardDescription>
                      Os dois primeiros meses após o cadastro são gratuitos. Depois, é cobrada uma mensalidade para uso da plataforma.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {billingSummaryQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                    {billingSummaryQuery.isError && (
                      <p className="text-sm text-destructive">Nao foi possivel carregar o resumo de cobrança.</p>
                    )}
                    {summary && (
                      <>
                        {summary.inFreePeriod ? (
                          <div
                            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
                            role="status"
                          >
                            <p className="font-medium text-foreground">Período gratuito ativo</p>
                            <p className="text-muted-foreground mt-1">
                              Você não precisa pagar até <strong>{summary.freeEndsAtLabel}</strong>. Após essa data, a mensalidade
                              será de <strong>{summary.monthlyFeeLabel}</strong>.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-2">
                            <p
                              className={cn(
                                "font-medium",
                                summary.hasOutstanding ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                              )}
                            >
                              {summary.hasOutstanding
                                ? "Há mensalidade em aberto."
                                : "Nenhuma mensalidade em aberto no momento."}
                            </p>
                            <p className="text-muted-foreground">
                              Valor da mensalidade: <strong>{summary.monthlyFeeLabel}</strong> por mês.
                            </p>
                            {summary.unpaidMonths.length > 0 && (
                              <ul className="list-disc list-inside text-muted-foreground">
                                {summary.unpaidMonths.map((m) => (
                                  <li key={m.referenceMonth}>{m.label}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {summary && !summary.inFreePeriod && summary.hasOutstanding && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-display text-lg sm:text-xl">Pagar mensalidade</CardTitle>
                      <CardDescription>Escolha a forma de pagamento. Integração demonstrativa — PIX e cartão são simulados.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-base">Forma de pagamento</Label>
                        <RadioGroup
                          value={payMethod}
                          onValueChange={(v) => setPayMethod(v as ProviderPaymentMethod)}
                          className="grid gap-3 sm:grid-cols-3"
                        >
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                              payMethod === "pix" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                            )}
                          >
                            <RadioGroupItem value="pix" id="pay-pix" />
                            <QrCode className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">PIX (QR + código)</span>
                          </label>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                              payMethod === "cartao_credito" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                            )}
                          >
                            <RadioGroupItem value="cartao_credito" id="pay-cc" />
                            <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">Crédito</span>
                          </label>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                              payMethod === "cartao_debito" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                            )}
                          >
                            <RadioGroupItem value="cartao_debito" id="pay-dd" />
                            <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">Débito</span>
                          </label>
                        </RadioGroup>
                      </div>

                      {(payMethod === "cartao_credito" || payMethod === "cartao_debito") && (
                        <div className="space-y-2 max-w-xs">
                          <Label htmlFor="card-last4">Últimos 4 dígitos do cartão</Label>
                          <Input
                            id="card-last4"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="0000"
                            value={cardLast4}
                            onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          />
                          <p className="text-xs text-muted-foreground">Ambiente de demonstração: informe apenas os 4 últimos dígitos.</p>
                        </div>
                      )}

                      {payMethod === "pix" && (
                        <p className="text-sm text-muted-foreground">
                          Após confirmar, você verá o QR Code e o código copia e cola do PIX (simulado).
                        </p>
                      )}

                      <Button
                        variant="hero"
                        className="w-full sm:w-auto"
                        disabled={payMutation.isPending || (payMethod !== "pix" && cardLast4.length !== 4)}
                        onClick={() => payMutation.mutate()}
                      >
                        {payMutation.isPending ? "Processando..." : "Confirmar pagamento"}
                      </Button>

                      {lastPixPayload && (
                        <div className="rounded-lg border border-border p-4 space-y-4">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <QrCode className="h-4 w-4" /> PIX — pagamento registrado
                          </p>
                          <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lastPixPayload)}`}
                              alt="QR Code PIX"
                              className="rounded-md border bg-white p-2 mx-auto sm:mx-0"
                              width={200}
                              height={200}
                            />
                            <div className="flex-1 min-w-0 space-y-2 w-full">
                              <Label className="text-xs text-muted-foreground">Copia e cola</Label>
                              <p className="text-xs break-all font-mono bg-muted/50 rounded p-2 border">{lastPixPayload}</p>
                              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => copyPix(lastPixPayload)}>
                                <Copy className="h-4 w-4" />
                                Copiar código
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg sm:text-xl">Histórico de pagamentos</CardTitle>
                    <CardDescription>
                      Registros de mensalidades pagas ao sistema Repara Tudo!
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {billingPaymentsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                    {billingPaymentsQuery.isError && (
                      <p className="text-sm text-destructive">Nao foi possivel carregar o extrato.</p>
                    )}
                    {billingPaymentsQuery.data && billingPaymentsQuery.data.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
                    )}
                    {billingPaymentsQuery.data && billingPaymentsQuery.data.length > 0 && (
                      <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-3 font-medium">Competência</th>
                              <th className="pb-2 pr-3 font-medium">Valor</th>
                              <th className="pb-2 pr-3 font-medium">Forma</th>
                              <th className="pb-2 pr-3 font-medium">Data</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingPaymentsQuery.data.map((row) => (
                              <tr key={row.id} className="border-b border-border/60 last:border-0">
                                <td className="py-3 pr-3 capitalize">{row.referenceMonthLabel}</td>
                                <td className="py-3 pr-3 whitespace-nowrap">{row.amountLabel}</td>
                                <td className="py-3 pr-3">{paymentMethodLabel(row.paymentMethod)}</td>
                                <td className="py-3 pr-3 whitespace-nowrap">{row.paidAtLabel}</td>
                                <td className="py-3">{paymentStatusLabel(row.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProviderPerfil;
