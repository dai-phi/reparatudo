import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Wrench, Zap, Droplets, PaintBucket, Hammer, User, Bell, LogOut,
  Search, ArrowRight, Loader2, ClipboardList, Star, MessageSquare, ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ApiError,
  cancelRequest,
  createClientOpenJob,
  createRating,
  createServiceRequest,
  getClientHistory,
  getClientRequests,
  getProviders,
  getRequest,
  logout,
  type ProviderCard,
} from "@/lib/api";
import { useWebsocket, type WebsocketEvent } from "@/lib/websocket";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

/** Tailwind classes for request status chips (client request list). */
function clientRequestStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-yellow-500/15 text-yellow-800 border-yellow-500/25 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/35";
    case "accepted":
      return "bg-sky-500/15 text-sky-800 border-sky-500/25 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500/35";
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-800 border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/35";
    case "completed":
      return "bg-muted/80 text-muted-foreground border-border";
    case "cancelled":
    case "rejected":
      return "bg-destructive/15 text-destructive border-destructive/25 dark:bg-destructive/20";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

const services = [
  { id: "eletrica", icon: Zap, label: "Elétrica", desc: "Tomadas, fiação, disjuntores", color: "from-yellow-400 to-amber-500" },
  { id: "hidraulica", icon: Droplets, label: "Hidráulica", desc: "Vazamentos, encanamento", color: "from-blue-400 to-cyan-500" },
  { id: "pintura", icon: PaintBucket, label: "Pintura", desc: "Paredes, tetos, fachadas", color: "from-pink-400 to-rose-500" },
  { id: "montagem", icon: Hammer, label: "Montagem", desc: "Móveis, prateleiras", color: "from-orange-400 to-red-500" },
  { id: "reparos", icon: Wrench, label: "Reparos Gerais", desc: "Diversos serviços", color: "from-emerald-400 to-green-500" },
];

const RATING_TAGS = [
  { id: "pontual", label: "Pontual" },
  { id: "limpo", label: "Limpo" },
  { id: "educado", label: "Educado" },
  { id: "comunicativo", label: "Comunicativo" },
  { id: "resolutivo", label: "Resolutivo" },
] as const;

