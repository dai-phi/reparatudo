import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ProviderAccountMenu } from "@/components/ProviderAccountMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import {
  deleteMyProfilePhoto,
  getApiErrorMessage,
  getProviderPlanPayments,
  getProviderPlans,
  logout,
  setStoredUser,
  updateMe,
  uploadMyProfilePhoto,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const ACCEPT_PROFILE_IMAGES = "image/jpeg,image/png,image/webp";

type ProviderProfileSection = "profile" | "statement";

function paymentMethodLabel(paymentMethod: string) {
  switch (paymentMethod) {
    case "pix":
      return "PIX";
    case "credit_card":
      return "Cartao de credito";
    case "debit_card":
      return "Cartao de debito";
    default:
      return paymentMethod;
  }
}

function planLabel(planId: string) {
  return planId === "pro" ? "Plano Pro" : "Plano padrao";
}

const ProviderPerfil = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSection: ProviderProfileSection = searchParams.get("tab") === "statement" ? "statement" : "profile";
  const queryClient = useQueryClient();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    radiusKm: "",
    workCep: "",
    workAddress: "",
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home");
    }
  }, [me, navigate]);

  useEffect(() => {
    if (!me) return;
    setProfileForm({
      name: me.name ?? "",
      phone: me.phone ?? "",
      radiusKm: me.radiusKm ? String(me.radiusKm) : "10",
      workCep: me.workCep ?? "",
      workAddress: me.workAddress ?? "",
    });
  }, [me]);

  const plansQuery = useQuery({
    queryKey: ["providerPlans"],
    queryFn: getProviderPlans,
    enabled: Boolean(me && me.role === "provider"),
  });

  const paymentsQuery = useQuery({
    queryKey: ["providerPlanPayments"],
    queryFn: getProviderPlanPayments,
    enabled: Boolean(me && me.role === "provider"),
  });

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setProfileErrors({});
      setStoredUser(user);
      toast.success(UI_MESSAGES.profile.updated);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.profile.update));
    },
  });

  const photoUploadMutation = useMutation({
    mutationFn: uploadMyProfilePhoto,
    onSuccess: (user) => {
      setStoredUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Foto de perfil atualizada");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Nao foi possivel enviar a foto"));
    },
  });

  const photoDeleteMutation = useMutation({
    mutationFn: deleteMyProfilePhoto,
    onSuccess: (user) => {
      setStoredUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Foto de perfil removida");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Nao foi possivel remover a foto"));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = () => {
    const nextErrors: Record<string, string> = {};
    if (profileForm.name.trim() && !hasFullName(profileForm.name)) {
      nextErrors.name = "Informe nome completo (nome e sobrenome)";
    }
    if (profileForm.phone.trim() && !isValidBrazilPhone(profileForm.phone)) {
      nextErrors.phone = "Telefone invalido: use DDD + numero (10 ou 11 digitos)";
    }

    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Corrija os campos destacados.");
      return;
    }

    updateMutation.mutate({
      name: profileForm.name.trim() || undefined,
      phone: profileForm.phone.trim() || undefined,
      radiusKm: profileForm.radiusKm ? Number(profileForm.radiusKm) : undefined,
      workCep: profileForm.workCep.replace(/\D/g, "") || undefined,
      workAddress: profileForm.workAddress.trim() || undefined,
    });
  };

  const currentSubscription = plansQuery.data?.currentSubscription ?? null;
  const avatarUrl = me?.photoUrl ?? null;

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
          to="/provider/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Voltar ao painel
        </Link>

        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Conta do prestador</h1>
            <ProviderAccountMenu active={activeSection} />
          </div>

          {activeSection === "profile" ? (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-xl">Meu perfil</CardTitle>
                <CardDescription>Atualize seus dados, area de atendimento e foto de perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-24 h-24 sm:w-16 sm:h-16 rounded-full object-cover mx-auto sm:mx-0 ring-2 ring-border"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/30 flex items-center justify-center mx-auto sm:mx-0 text-muted-foreground">
                      <User className="w-8 h-8 sm:w-7 sm:h-7 opacity-60" />
                    </div>
                  )}

                  <div className="text-center sm:text-left flex-1 space-y-3 min-w-0">
                    <div>
                      <p className="font-bold text-card-foreground">{me?.name ?? "Profissional"}</p>
                      <p className="text-sm text-muted-foreground break-all">{me?.email ?? "email@exemplo.com"}</p>
                    </div>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                      <input
                        ref={profilePhotoInputRef}
                        type="file"
                        accept={ACCEPT_PROFILE_IMAGES}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) photoUploadMutation.mutate(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={photoUploadMutation.isPending || photoDeleteMutation.isPending}
                      >
                        {photoUploadMutation.isPending ? "Enviando..." : avatarUrl ? "Trocar foto" : "Enviar foto"}
                      </Button>
                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => photoDeleteMutation.mutate()}
                          disabled={photoUploadMutation.isPending || photoDeleteMutation.isPending}
                        >
                          {photoDeleteMutation.isPending ? "Removendo..." : "Remover foto"}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP. Maximo de 5 MB.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nome</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(event) => setProfileForm((previous) => ({ ...previous, name: event.target.value }))}
                    />
                    {profileErrors.name && <p className="text-xs text-destructive">{profileErrors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((previous) => ({ ...previous, phone: event.target.value }))}
                    />
                    {profileErrors.phone && <p className="text-xs text-destructive">{profileErrors.phone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Raio de atuacao (km)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={profileForm.radiusKm}
                      onChange={(event) => setProfileForm((previous) => ({ ...previous, radiusKm: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>CEP do local de trabalho</Label>
                    <Input
                      placeholder="00000-000"
                      value={profileForm.workCep}
                      onChange={(event) => setProfileForm((previous) => ({ ...previous, workCep: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Endereco do local de trabalho</Label>
                    <Input
                      placeholder="Rua, numero, bairro, cidade, UF"
                      value={profileForm.workAddress}
                      onChange={(event) => setProfileForm((previous) => ({ ...previous, workAddress: event.target.value }))}
                    />
                  </div>
                </div>

                <Button variant="hero" className="w-full sm:w-auto" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar alteracoes"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Assinatura atual</CardTitle>
                  <CardDescription>
                    O extrato mostra o plano contratado, a data de vencimento e o historico de pagamentos mockados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plansQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando assinatura...</p>}
                  {plansQuery.isError && <p className="text-sm text-destructive">Nao foi possivel carregar a assinatura.</p>}
                  {!plansQuery.isLoading && !plansQuery.isError && currentSubscription && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{planLabel(currentSubscription.planId)}</p>
                        <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          Ativo
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Vence em <strong>{currentSubscription.expiresAtLabel}</strong>.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Valor do ciclo atual: <strong>{currentSubscription.priceLabel}</strong>.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Restam <strong>{currentSubscription.daysRemaining}</strong> dia(s) para renovar.
                      </p>
                    </div>
                  )}
                  {!plansQuery.isLoading && !plansQuery.isError && !currentSubscription && (
                    <div className="rounded-xl border border-dashed border-border p-4 sm:p-5 space-y-3">
                      <p className="font-medium text-foreground">Nenhum plano ativo.</p>
                      <p className="text-sm text-muted-foreground">
                        Ative um plano para registrar a assinatura do provider e manter o extrato atualizado.
                      </p>
                      <Link to="/provider/plans">
                        <Button variant="hero">Ir para planos</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Historico de pagamentos</CardTitle>
                  <CardDescription>Pagamentos mockados vinculados aos planos do provider.</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando historico...</p>}
                  {paymentsQuery.isError && <p className="text-sm text-destructive">Nao foi possivel carregar o extrato.</p>}
                  {paymentsQuery.data && paymentsQuery.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
                  )}
                  {paymentsQuery.data && paymentsQuery.data.length > 0 && (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">Plano</th>
                            <th className="pb-2 pr-3 font-medium">Valor</th>
                            <th className="pb-2 pr-3 font-medium">Forma</th>
                            <th className="pb-2 pr-3 font-medium">Cobertura</th>
                            <th className="pb-2 pr-3 font-medium">Data</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsQuery.data.map((payment) => (
                            <tr key={payment.id} className="border-b border-border/60 last:border-0">
                              <td className="py-3 pr-3">{planLabel(payment.planId)}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.amountLabel}</td>
                              <td className="py-3 pr-3">{paymentMethodLabel(payment.paymentMethod)}</td>
                              <td className="py-3 pr-3">
                                {payment.coverageStartsAtLabel} ate {payment.coverageEndsAtLabel}
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.paidAtLabel ?? "-"}</td>
                              <td className="py-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                    payment.status === "paid"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {payment.status === "paid" ? "Pago" : payment.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderPerfil;
