import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Wrench, Star, ClipboardList, DollarSign, Clock, MapPin, Bell,
  User, LogOut, Check, X, MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, RequestSummary, acceptRequest, cancelRequest, completeRequest, confirmRequest, getProviderHistory, getProviderRequests, getProviderStats, logout, rejectRequest } from "@/lib/api";
import { useWebsocket, type WebsocketEvent } from "@/lib/websocket";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";

const isInService = (status?: string) => status === "confirmed";

const requestStatusLabel = (request: RequestSummary) => {
  if (request.statusLabel) return request.statusLabel;
  if (request.status === "confirmed") return "Em atendimento";
  if (request.status === "accepted") return "Em negociação";
  if (request.status === "open") return "Novo pedido";
  return request.status ?? "Sem status";
};

const requestPendingStep = (request: RequestSummary) => request.pendingStepLabel ?? null;

const ProviderDashboard = () => {
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const [activeSection, setActiveSection] = useState<"nearby" | "history">("nearby");
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home");
    }
  }, [me, navigate]);

  const requestsQuery = useQuery({
    queryKey: ["providerRequests"],
    queryFn: getProviderRequests,
    enabled: Boolean(me && me.role === "provider"),
  });

  const statsQuery = useQuery({
    queryKey: ["providerStats"],
    queryFn: getProviderStats,
    enabled: Boolean(me && me.role === "provider"),
  });

  const historyQuery = useQuery({
    queryKey: ["providerHistory"],
    queryFn: getProviderHistory,
    enabled: Boolean(me && me.role === "provider"),
  });

  const handleSocketEvent = useCallback((event: WebsocketEvent) => {
    if (event.type !== "provider.request" || !event.payload) return;
    queryClient.setQueryData<RequestSummary[]>(["providerRequests"], (old) => {
      const filtered = (old ?? []).filter((item) => item.id !== event.payload.id);
      return [event.payload, ...filtered];
    });
    toast.success(`Novo pedido de ${event.payload.client}`);
    setHasNewRequest(true);
  }, [queryClient]);

  useWebsocket({
    enabled: Boolean(me && me.role === "provider"),
    onEvent: handleSocketEvent,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptRequest,
    onSuccess: (_data, requestId) => {
      toast.success("Pedido aceito! Chat aberto com o cliente.");
      queryClient.invalidateQueries({ queryKey: ["providerRequests"] });
      if (requestId) {
        navigate(`/chat/${requestId}`);
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel aceitar o pedido";
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectRequest,
    onSuccess: () => {
      toast("Pedido recusado");
      queryClient.invalidateQueries({ queryKey: ["providerRequests"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel recusar o pedido";
      toast.error(message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeRequest,
    onSuccess: () => {
      toast.success("Atendimento finalizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["providerRequests"] });
      queryClient.invalidateQueries({ queryKey: ["providerHistory"] });
      setFinishDialogOpen(false);
      setSelectedRequestId(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel finalizar o atendimento";
      toast.error(message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelRequest(id, reason),
    onSuccess: () => {
      toast("Atendimento cancelado");
      queryClient.invalidateQueries({ queryKey: ["providerRequests"] });
      setCancelDialogOpen(false);
      setCancelReason("");
      setSelectedRequestId(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel cancelar o atendimento";
      toast.error(message);
    },
  });

  const confirmServiceMutation = useMutation({
    mutationFn: (id: string) => confirmRequest(id),
    onSuccess: () => {
      toast.success("Servico confirmado.");
      queryClient.invalidateQueries({ queryKey: ["providerRequests"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Não foi possível confirmar o serviço";
      toast.error(message);
    },
  });

  const handleAccept = (id: string) => {
    setHasNewRequest(false);
    acceptMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    setHasNewRequest(false);
    rejectMutation.mutate(id);
  };

  const openFinishDialog = (id: string) => {
    setSelectedRequestId(id);
    setFinishDialogOpen(true);
  };

  const confirmFinish = () => {
    if (!selectedRequestId) return;
    completeMutation.mutate(selectedRequestId);
  };

  const openCancelDialog = (id: string) => {
    setSelectedRequestId(id);
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (!selectedRequestId) return;
    cancelMutation.mutate({ id: selectedRequestId, reason: cancelReason.trim() || undefined });
  };

  const handleConfirmService = (id: string) => {
    confirmServiceMutation.mutate(id);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const requests = requestsQuery.data ?? [];
  const activeRequests = requests.filter((req) => isInService(req.status));
  const upcomingRequests = requests.filter((req) => !isInService(req.status));
  const prioritizedRequests = [...activeRequests, ...upcomingRequests];
  const stats = statsQuery.data;
  const history = historyQuery.data ?? [];
  const statsCards = [
    { icon: ClipboardList, label: "Pedidos Atendidos", value: String(stats?.attendedCount ?? 0), color: "text-accent", key: "history" as const },
    { icon: Star, label: "Avaliacao", value: (stats?.ratingAvg ?? 0).toFixed(1), color: "text-warning" },
    { icon: DollarSign, label: "Ganhos do Mes", value: stats?.monthEarningsLabel ?? "R$ 0,00", color: "text-success" },
    { icon: Clock, label: "Tempo Medio", value: `${stats?.avgResponseMins ?? 0} min`, color: "text-accent" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-primary-foreground">Repara Tudo!</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHasNewRequest(false)}
              className="relative p-2 text-primary-foreground/70 hover:text-primary-foreground"
            >
              <Bell className="w-5 h-5" />
              {hasNewRequest && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-primary-foreground/70 hover:text-primary-foreground"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/provider/perfil"
              className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center"
              title="Meu perfil"
            >
              <User className="w-5 h-5 text-accent" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">Ola, {me?.name ?? "Profissional"}!</h1>
          <p className="text-muted-foreground">Veja suas metricas e pedidos do dia</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat) => (
            <motion.div
              key={stat.label}
              className={`p-5 rounded-xl bg-card shadow-card ${stat.key === "history" ? "cursor-pointer hover:ring-2 hover:ring-accent/30 transition-all" : ""}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={stat.key === "history" ? () => setActiveSection("history") : undefined}
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mb-2`} />
              <p className="font-display text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-foreground">
                {activeSection === "history" ? "Historico de Pedidos Atendidos" : "Pedidos"}
              </h2>
              {activeSection === "history" && (
                <Button variant="outline" size="sm" onClick={() => setActiveSection("nearby")}>
                  Ver pedidos próximos
                </Button>
              )}
            </div>
            <AnimatePresence>
              {activeSection === "history" ? (
                historyQuery.isLoading ? (
                  <div className="text-center py-16 text-muted-foreground">Carregando historico...</div>
                ) : historyQuery.isError ? (
                  <div className="text-center py-16 text-muted-foreground">Nao foi possivel carregar o historico.</div>
                ) : history.length > 0 ? history.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-5 rounded-xl bg-card shadow-card border border-border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-card-foreground">{item.client}</p>
                        <p className="text-sm text-muted-foreground">{item.service}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </motion.div>
                )) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum pedido finalizado ainda</p>
                  </div>
                )
              ) : requestsQuery.isLoading ? (
                <div className="text-center py-16 text-muted-foreground">Carregando pedidos...</div>
              ) : requestsQuery.isError ? (
                <div className="text-center py-16 text-muted-foreground">Nao foi possivel carregar os pedidos.</div>
              ) : prioritizedRequests.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-semibold text-foreground">Em atendimento</h3>
                      <span className="text-xs text-muted-foreground">{activeRequests.length}</span>
                    </div>
                    {activeRequests.length > 0 ? (
                      <div className="space-y-3">
                        {activeRequests.map((req) => (
                          <motion.div
                            key={req.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-4 rounded-xl bg-accent/10 shadow-card border border-accent/40"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                  <Wrench className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                  <p className="font-semibold text-card-foreground">{req.client}</p>
                                  <p className="text-sm text-muted-foreground">{req.service}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-accent">{requestStatusLabel(req)}</p>
                                <p className="text-xs text-muted-foreground">{req.time}</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{req.desc}</p>
                            <p className="text-sm font-semibold text-card-foreground mb-3">Valor: {req.value ?? "A combinar"}</p>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="text-white hover:opacity-90"
                                style={{ backgroundColor: "#0e234e" }}
                                onClick={() => openFinishDialog(req.id)}
                              >
                                Finalizar atendimento
                              </Button>
                              <Link to={`/chat/${req.id}`}>
                                <Button variant="ghost" size="sm">
                                  <MessageCircle className="w-4 h-4" /> Abrir chat
                                </Button>
                              </Link>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground border border-dashed rounded-xl p-4">
                        Nenhum atendimento em andamento.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-semibold text-foreground">Próximos / Em negociação</h3>
                      <span className="text-xs text-muted-foreground">{upcomingRequests.length}</span>
                    </div>
                    {upcomingRequests.length > 0 ? upcomingRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="p-4 rounded-xl bg-card shadow-card border border-border"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Wrench className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                              <p className="font-semibold text-card-foreground">{req.client}</p>
                              <p className="text-sm text-muted-foreground">{req.service}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-accent">{requestStatusLabel(req)}</p>
                            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" /> {req.distance}
                            </div>
                            <p className="text-xs text-muted-foreground">{req.time}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{req.desc}</p>
                        <p className="text-sm font-semibold text-card-foreground mb-2">Valor: {req.value ?? "A combinar"}</p>
                        {requestPendingStep(req) && (
                          <p className="text-xs text-muted-foreground mb-3">{requestPendingStep(req)}</p>
                        )}
                        <div className="flex justify-end gap-2">
                          {req.status !== "accepted" ? (
                            <>
                              <Button
                                variant="hero"
                                size="sm"
                                onClick={() => handleAccept(req.id)}
                              >
                                <Check className="w-4 h-4" /> Aceitar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleReject(req.id)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {!req.providerConfirmed && (
                                <Button
                                  size="sm"
                                  className="text-white hover:opacity-90"
                                  style={{ backgroundColor: "#0e234e" }}
                                  onClick={() => handleConfirmService(req.id)}
                                  disabled={confirmServiceMutation.isPending}
                                >
                                  Confirmar serviço
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openCancelDialog(req.id)}>
                                Cancelar
                              </Button>
                            </>
                          )}
                          <Link to={`/chat/${req.id}`}>
                            <Button variant="ghost" size="sm">
                              <MessageCircle className="w-4 h-4" /> Abrir chat
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="text-sm text-muted-foreground border border-dashed rounded-xl p-4">
                        Nenhum pedido em negociação ou próximo no momento.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pedido no momento</p>
                  <p className="text-sm">Novos pedidos aparecerao aqui</p>
                </div>
              )}
            </AnimatePresence>
        </div>
      </div>
      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que este atendimento foi concluido?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFinish}
              disabled={completeMutation.isPending}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: "#0e234e" }}
            >
              {completeMutation.isPending ? "Finalizando..." : "Sim, finalizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo e confirme se realmente deseja cancelar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento"
            maxLength={280}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProviderDashboard;
