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
import { cn } from "@/lib/utils";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const ACCEPT_PROFILE_IMAGES = "image/jpeg,image/png,image/webp";

type ProviderAccountSection = "profile" | "statement";

function verificationLabel(status: VerificationStatus) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending review";
    case "rejected":
      return "Rejected";
    default:
      return "Not verified";
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
      return "Credit card";
    case "debit_card":
      return "Debit card";
    default:
      return "PIX";
  }
}

function paymentStatusLabel(status: "pending" | "paid" | "failed" | "cancelled") {
  switch (status) {
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function subscriptionStatusLabel(status: "active" | "expired" | "cancelled") {
  switch (status) {
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "Active";
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
      toast.success("Profile photo updated.");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Could not upload the profile photo."));
    },
  });

  const photoDeleteMutation = useMutation({
    mutationFn: deleteMyProfilePhoto,
    onSuccess: (user) => {
      setStoredUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile photo removed.");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Could not remove the profile photo."));
    },
  });

  const verificationDocumentUploadMutation = useMutation({
    mutationFn: uploadProviderVerificationDocument,
    onSuccess: () => {
      toast.success("Document uploaded successfully.");
      queryClient.invalidateQueries({ queryKey: ["providerVerification"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Could not upload the document."));
    },
  });

  const verificationSelfieUploadMutation = useMutation({
    mutationFn: uploadProviderVerificationSelfie,
    onSuccess: () => {
      toast.success("Selfie uploaded successfully.");
      queryClient.invalidateQueries({ queryKey: ["providerVerification"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Could not upload the selfie."));
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
      toast.error(getApiErrorMessage(error, "Could not submit the verification request."));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = () => {
    const nextErrors: Record<string, string> = {};

    if (profileForm.name.trim() && !hasFullName(profileForm.name)) {
      nextErrors.name = "Enter your full name.";
    }

    if (profileForm.phone.trim() && !isValidBrazilPhone(profileForm.phone)) {
      nextErrors.phone = "Enter a valid phone with area code.";
    }

    setProfileErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
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
              title="Orders"
            >
              <Bell className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-primary-foreground/70 hover:text-primary-foreground"
              aria-label="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/provider/perfil?tab=profile"
              className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0"
              title="My account"
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
          <ArrowLeft className="w-4 h-4 shrink-0" /> Back to dashboard
        </Link>

        <div className="max-w-5xl mx-auto w-full space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Provider account</h1>
            <p className="text-sm text-muted-foreground">
              Manage your profile, provider verification, and subscription details in one place.
            </p>
            <ProviderAccountMenu active={activeSection} />
          </div>

          {activeSection === "profile" ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Profile details</CardTitle>
                  <CardDescription>Keep your provider account information up to date.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Provider profile"
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
                        <p className="font-semibold text-card-foreground">{me?.name ?? "Provider"}</p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <Badge variant={verificationVariant(verificationStatus)} className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {verificationLabel(verificationStatus)}
                          </Badge>
                          {currentPlanName ? <Badge variant="outline">{currentPlanName}</Badge> : <Badge variant="outline">No active plan</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground break-all">{me?.email ?? "-"}</p>
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
                          {photoUploadMutation.isPending ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
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
                            {photoDeleteMutation.isPending ? "Removing..." : "Remove photo"}
                          </Button>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 5 MB.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="provider-name">Full name</Label>
                      <Input
                        id="provider-name"
                        value={profileForm.name}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      {profileErrors.name ? <p className="text-xs text-destructive">{profileErrors.name}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-phone">Phone</Label>
                      <Input
                        id="provider-phone"
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                      {profileErrors.phone ? <p className="text-xs text-destructive">{profileErrors.phone}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-radius">Service radius (km)</Label>
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
                      <Label htmlFor="provider-cep">Work CEP</Label>
                      <Input
                        id="provider-cep"
                        placeholder="00000-000"
                        value={profileForm.workCep}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, workCep: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-address">Work address</Label>
                      <Input
                        id="provider-address"
                        placeholder="Street, number, district, city, state"
                        value={profileForm.workAddress}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, workAddress: event.target.value }))}
                      />
                    </div>
                  </div>

                  <Button variant="hero" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Current plan</CardTitle>
                    <CardDescription>Shows which plan is registered for this provider account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plansQuery.isLoading && !currentPlanName ? <p className="text-sm text-muted-foreground">Loading plan details...</p> : null}
                    {plansQuery.isError && !currentPlanName ? <p className="text-sm text-destructive">Could not load the current plan.</p> : null}

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
                            Expires on <strong>{currentPlanExpiresLabel ?? "-"}</strong>.
                          </p>
                          {typeof currentPlanDaysRemaining === "number" ? (
                            <p>
                              <strong>{currentPlanDaysRemaining}</strong> day(s) remaining in the current cycle.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
                        <p className="font-medium text-foreground">No active plan.</p>
                        <p className="text-sm text-muted-foreground">
                          Go to the plans page to register a subscription for this provider.
                        </p>
                      </div>
                    )}

                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link to="/provider/plans">Open plans page</Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Provider verification</CardTitle>
                    <CardDescription>Upload the document and selfie used in the verification review.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={verificationVariant(verificationStatus)} className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {verificationLabel(verificationStatus)}
                      </Badge>
                      {verificationStatus === "pending" ? (
                        <span className="text-xs text-muted-foreground">Your request is waiting for admin review.</span>
                      ) : null}
                    </div>

                    {verificationQuery.isError ? <p className="text-sm text-destructive">Could not load the verification details.</p> : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Document (RG/CNH)</Label>
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
                          disabled={verificationDocumentUploadMutation.isPending}
                        >
                          {verificationDocumentUploadMutation.isPending
                            ? "Uploading document..."
                            : verification?.documentUrl
                              ? "Replace document"
                              : "Upload document"}
                        </Button>
                        {verification?.documentUrl ? (
                          <a
                            href={verification.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View file <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">No document uploaded yet.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Selfie with document</Label>
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
                          disabled={verificationSelfieUploadMutation.isPending}
                        >
                          {verificationSelfieUploadMutation.isPending
                            ? "Uploading selfie..."
                            : verification?.selfieUrl
                              ? "Replace selfie"
                              : "Upload selfie"}
                        </Button>
                        {verification?.selfieUrl ? (
                          <a
                            href={verification.selfieUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View file <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">No selfie uploaded yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                      <p>Document: {verification?.documentUrl ? "uploaded" : "pending"}</p>
                      <p>Selfie: {verification?.selfieUrl ? "uploaded" : "pending"}</p>
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
                      {verificationSubmitMutation.isPending ? "Submitting..." : "Submit verification"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Subscription summary</CardTitle>
                  <CardDescription>Current plan, renewal window, and coverage of the provider account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plansQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading subscription...</p> : null}
                  {plansQuery.isError ? <p className="text-sm text-destructive">Could not load the subscription summary.</p> : null}

                  {!plansQuery.isLoading && !plansQuery.isError && currentSubscription ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Active subscription</p>
                          <p className="font-display text-2xl font-bold text-foreground">{currentSubscription.planName}</p>
                        </div>
                        <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                          {subscriptionStatusLabel(currentSubscription.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Started on</p>
                          <p className="font-medium text-foreground">{currentSubscription.startsAtLabel}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expires on</p>
                          <p className="font-medium text-foreground">{currentSubscription.expiresAtLabel}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cycle value</p>
                          <p className="font-medium text-foreground">{currentSubscription.priceLabel}</p>
                        </div>
                      </div>

                      <p className={cn("text-sm", currentSubscription.daysRemaining > 7 ? "text-muted-foreground" : "text-amber-600")}>
                        {currentSubscription.daysRemaining} day(s) remaining in this cycle.
                      </p>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Included features</p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {currentSubscription.features.map((feature) => (
                            <li key={feature} className="rounded-lg bg-background/80 px-3 py-2 text-sm text-muted-foreground border border-border/60">
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {!plansQuery.isLoading && !plansQuery.isError && !currentSubscription ? (
                    <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
                      <p className="font-medium text-foreground">No active subscription.</p>
                      <p className="text-sm text-muted-foreground">Register a plan to keep the provider account enabled.</p>
                    </div>
                  ) : null}

                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link to="/provider/plans">Manage plans</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Payment history</CardTitle>
                  <CardDescription>Mocked payment records generated when the provider purchases a plan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading payment history...</p> : null}
                  {paymentsQuery.isError ? <p className="text-sm text-destructive">Could not load the payment history.</p> : null}

                  {!paymentsQuery.isLoading && !paymentsQuery.isError && paymentsQuery.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payment records yet.</p>
                  ) : null}

                  {!paymentsQuery.isLoading && !paymentsQuery.isError && paymentsQuery.data && paymentsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-3 pr-3 font-medium">Plan</th>
                            <th className="pb-3 pr-3 font-medium">Amount</th>
                            <th className="pb-3 pr-3 font-medium">Method</th>
                            <th className="pb-3 pr-3 font-medium">Coverage</th>
                            <th className="pb-3 pr-3 font-medium">Paid at</th>
                            <th className="pb-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsQuery.data.map((payment) => (
                            <tr key={payment.id} className="border-b border-border/60 last:border-0 align-top">
                              <td className="py-3 pr-3">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{payment.planName}</p>
                                  <p className="text-xs text-muted-foreground">Mock ID: {payment.mockTransactionId}</p>
                                </div>
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.amountLabel}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">{paymentMethodLabel(payment.paymentMethod)}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">
                                {payment.coverageStartsAtLabel} to {payment.coverageEndsAtLabel}
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">{payment.paidAtLabel ?? "-"}</td>
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

