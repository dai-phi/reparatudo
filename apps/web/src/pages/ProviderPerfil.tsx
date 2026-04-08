import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, ExternalLink, LogOut, ShieldCheck, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ProviderAccountMenu } from "@/components/ProviderAccountMenu";
import { Badge } from "@/components/ui/badge";
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
  getProviderVerification,
  logout,
  setStoredUser,
  submitProviderVerification,
  updateMe,
  uploadMyProfilePhoto,
  uploadProviderVerificationDocument,
  uploadProviderVerificationSelfie,
  type VerificationStatus,
} from "@/lib/api";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { planFeatureLabelPt } from "@/lib/plan-features-pt";
import { cn } from "@/lib/utils";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const ACCEPT_PROFILE_IMAGES = "image/jpeg,image/png,image/webp";

type ProviderAccountSection = "profile" | "statement";

function verificationLabel(status: VerificationStatus) {
  switch (status) {
    case "verified":
      return "Verificado";
    case "pending":
      return "Em analise";
    case "rejected":
      return "Recusado";
    default:
      return "Nao verificado";
  }
}

function verificationVariant(status: VerificationStatus): "default" | "secondary" | "destructive" {
  switch (status) {
    case "verified":
      return "default";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

function paymentMethodLabel(method: "pix" | "credit_card" | "debit_card") {
  switch (method) {
    case "credit_card":
      return "Cartao de credito";
    case "debit_card":
      return "Cartao de debito";
    default:
      return "PIX";
  }
}

function paymentStatusLabel(status: "pending" | "paid" | "failed" | "cancelled") {
  switch (status) {
    case "paid":
      return "Pago";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

function subscriptionStatusLabel(status: "active" | "expired" | "cancelled") {
  switch (status) {
    case "expired":
      return "Expirada";
    case "cancelled":
      return "Cancelada";
    default:
      return "Ativa";
  }
}

const ProviderPerfil = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();

  const activeSection: ProviderAccountSection = searchParams.get("tab") === "statement" ? "statement" : "profile";

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    radiusKm: "",
    workCep: "",
    workAddress: "",
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const verificationDocumentInputRef = useRef<HTMLInputElement>(null);
  const verificationSelfieInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home", { replace: true });
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

  const verificationQuery = useQuery({
    queryKey: ["providerVerification"],
    queryFn: getProviderVerification,
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
      toast.success(UI_MESSAGES.providerAccount.photoUpdated);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.providerAccount.photoUpload));
    },
  });

  const photoDeleteMutation = useMutation({
    mutationFn: deleteMyProfilePhoto,
    onSuccess: (user) => {
      setStoredUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(UI_MESSAGES.providerAccount.photoRemoved);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.providerAccount.photoRemove));
    },
  });

  const verificationDocumentUploadMutation = useMutation({
    mutationFn: uploadProviderVerificationDocument,
    onSuccess: () => {
      toast.success(UI_MESSAGES.providerAccount.documentUploaded);
      queryClient.invalidateQueries({ queryKey: ["providerVerification"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.providerAccount.documentUpload));
    },
  });

  const verificationSelfieUploadMutation = useMutation({
    mutationFn: uploadProviderVerificationSelfie,
    onSuccess: () => {
      toast.success(UI_MESSAGES.providerAccount.selfieUploaded);
      queryClient.invalidateQueries({ queryKey: ["providerVerification"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.providerAccount.selfieUpload));
    },
  });

  const verificationSubmitMutation = useMutation({
    mutationFn: submitProviderVerification,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["providerVerification"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.providerAccount.verificationSubmit));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = () => {
    const nextErrors: Record<string, string> = {};

    if (profileForm.name.trim() && !hasFullName(profileForm.name)) {
      nextErrors.name = "Informe nome completo (nome e sobrenome).";
    }

    if (profileForm.phone.trim() && !isValidBrazilPhone(profileForm.phone)) {
      nextErrors.phone = "Telefone invalido: use DDD + numero (10 ou 11 digitos).";
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
  const currentPlanName = currentSubscription?.planName ?? me?.currentPlan?.name ?? null;
  const currentPlanExpiresLabel = currentSubscription?.expiresAtLabel ?? me?.currentPlan?.expiresAtLabel ?? null;
  const currentPlanStatus = currentSubscription?.status ?? me?.currentPlan?.status ?? null;
  const currentPlanDaysRemaining = currentSubscription?.daysRemaining ?? null;
  const verification = verificationQuery.data;
  const verificationStatus: VerificationStatus = verification?.status ?? me?.verificationStatus ?? "unverified";
  const isProviderVerified = verificationStatus === "verified";
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
              to="/provider/perfil?tab=profile"
              className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0"
              title="Minha conta"
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

        <div className="max-w-5xl mx-auto w-full space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Conta do prestador</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seus dados de contato, endereco de trabalho, verificacao de identidade e plano no mesmo lugar.
            </p>
            <ProviderAccountMenu active={activeSection} />
          </div>

          {activeSection === "profile" ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Dados do perfil</CardTitle>
                  <CardDescription>
                    Nome, telefone, e-mail, foto publica, raio de atuacao e endereco do local de trabalho.
                  </CardDescription>
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
                      <div
                        className="w-24 h-24 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/30 flex items-center justify-center mx-auto sm:mx-0 text-muted-foreground"
                        aria-hidden
                      >
                        <User className="w-8 h-8 sm:w-7 sm:h-7 opacity-60" />
                      </div>
                    )}

                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <div className="space-y-1">
                        <p className="font-semibold text-card-foreground">{me?.name ?? "Prestador"}</p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <Badge variant={verificationVariant(verificationStatus)} className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {verificationLabel(verificationStatus)}
                          </Badge>
                          {currentPlanName ? (
                            <Badge variant="outline">{currentPlanName}</Badge>
                          ) : (
                            <Badge variant="outline">Sem plano ativo</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">E-mail (login)</p>
                        <p className="text-sm text-muted-foreground break-all">{me?.email ?? "—"}</p>
                      </div>

                      {isProviderVerified ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                          {UI_MESSAGES.providerAccount.verifiedPhotoHint}
                        </p>
                      ) : (
                        <>
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
                              {photoUploadMutation.isPending
                                ? "Enviando..."
                                : avatarUrl
                                  ? "Trocar foto"
                                  : "Enviar foto"}
                            </Button>
                            {avatarUrl ? (
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
                            ) : null}
                          </div>

                          <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP. Ate 5 MB.</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="provider-name">Nome completo</Label>
                      <Input
                        id="provider-name"
                        value={profileForm.name}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      {profileErrors.name ? <p className="text-xs text-destructive">{profileErrors.name}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-phone">Telefone (contato)</Label>
                      <Input
                        id="provider-phone"
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                      {profileErrors.phone ? <p className="text-xs text-destructive">{profileErrors.phone}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-radius">Raio de atuacao (km)</Label>
                      <Input
                        id="provider-radius"
                        type="number"
                        min={1}
                        max={50}
                        value={profileForm.radiusKm}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, radiusKm: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-cep">CEP do local de trabalho</Label>
                      <Input
                        id="provider-cep"
                        placeholder="00000-000"
                        value={profileForm.workCep}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, workCep: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="provider-address">Endereco completo do trabalho</Label>
                      <Input
                        id="provider-address"
                        placeholder="Rua, numero, bairro, cidade, estado (conforme cadastro)"
                        value={profileForm.workAddress}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, workAddress: event.target.value }))}
                      />
                    </div>
                  </div>

                  <Button variant="hero" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Salvando..." : "Salvar alteracoes"}
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Plano atual</CardTitle>
                    <CardDescription>Plano contratado e situacao da assinatura desta conta.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plansQuery.isLoading && !currentPlanName ? (
                      <p className="text-sm text-muted-foreground">Carregando plano...</p>
                    ) : null}
                    {plansQuery.isError && !currentPlanName ? (
                      <p className="text-sm text-destructive">Nao foi possivel carregar o plano atual.</p>
                    ) : null}

                    {currentPlanName ? (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{currentPlanName}</p>
                          {currentPlanStatus ? (
                            <Badge variant={currentPlanStatus === "active" ? "default" : "secondary"}>
                              {subscriptionStatusLabel(currentPlanStatus)}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            Vencimento em <strong>{currentPlanExpiresLabel ?? "—"}</strong>.
                          </p>
                          {typeof currentPlanDaysRemaining === "number" ? (
                            <p>
                              <strong>{currentPlanDaysRemaining}</strong> dia(s) restante(s) no ciclo atual.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
                        <p className="font-medium text-foreground">Nenhum plano ativo</p>
                        <p className="text-sm text-muted-foreground">
                          Acesse a pagina de planos para contratar uma assinatura.
                        </p>
                      </div>
                    )}

                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link to="/provider/plans">Ver planos</Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Verificacao de identidade</CardTitle>
                    <CardDescription>
                      Envie documento oficial e selfie para analise (quando sua conta ainda nao estiver verificada).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={verificationVariant(verificationStatus)} className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {verificationLabel(verificationStatus)}
                      </Badge>
                      {verificationStatus === "pending" ? (
                        <span className="text-xs text-muted-foreground">Seu envio esta na fila de analise.</span>
                      ) : null}
                    </div>

                    {verificationQuery.isError ? (
                      <p className="text-sm text-destructive">{UI_ERRORS.providerAccount.verificationLoad}</p>
                    ) : null}

                    {isProviderVerified ? (
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex gap-3 items-start">
                        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{UI_MESSAGES.providerAccount.verifiedKycTitle}</p>
                          <p className="text-sm text-muted-foreground">{UI_MESSAGES.providerAccount.verifiedKycDescription}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Documento (RG ou CNH)</Label>
                            <input
                              ref={verificationDocumentInputRef}
                              type="file"
                              accept={ACCEPT_PROFILE_IMAGES}
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) verificationDocumentUploadMutation.mutate(file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => verificationDocumentInputRef.current?.click()}
                              disabled={
                                verificationDocumentUploadMutation.isPending || verificationStatus === "pending"
                              }
                            >
                              {verificationDocumentUploadMutation.isPending
                                ? "Enviando documento..."
                                : verification?.documentUrl
                                  ? "Substituir documento"
                                  : "Enviar documento"}
                            </Button>
                            {verification?.documentUrl ? (
                              <a
                                href={verification.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Ver arquivo <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">Nenhum documento enviado ainda.</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Selfie segurando o documento</Label>
                            <input
                              ref={verificationSelfieInputRef}
                              type="file"
                              accept={ACCEPT_PROFILE_IMAGES}
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) verificationSelfieUploadMutation.mutate(file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => verificationSelfieInputRef.current?.click()}
                              disabled={
                                verificationSelfieUploadMutation.isPending || verificationStatus === "pending"
                              }
                            >
                              {verificationSelfieUploadMutation.isPending
                                ? "Enviando selfie..."
                                : verification?.selfieUrl
                                  ? "Substituir selfie"
                                  : "Enviar selfie"}
                            </Button>
                            {verification?.selfieUrl ? (
                              <a
                                href={verification.selfieUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Ver arquivo <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">Nenhuma selfie enviada ainda.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                          <p>Documento: {verification?.documentUrl ? "enviado" : "pendente"}</p>
                          <p>Selfie: {verification?.selfieUrl ? "enviada" : "pendente"}</p>
                        </div>

                        <Button
                          type="button"
                          variant="hero"
                          disabled={
                            verificationSubmitMutation.isPending ||
                            !verification?.canSubmit ||
                            verificationStatus === "pending" ||
                            verificationStatus === "verified"
                          }
                          onClick={() => verificationSubmitMutation.mutate()}
                        >
                          {verificationSubmitMutation.isPending
                            ? "Enviando..."
                            : "Solicitar verificacao"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Resumo da assinatura</CardTitle>
                  <CardDescription>Plano ativo, datas de vigencia e valor do ciclo de cobranca.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plansQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando assinatura...</p>
                  ) : null}
                  {plansQuery.isError ? (
                    <p className="text-sm text-destructive">Nao foi possivel carregar o resumo da assinatura.</p>
                  ) : null}

                  {!plansQuery.isLoading && !plansQuery.isError && currentSubscription ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Assinatura ativa</p>
                          <p className="font-display text-2xl font-bold text-foreground">{currentSubscription.planName}</p>
                        </div>
                        <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                          {subscriptionStatusLabel(currentSubscription.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Inicio</p>
                          <p className="font-medium text-foreground">{currentSubscription.startsAtLabel}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vencimento</p>
                          <p className="font-medium text-foreground">{currentSubscription.expiresAtLabel}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor do ciclo</p>
                          <p className="font-medium text-foreground">{currentSubscription.priceLabel}</p>
                        </div>
                      </div>

                      <p className={cn("text-sm", currentSubscription.daysRemaining > 7 ? "text-muted-foreground" : "text-amber-600")}>
                        {currentSubscription.daysRemaining} dia(s) restante(s) neste ciclo.
                      </p>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Beneficios do plano</p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {currentSubscription.features.map((feature) => (
                            <li key={feature} className="rounded-lg bg-background/80 px-3 py-2 text-sm text-muted-foreground border border-border/60">
                              {planFeatureLabelPt(feature)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {!plansQuery.isLoading && !plansQuery.isError && !currentSubscription ? (
                    <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
                      <p className="font-medium text-foreground">Nenhuma assinatura ativa</p>
                      <p className="text-sm text-muted-foreground">Contrate um plano para manter a conta do prestador ativa.</p>
                    </div>
                  ) : null}

                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link to="/provider/plans">Gerir planos</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Historico de pagamentos</CardTitle>
                  <CardDescription>Registros de pagamento ao contratar ou renovar planos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando historico...</p>
                  ) : null}
                  {paymentsQuery.isError ? (
                    <p className="text-sm text-destructive">Nao foi possivel carregar o historico de pagamentos.</p>
                  ) : null}

                  {!paymentsQuery.isLoading && !paymentsQuery.isError && paymentsQuery.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
                  ) : null}

                  {!paymentsQuery.isLoading && !paymentsQuery.isError && paymentsQuery.data && paymentsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-3 pr-3 font-medium">Plano</th>
                            <th className="pb-3 pr-3 font-medium">Valor</th>
                            <th className="pb-3 pr-3 font-medium">Forma de pagamento</th>
                            <th className="pb-3 pr-3 font-medium">Vigencia</th>
                            <th className="pb-3 pr-3 font-medium">Pago em</th>
                            <th className="pb-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsQuery.data.map((payment) => (
                            <tr key={payment.id} className="border-b border-border/60 last:border-0 align-top">
                              <td className="py-3 pr-3">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{payment.planName}</p>
                                  <p className="text-xs text-muted-foreground">Ref.: {payment.mockTransactionId}</p>
                                </div>
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.amountLabel}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">{paymentMethodLabel(payment.paymentMethod)}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">
                                {payment.coverageStartsAtLabel} a {payment.coverageEndsAtLabel}
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.paidAtLabel ?? "—"}</td>
                              <td className="py-3">
                                <Badge variant={payment.status === "paid" ? "default" : payment.status === "failed" ? "destructive" : "secondary"}>
                                  {paymentStatusLabel(payment.status)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
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