const StarRating = ({ rating, onRate, interactive = true }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`transition-transform ${interactive ? "hover:scale-125 cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= (hover || rating)
                ? "text-warning fill-warning"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

type LocationState = { openHistory?: boolean; rateRequestId?: string } | null;

const ClientHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"request" | "requested" | "history">("request");
  const [requestedSegment, setRequestedSegment] = useState<"open" | "historico">("open");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [ratingServiceId, setRatingServiceId] = useState<string | null>(null);
  const [tempRating, setTempRating] = useState(0);
  const [tempReview, setTempReview] = useState("");
  const [tempTags, setTempTags] = useState<string[]>([]);
  const [cancelPendingOpen, setCancelPendingOpen] = useState(false);
  const [requestMode, setRequestMode] = useState<"direct" | "open">("direct");
  const [callModalProvider, setCallModalProvider] = useState<ProviderCard | null>(null);
  const [callDescription, setCallDescription] = useState("");

  const selectedServiceMeta = services.find((service) => service.id === selectedService);

  useEffect(() => {
    if (me && me.role !== "client") {
      navigate("/provider/dashboard");
    }
  }, [me, navigate]);

  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.openHistory && state?.rateRequestId) {
      setActiveTab("history");
      setRatingServiceId(state.rateRequestId);
      queryClient.invalidateQueries({ queryKey: ["clientHistory"] });
      toast.success(UI_MESSAGES.request.completedAndRatePrompt);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, queryClient]);

  const historyQuery = useQuery({
    queryKey: ["clientHistory"],
    queryFn: getClientHistory,
    enabled: Boolean(me && me.role === "client"),
  });

  const clientRequestsQuery = useQuery({
    queryKey: ["clientRequests"],
    queryFn: getClientRequests,
    enabled: Boolean(me && me.role === "client"),
  });

  const openRequests = (clientRequestsQuery.data ?? []).filter((r) => r.chatOpen);
  const historicRequests = (clientRequestsQuery.data ?? []).filter((r) => !r.chatOpen);

  const providersQuery = useQuery({
    queryKey: ["providers", selectedService],
    queryFn: () => getProviders(selectedService || ""),
    enabled: Boolean(selectedService) && requestMode === "direct",
  });

  const requestMutation = useMutation({
    mutationFn: createServiceRequest,
    onSuccess: (data) => {
      setCallModalProvider(null);
      setCallDescription("");
      setPendingRequestId(data.requestId);
      queryClient.invalidateQueries({ queryKey: ["clientRequests"] });
      toast.success(UI_MESSAGES.request.createdAndWaitingProvider);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.request.create;
      toast.error(message);
    },
  });

  const openJobMutation = useMutation({
    mutationFn: () =>
      createClientOpenJob({
        serviceId: selectedService!,
        description: description.trim(),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clientOpenJobs"] });
      toast.success("Chamado publicado. Voce recebera propostas dos prestadores na regiao.");
      navigate(`/client/open-jobs/${data.openJobId}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel publicar o chamado.";
      toast.error(message);
    },
  });

  const ratingMutation = useMutation({
    mutationFn: createRating,
    onSuccess: () => {
      toast.success(UI_MESSAGES.rating.submitted);
      setRatingServiceId(null);
      setTempRating(0);
      setTempReview("");
      setTempTags([]);
      queryClient.invalidateQueries({ queryKey: ["clientHistory"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.rating.submit;
      toast.error(message);
    },
  });

  const pendingRequestQuery = useQuery({
    queryKey: ["request", pendingRequestId],
    queryFn: () => getRequest(pendingRequestId || ""),
    enabled: Boolean(pendingRequestId),
    refetchInterval: 10000,
  });

  const isSubmittingRequest = requestMutation.isPending;

  const cancelPendingMutation = useMutation({
    mutationFn: () => cancelRequest(pendingRequestId!),
    onSuccess: () => {
      const rid = pendingRequestId;
      setPendingRequestId(null);
      setCancelPendingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clientRequests"] });
      if (rid) queryClient.removeQueries({ queryKey: ["request", rid] });
      toast.success(UI_MESSAGES.request.cancelled);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.request.cancel;
      toast.error(message);
    },
  });
  const completedServices = historyQuery.data ?? [];

  const handleRequestWsEvent = useCallback(
    (event: WebsocketEvent) => {
      if (!pendingRequestId || event.requestId !== pendingRequestId) return;
      if (event.type === "request.updated") {
        queryClient.invalidateQueries({ queryKey: ["clientRequests"] });
      }
      if (event.type === "request.updated" && event.payload?.status === "accepted") {
        navigate(`/chat/${pendingRequestId}`);
      }
      if (event.type === "request.updated" && (event.payload?.status === "rejected" || event.payload?.status === "cancelled")) {
        toast.error(UI_MESSAGES.request.providerRejectedOrCancelled);
        setPendingRequestId(null);
      }
    },
    [pendingRequestId, navigate, queryClient]
  );

  useWebsocket({
    requestId: pendingRequestId ?? undefined,
    enabled: Boolean(pendingRequestId),
    onEvent: handleRequestWsEvent,
  });

  useEffect(() => {
    if (!pendingRequestId || !pendingRequestQuery.data) return;
    const status = pendingRequestQuery.data.status;
    if (status === "accepted") {
      navigate(`/chat/${pendingRequestId}`);
    }
    if (status === "rejected" || status === "cancelled") {
      toast.error(UI_MESSAGES.request.providerRejectedOrCancelled);
      setPendingRequestId(null);
    }
  }, [pendingRequestId, pendingRequestQuery.data, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const confirmDirectRequest = () => {
    if (!selectedService || !callModalProvider) {
      toast.error(UI_MESSAGES.validation.selectService);
      return;
    }
    if (!callDescription.trim()) {
      toast.error(UI_MESSAGES.validation.descriptionRequired);
      return;
    }
    requestMutation.mutate({
      serviceId: selectedService,
      description: callDescription.trim(),
      providerId: callModalProvider.id,
    });
  };

  const submitRating = (id: string) => {
    if (tempRating === 0) {
      toast.error(UI_MESSAGES.validation.selectRating);
      return;
    }
    ratingMutation.mutate({ requestId: id, rating: tempRating, review: tempReview.trim() || undefined, tags: tempTags });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Repara Tudo!</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/client/open-jobs"
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-2"
            >
              Chamados abertos
            </Link>
            <Link
              to="/client/perfil"
              className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center"
              title="Meu perfil"
            >
              <User className="w-5 h-5 text-accent" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-muted rounded-xl p-1 mb-8 w-fit max-w-full">
          {[
            { key: "request" as const, label: "Novo Serviço", icon: Search },
            { key: "requested" as const, label: "Serviços Solicitados", icon: MessageSquare },
            { key: "history" as const, label: "Serviços Realizados", icon: ClipboardList },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "requested" ? (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Serviços Solicitados</h1>
              <p className="text-muted-foreground">
                Em aberto você pode conversar com o prestador. No histórico, apenas visualização.
              </p>
            </div>

            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
              {(
                [
                  { key: "open" as const, label: "Em aberto" },
                  { key: "historico" as const, label: "Histórico" },
                ] as const
              ).map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  onClick={() => setRequestedSegment(seg.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    requestedSegment === seg.key
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            {clientRequestsQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : clientRequestsQuery.isError ? (
              <div className="text-center py-12 text-muted-foreground">Não foi possível carregar os pedidos.</div>
            ) : requestedSegment === "open" ? (
              openRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed border-border">
                  Nenhum serviço em aberto. Solicite um novo serviço na aba anterior.
                </div>
              ) : (
                <div className="space-y-3">
                  {openRequests.map((r) => (
                    <motion.button
                      key={r.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(`/chat/${r.id}`)}
                      className="w-full text-left p-5 rounded-xl bg-card shadow-card border border-border hover:border-accent/40 transition-colors flex items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-card-foreground">{r.provider}</p>
                          <Badge
                            variant="secondary"
                            className={cn("font-normal border", clientRequestStatusBadgeClass(r.status))}
                          >
                            {r.statusLabel}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {r.service} • {r.time}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.desc}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </motion.button>
                  ))}
                </div>
              )
            ) : historicRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed border-border">
                Nenhum pedido no histórico ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {historicRequests.map((r) => (
                  <motion.button
                    key={r.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/chat/${r.id}`)}
                    className="w-full text-left p-5 rounded-xl bg-card shadow-card border border-border hover:border-accent/40 transition-colors flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-card-foreground">{r.provider}</p>
                        <Badge
                          variant="outline"
                          className={cn("font-normal border", clientRequestStatusBadgeClass(r.status))}
                        >
                          {r.statusLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.service} • {r.time}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.desc}</p>
                      <p className="text-xs text-muted-foreground/80 mt-2">Somente leitura</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "request" ? (
          <>
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">O que você precisa?</h1>
              <p className="text-muted-foreground">Selecione o tipo de serviço e chame um prestador</p>
            </div>

            <div className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {services.map((service) => {
                  const selected = selectedService === service.id;
                  return (
                    <motion.button
                      key={service.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedService(service.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center ${
                        selected
                          ? "border-accent bg-accent/5 shadow-elevated"
                          : "border-border bg-card hover:border-accent/30 shadow-card"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                        <service.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-card-foreground leading-tight">{service.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{service.desc}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {selectedService && requestMode === "open" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <Label className="mb-2 block">
                    Descreva o problema <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Ex: A tomada da cozinha parou de funcionar..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none"
                    rows={3}
                    required
                    aria-required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {selectedService && (
              <div className="mb-8 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {pendingRequestId
                        ? "Pedido em aberto"
                        : requestMode === "open"
                          ? "Pedido aberto a propostas"
                          : "Prestadores Disponíveis"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      para {selectedServiceMeta?.label ?? "o serviço selecionado"}
                    </p>
                  </div>
                  {!pendingRequestId && (
                    <div className="flex rounded-lg border border-border p-0.5 bg-muted/50 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setRequestMode("direct")}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          requestMode === "direct"
                            ? "bg-card shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Prestador específico
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequestMode("open")}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          requestMode === "open"
                            ? "bg-card shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Aberto a propostas
                      </button>
                    </div>
                  )}
                </div>

                {pendingRequestId ? (
                  <Card className="border-accent/30 bg-accent/5 shadow-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-display">
                        {UI_MESSAGES.request.waitingProviderResponse}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {pendingRequestQuery.isLoading
                          ? UI_MESSAGES.request.providerNameLoading
                          : pendingRequestQuery.data?.provider?.name ?? UI_MESSAGES.request.providerNameLoading}
                      </p>
                    </CardHeader>
                    <CardContent className="pb-2 pt-0">
                      <p className="text-sm text-muted-foreground">{UI_MESSAGES.request.pendingRedirectHint}</p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveTab("requested");
                          setRequestedSegment("open");
                        }}
                      >
                        {UI_MESSAGES.request.viewInRequestedServices}
                      </Button>
                      {pendingRequestQuery.data?.status === "accepted" && (
                        <Button asChild type="button" variant="hero" size="sm">
                          <Link to={`/chat/${pendingRequestId}`}>Abrir chat</Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancelPendingOpen(true)}
                        disabled={cancelPendingMutation.isPending}
                      >
                        {UI_MESSAGES.request.cancelPendingRequest}
                      </Button>
                    </CardFooter>
                  </Card>
                ) : requestMode === "open" ? (
                  <Card className="border-accent/25 bg-card shadow-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">Receba propostas de prestadores</CardTitle>
                      <p className="text-sm text-muted-foreground font-normal">
                        Seu pedido fica visível para profissionais no seu raio. Você compara valores e prazos e escolhe uma
                        proposta para seguir no chat.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="hero"
                        className="w-full sm:w-auto"
                        disabled={openJobMutation.isPending || !description.trim()}
                        onClick={() => {
                          if (!description.trim()) {
                            toast.error(UI_MESSAGES.validation.descriptionRequired);
                            return;
                          }
                          openJobMutation.mutate();
                        }}
                      >
                        {openJobMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Publicar chamado aberto"
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-3">
                        Acompanhe em <Link className="text-accent underline" to="/client/open-jobs">Chamados abertos</Link>.
                      </p>
                    </CardContent>
                  </Card>
                ) : providersQuery.isLoading ? (
                  <div className="text-center text-muted-foreground py-8">Carregando prestadores...</div>
                ) : providersQuery.isError ? (
                  <div className="text-center text-muted-foreground py-8">Não foi possível carregar os prestadores.</div>
                ) : (providersQuery.data?.length ?? 0) === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Nenhum prestador no raio informado.</div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {providersQuery.data?.map((provider) => {
                      const avgLabel = provider.avgResponseMins >= 9999 ? "--" : `${provider.avgResponseMins} min`;
                      return (
                        <div
                          key={provider.id}
                          className="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all border-border bg-card hover:border-accent/30"
                        >
                          {provider.photoUrl ? (
                            <img src={provider.photoUrl} alt={provider.name} className="w-16 h-16 rounded-full object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-lg font-bold text-accent">
                              {provider.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-card-foreground">{provider.name}</p>
                              {provider.isVerified && (
                                <Badge variant="default" className="gap-1 px-2 py-0 text-[10px]">
                                  <ShieldCheck className="w-3 h-3" /> Verificado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Star className="w-4 h-4 text-warning fill-warning" />
                              {provider.rating.toFixed(1)} • Tempo médio: {avgLabel}
                            </div>
                            <p className="text-xs text-muted-foreground">Distância: {provider.distanceKm ?? "--"} km</p>
                            {provider.lastServiceDistanceKm != null && (
                              <p className="text-xs text-muted-foreground">
                                Último atendimento a {provider.lastServiceDistanceKm} km de você
                              </p>
                            )}
                          </div>
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={() => {
                              setCallModalProvider(provider);
                              setCallDescription("");
                            }}
                            disabled={isSubmittingRequest || Boolean(pendingRequestId)}
                          >
                            Chamar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Dialog
              open={Boolean(callModalProvider)}
              onOpenChange={(open) => {
                if (!open) {
                  setCallModalProvider(null);
                  setCallDescription("");
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">Chamar prestador</DialogTitle>
                  <DialogDescription>
                    Revise os dados e descreva o problema. O pedido será enviado apenas para este profissional.
                  </DialogDescription>
                </DialogHeader>
                {callModalProvider && (
                  <div className="space-y-4">
                    <div className="flex gap-4 rounded-xl border border-border bg-muted/30 p-4">
                      {callModalProvider.photoUrl ? (
                        <img
                          src={callModalProvider.photoUrl}
                          alt={callModalProvider.name}
                          className="w-16 h-16 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">
                          {callModalProvider.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{callModalProvider.name}</p>
                          {callModalProvider.isVerified && (
                            <Badge variant="default" className="gap-1 px-2 py-0 text-[10px]">
                              <ShieldCheck className="h-3 w-3" /> Verificado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Star className="h-4 w-4 shrink-0 fill-warning text-warning" />
                          {callModalProvider.rating.toFixed(1)} • Tempo médio:{" "}
                          {callModalProvider.avgResponseMins >= 9999
                            ? "--"
                            : `${callModalProvider.avgResponseMins} min`}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Distância: {callModalProvider.distanceKm ?? "--"} km
                        </p>
                        {callModalProvider.lastServiceDistanceKm != null && (
                          <p className="text-xs text-muted-foreground">
                            Último atendimento a {callModalProvider.lastServiceDistanceKm} km de você
                          </p>
                        )}
                        {selectedServiceMeta && (
                          <p className="text-xs text-muted-foreground">
                            Serviço: <span className="text-foreground">{selectedServiceMeta.label}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="call-problem-desc" className="mb-2 block">
                        Descreva o problema <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="call-problem-desc"
                        placeholder="Ex: A tomada da cozinha parou de funcionar..."
                        value={callDescription}
                        onChange={(e) => setCallDescription(e.target.value)}
                        className="resize-none"
                        rows={4}
                        aria-required
                      />
                    </div>
                  </div>
                )}
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCallModalProvider(null);
                      setCallDescription("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="hero"
                    onClick={confirmDirectRequest}
                    disabled={
                      requestMutation.isPending ||
                      !callDescription.trim() ||
                      !callModalProvider
                    }
                  >
                    {requestMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar pedido"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={cancelPendingOpen} onOpenChange={setCancelPendingOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{UI_MESSAGES.request.cancelPendingConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{UI_MESSAGES.request.cancelPendingConfirmDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => cancelPendingMutation.mutate()}
                    disabled={cancelPendingMutation.isPending}
                  >
                    {cancelPendingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirmar cancelamento"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          /* History / Completed Services */
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-foreground">Serviços Realizados</h2>
            {historyQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando histórico...</div>
            ) : historyQuery.isError ? (
              <div className="text-center py-12 text-muted-foreground">Não foi possível carregar o histórico.</div>
            ) : completedServices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum serviço finalizado ainda.</div>
            ) : (
              completedServices.map((svc) => (
                <motion.div
                  key={svc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl bg-card shadow-card border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-card-foreground">{svc.provider}</p>
                      <p className="text-sm text-muted-foreground">{svc.service} • {svc.date}</p>
                    </div>
                    <span className="text-sm font-bold text-accent">{svc.value}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{svc.desc}</p>

                  {svc.rated ? (
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-3">
                      <StarRating rating={svc.rating} interactive={false} />
                      {svc.review && <p className="text-sm text-muted-foreground italic">"{svc.review}"</p>}
                      </div>
                      {(svc.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {svc.tags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {svc.providerResponse && (
                        <p className="text-sm text-muted-foreground">Resposta do prestador: "{svc.providerResponse}"</p>
                      )}
                    </div>
                  ) : ratingServiceId === svc.id ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-2 border-t border-border">
                      <div>
                        <Label className="mb-2 block text-sm">Sua nota</Label>
                        <StarRating rating={tempRating} onRate={setTempRating} />
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Comentario (opcional)</Label>
                        <Textarea placeholder="Como foi a experiencia?" value={tempReview} onChange={(e) => setTempReview(e.target.value)} rows={2} className="resize-none" />
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Tags (opcional)</Label>
                        <div className="flex flex-wrap gap-2">
                          {RATING_TAGS.map((tag) => {
                            const selected = tempTags.includes(tag.id);
                            return (
                              <Button
                                key={tag.id}
                                type="button"
                                variant={selected ? "hero" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setTempTags((prev) => (prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]))
                                }
                              >
                                {tag.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="hero" size="sm" onClick={() => submitRating(svc.id)}>Enviar Avaliacao</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRatingServiceId(null);
                            setTempRating(0);
                            setTempReview("");
                            setTempTags([]);
                          }}
                        >
                          Avaliar depois
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setRatingServiceId(svc.id)}>
                      <Star className="w-4 h-4" /> Avaliar Prestador
                    </Button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientHome;
