import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Wrench, Zap, Droplets, PaintBucket, Hammer, User, Bell, LogOut,
  Search, ArrowRight, Loader2, ClipboardList, Star, MessageSquare, ShieldCheck,
  ChevronLeft, ChevronRight,
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
  fetchServiceCatalog,
  getClientHistory,
  getClientRequests,
  getProviders,
  getRequest,
  logout,
  type ProviderCard,
  type ProviderSearchSort,
} from "@/lib/api";
import { useWebsocket, type WebsocketEvent } from "@/lib/websocket";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ClientOpenJobsListContent, type ChamadosSituation } from "@/components/client/client-open-jobs-list-content";

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

function formatServiceWithSubtype(service: string, subtypeLabel?: string | null) {
  return subtypeLabel ? `${service} — ${subtypeLabel}` : service;
}

const HISTORICO_PAGE_SIZE = 6;

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

type LocationState = {
  openHistory?: boolean;
  rateRequestId?: string;
  openRequestedChamados?: boolean;
} | null;

const ClientHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"request" | "requested" | "history">("request");
  const [requestedMain, setRequestedMain] = useState<"services" | "openJobs">("services");
  const [requestedSegment, setRequestedSegment] = useState<"open" | "historico">("open");
  const [historicoPage, setHistoricoPage] = useState(1);
  const [chamadosSituation, setChamadosSituation] = useState<ChamadosSituation>("open");
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
  const [providerSort, setProviderSort] = useState<ProviderSearchSort>("recommended");
  const [providerVerifiedOnly, setProviderVerifiedOnly] = useState(false);
  const [providerMinRating, setProviderMinRating] = useState<number | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);

  const selectedServiceMeta = services.find((service) => service.id === selectedService);

  const catalogQuery = useQuery({
    queryKey: ["serviceCatalog"],
    queryFn: fetchServiceCatalog,
    staleTime: 60 * 60 * 1000,
  });

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
      return;
    }
    if (state?.openRequestedChamados) {
      setActiveTab("requested");
      setRequestedMain("openJobs");
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
  const historicoTotalPages = Math.max(1, Math.ceil(historicRequests.length / HISTORICO_PAGE_SIZE));
  const historicRequestsPage = historicRequests.slice(
    (historicoPage - 1) * HISTORICO_PAGE_SIZE,
    historicoPage * HISTORICO_PAGE_SIZE
  );

  useEffect(() => {
    setHistoricoPage((p) => Math.min(p, historicoTotalPages));
  }, [historicoTotalPages]);

  const providersQuery = useQuery({
    queryKey: ["providers", selectedService, providerSort, providerVerifiedOnly, providerMinRating],
    queryFn: () =>
      getProviders(selectedService!, {
        sort: providerSort,
        verifiedOnly: providerVerifiedOnly,
        minRating: providerMinRating ?? undefined,
      }),
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
        serviceSubtype: selectedSubtype!,
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
    if (!selectedSubtype) {
      toast.error("Selecione o detalhe do serviço.");
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
      serviceSubtype: selectedSubtype,
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
                Em Serviços, acompanhe conversas com prestadores (em aberto ou histórico). Em Chamados, veja pedidos publicados à região e
                propostas recebidas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
                {(
                  [
                    { key: "services" as const, label: "Serviços" },
                    { key: "openJobs" as const, label: "Chamados" },
                  ] as const
                ).map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => {
                      setRequestedMain(seg.key);
                      if (seg.key === "openJobs") setChamadosSituation("open");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      requestedMain === seg.key
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
              {requestedMain === "services" ? (
                <div
                  className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 max-sm:w-full sm:ml-auto"
                  role="group"
                  aria-label="Período da lista de serviços"
                >
                  <div className="inline-flex rounded-full border border-border/80 bg-background/80 p-0.5 shadow-sm">
                    {(
                      [
                        { key: "open" as const, label: "Em aberto" },
                        { key: "historico" as const, label: "Histórico" },
                      ] as const
                    ).map((seg) => (
                      <button
                        key={seg.key}
                        type="button"
                        onClick={() => {
                          setRequestedSegment(seg.key);
                          setHistoricoPage(1);
                        }}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          requestedSegment === seg.key
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 max-sm:w-full sm:ml-auto"
                  role="group"
                  aria-label="Situação dos chamados"
                >
                  <div className="inline-flex rounded-full border border-border/80 bg-background/80 p-0.5 shadow-sm">
                    {(
                      [
                        { key: "open" as const, label: "Em aberto" },
                        { key: "closed" as const, label: "Encerrados" },
                      ] as const
                    ).map((seg) => (
                      <button
                        key={seg.key}
                        type="button"
                        onClick={() => setChamadosSituation(seg.key)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          chamadosSituation === seg.key
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {requestedMain === "services" ? (
              <>
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
                              {formatServiceWithSubtype(r.service, r.serviceSubtypeLabel)} • {r.time}
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
                    {historicRequestsPage.map((r) => (
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
                            {formatServiceWithSubtype(r.service, r.serviceSubtypeLabel)} • {r.time}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.desc}</p>
                          <p className="text-xs text-muted-foreground/80 mt-2">Somente leitura</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                      </motion.button>
                    ))}
                    {historicoTotalPages > 1 ? (
                      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          {(historicoPage - 1) * HISTORICO_PAGE_SIZE + 1}–
                          {Math.min(historicoPage * HISTORICO_PAGE_SIZE, historicRequests.length)} de {historicRequests.length} · Página{" "}
                          {historicoPage} de {historicoTotalPages}
                        </p>
                        <div className="flex gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={historicoPage <= 1}
                            onClick={() => setHistoricoPage((p) => Math.max(1, p - 1))}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={historicoPage >= historicoTotalPages}
                            onClick={() => setHistoricoPage((p) => Math.min(historicoTotalPages, p + 1))}
                            className="gap-1"
                          >
                            Próxima
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <ClientOpenJobsListContent
                showIntro={false}
                situation={chamadosSituation}
                onSituationChange={setChamadosSituation}
                onEmptyGoToNovoServico={() => {
                  setActiveTab("request");
                }}
              />
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
                      onClick={() => {
                        setSelectedService(service.id);
                        setSelectedSubtype(null);
                      }}
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

            {selectedService && (
              <div className="mb-6 space-y-2 max-w-md">
                <Label htmlFor="service-subtype">
                  Detalhe do serviço <span className="text-destructive">*</span>
                </Label>
                {catalogQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando opções...</p>
                ) : catalogQuery.isError || !catalogQuery.data ? (
                  <p className="text-sm text-destructive">Não foi possível carregar os detalhes. Tente de novo.</p>
                ) : (
                  <Select
                    value={selectedSubtype ?? undefined}
                    onValueChange={(v) => setSelectedSubtype(v)}
                  >
                    <SelectTrigger id="service-subtype">
                      <SelectValue placeholder="Selecione o detalhe do serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const subtypes =
                          catalogQuery.data.services.find((s) => s.id === selectedService)?.subtypes ?? [];
                        const main = subtypes.filter((st) => !st.groupPt);
                        const byGroup = new Map<string, typeof subtypes>();
                        for (const st of subtypes) {
                          if (!st.groupPt) continue;
                          const list = byGroup.get(st.groupPt) ?? [];
                          list.push(st);
                          byGroup.set(st.groupPt, list);
                        }
                        return (
                          <>
                            {main.length > 0 ? (
                              <SelectGroup>
                                {main.map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {st.labelPt}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : null}
                            {[...byGroup.entries()].map(([groupLabel, items]) => (
                              <SelectGroup key={groupLabel}>
                                <SelectLabel>{groupLabel}</SelectLabel>
                                {items.map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {st.labelPt}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

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

                {!pendingRequestId && requestMode === "direct" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="min-w-[200px] flex-1 space-y-1.5">
                      <Label htmlFor="provider-sort" className="text-xs text-muted-foreground">
                        Ordenar por
                      </Label>
                      <Select
                        value={providerSort}
                        onValueChange={(v) => setProviderSort(v as ProviderSearchSort)}
                      >
                        <SelectTrigger id="provider-sort" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recommended">Melhor combinação</SelectItem>
                          <SelectItem value="distance">Mais próximos</SelectItem>
                          <SelectItem value="rating">Melhor avaliação</SelectItem>
                          <SelectItem value="response_time">Resposta mais rápida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[160px] flex-1 space-y-1.5">
                      <Label htmlFor="provider-min-rating" className="text-xs text-muted-foreground">
                        Nota mínima
                      </Label>
                      <Select
                        value={providerMinRating === null ? "any" : String(providerMinRating)}
                        onValueChange={(v) => {
                          if (v === "any") setProviderMinRating(null);
                          else setProviderMinRating(Number(v));
                        }}
                      >
                        <SelectTrigger id="provider-min-rating" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Qualquer</SelectItem>
                          <SelectItem value="3">3 estrelas ou mais</SelectItem>
                          <SelectItem value="4">4 estrelas ou mais</SelectItem>
                          <SelectItem value="4.5">4,5 estrelas ou mais</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pb-0.5 sm:pb-1">
                      <Checkbox
                        id="provider-verified-only"
                        checked={providerVerifiedOnly}
                        onCheckedChange={(c) => setProviderVerifiedOnly(c === true)}
                      />
                      <Label htmlFor="provider-verified-only" className="text-sm font-normal cursor-pointer">
                        Só prestadores verificados
                      </Label>
                    </div>
                  </div>
                )}

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
                          setRequestedMain("services");
                          setRequestedSegment("open");
                          setHistoricoPage(1);
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
                        disabled={openJobMutation.isPending || !description.trim() || !selectedSubtype}
                        onClick={() => {
                          if (!selectedSubtype) {
                            toast.error("Selecione o detalhe do serviço.");
                            return;
                          }
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
                        Acompanhe em{" "}
                        <button
                          type="button"
                          className="text-accent underline underline-offset-2 hover:opacity-90"
                          onClick={() => {
                            setActiveTab("requested");
                            setRequestedMain("openJobs");
                          }}
                        >
                          Serviços Solicitados → Chamados
                        </button>
                        .
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
                            {providerSort === "recommended" && provider.matchScore != null && (
                              <p className="text-xs text-muted-foreground">
                                Combinação: {provider.matchScore.toFixed(1)} / 100
                              </p>
                            )}
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
                              if (!selectedSubtype) {
                                toast.error("Selecione o detalhe do serviço antes de chamar um prestador.");
                                return;
                              }
                              setCallModalProvider(provider);
                              setCallDescription("");
                            }}
                            disabled={isSubmittingRequest || Boolean(pendingRequestId) || !selectedSubtype}
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
                      <p className="text-sm text-muted-foreground">
                        {formatServiceWithSubtype(svc.service, svc.serviceSubtypeLabel)} • {svc.date}
                      </p>
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
