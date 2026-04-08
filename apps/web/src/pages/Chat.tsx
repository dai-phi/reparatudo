import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Wrench, Star, Phone, MapPin, DollarSign, Check, X, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  ChatMessage,
  cancelRequest,
  completeRequest,
  confirmRequest,
  getMessages,
  getRequest,
  reportIncident,
  sendMessage,
} from "@/lib/api";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { useWebsocket, type WebsocketEvent } from "@/lib/websocket";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

type UiStatus = "waiting_provider" | "negotiating" | "confirmed" | "cancelled" | "completed";

function formatServiceWithSubtype(service: string, subtypeLabel?: string | null) {
  return subtypeLabel ? `${service} — ${subtypeLabel}` : service;
}

const getUiStatus = (status?: string): UiStatus => {
  switch (status) {
    case "open":
      return "waiting_provider";
    case "accepted":
      return "negotiating";
    case "confirmed":
      return "confirmed";
    case "completed":
      return "completed";
    case "cancelled":
    case "rejected":
      return "cancelled";
    default:
      return "negotiating";
  }
};

const statusBanner = (status: UiStatus) => {
  switch (status) {
    case "waiting_provider":
      return {
        bg: "bg-yellow-500/10 border-yellow-500/30",
        text: "text-yellow-700 dark:text-yellow-400",
        icon: Clock,
        label: "Aguardando prestador",
      };
    case "confirmed":
      return { bg: "bg-success/10 border-success/30", text: "text-success", icon: Check, label: "Serviço confirmado" };
    case "cancelled":
      return { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", icon: X, label: "Serviço cancelado" };
    case "completed":
      return { bg: "bg-accent/10 border-accent/30", text: "text-accent", icon: Star, label: "Serviço finalizado" };
    default:
      return { bg: "bg-sky-500/10 border-sky-500/30", text: "text-sky-700 dark:text-sky-400", icon: DollarSign, label: "Negociando valor" };
  }
};

const Chat = () => {
  const { id } = useParams();
  const requestId = id ?? "";
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const role = me?.role ?? "client";
  const isClient = role === "client";

  const [input, setInput] = useState("");
  const [agreedValue, setAgreedValue] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<"fraude" | "conduta" | "cobranca" | "seguranca" | "outro">("outro");
  const [incidentDescription, setIncidentDescription] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const addMessageToCache = useCallback((message: ChatMessage) => {
    if (!requestId) return;
    queryClient.setQueryData(["messages", requestId], (old?: ChatMessage[]) => {
      if (!old) return [message];
      if (old.some((item) => item.id === message.id)) return old;
      return [...old, message];
    });
  }, [queryClient, requestId]);

  const requestQuery = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => getRequest(requestId),
    enabled: Boolean(requestId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5000,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", requestId],
    queryFn: () => getMessages(requestId),
    enabled: Boolean(requestId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Fallback when in-memory WS broadcast does not reach the other client (e.g. serverless multi-instance).
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessage(requestId, text),
    onSuccess: (message) => {
      addMessageToCache(message);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.chat.sendMessage;
      toast.error(message);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (value?: string) => confirmRequest(requestId, value),
    onSuccess: (data) => {
      queryClient.setQueryData(["request", requestId], data.request);
      queryClient.setQueryData(["messages", requestId], (old?: any[]) => {
        if (!old) return [data.message];
        return [...old, data.message];
      });
      toast.success(UI_MESSAGES.request.confirmedService);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.chat.confirmService;
      toast.error(message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(requestId),
    onSuccess: (data) => {
      queryClient.setQueryData(["request", requestId], data.request);
      queryClient.setQueryData(["messages", requestId], (old?: any[]) => {
        if (!old) return [data.message];
        return [...old, data.message];
      });
      toast.success(UI_MESSAGES.chat.serviceCancelled);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.chat.cancelService;
      toast.error(message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeRequest(requestId),
    onSuccess: (data) => {
      queryClient.setQueryData(["request", requestId], data.request);
      queryClient.setQueryData(["messages", requestId], (old?: any[]) => {
        if (!old) return [data.message];
        return [...old, data.message];
      });
      toast.success(UI_MESSAGES.chat.serviceCompleted);
      navigate("/provider/dashboard");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.chat.completeService;
      toast.error(message);
    },
  });

  const incidentMutation = useMutation({
    mutationFn: () =>
      reportIncident(requestId, {
        type: incidentType,
        description: incidentDescription.trim(),
      }),
    onSuccess: () => {
      toast.success(UI_MESSAGES.incident.submitted);
      setReportOpen(false);
      setIncidentDescription("");
      setIncidentType("outro");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.incident.submit;
      toast.error(message);
    },
  });

  const handleSocketEvent = useCallback(
    (event: WebsocketEvent) => {
      if (!requestId || event.requestId !== requestId) return;
      if (event.type === "chat.message" && event.payload) {
        addMessageToCache(event.payload);
      }
      if (event.type === "request.updated" && event.payload) {
        queryClient.setQueryData(["request", requestId], event.payload);
        if (event.payload.status === "completed") {
          if (isClient) {
            navigate("/client/home", { state: { openHistory: true, rateRequestId: requestId } });
          } else {
            navigate("/provider/dashboard");
          }
        }
      }
    },
    [addMessageToCache, queryClient, requestId, isClient, navigate]
  );

  useWebsocket({
    requestId,
    enabled: Boolean(requestId),
    onEvent: handleSocketEvent,
  });

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  useEffect(() => {
    const r = requestQuery.data;
    if (!r || isClient) return;
    if (r.agreedValue > 0) {
      setAgreedValue((prev) => (prev.trim() === "" ? r.agreedValueLabel : prev));
    }
  }, [requestQuery.data, isClient]);

  const sendMessageHandler = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  if (!requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Conversa nao encontrada.
      </div>
    );
  }

  if (requestQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando conversa...
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground gap-4">
        Não foi possível carregar o chat.
        <Button variant="hero" onClick={() => navigate(isClient ? "/client/home" : "/provider/dashboard")}>Voltar</Button>
      </div>
    );
  }

  const request = requestQuery.data;
  const messages = messagesQuery.data ?? [];
  const uiStatus = getUiStatus(request.status);
  const banner = statusBanner(uiStatus);
  const headerName = isClient ? request.provider?.name ?? "Aguardando prestador" : request.client?.name ?? "Cliente";
  const headerRating = isClient ? request.provider?.rating ?? 0 : 0;
  const headerDistance = isClient ? request.provider?.distanceKm ?? 0 : 0;
  const backPath = isClient ? "/client/home" : "/provider/dashboard";
  const clientConfirmed = Boolean(request.clientConfirmed);
  const providerConfirmed = Boolean(request.providerConfirmed);
  const canConfirm = uiStatus === "negotiating" && ((isClient && !clientConfirmed) || (!isClient && !providerConfirmed));
  const canComplete = !isClient && uiStatus === "confirmed";
  const canCancel = uiStatus === "negotiating" || uiStatus === "waiting_provider";
  const waitingOther = isClient ? clientConfirmed && !providerConfirmed : providerConfirmed && !clientConfirmed;
  const providerPhone = request.provider?.phone ?? "";
  const agreedValueText = request.agreedValue > 0 ? request.agreedValueLabel : "a combinar";
  const whatsappDigits = providerPhone.replace(/\D/g, "");
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits.startsWith("55") ? whatsappDigits : `55${whatsappDigits}`}`
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex items-center gap-4 h-16">
          <Link to={backPath} className="text-primary-foreground/70 hover:text-primary-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-primary-foreground">{headerName}</p>
              {isClient && request.provider ? (
                <div className="space-y-0.5">
                  <div className="text-xs text-primary-foreground/60">
                    {formatServiceWithSubtype(request.serviceLabel, request.serviceSubtypeLabel)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary-foreground/60">
                    <Star className="w-3 h-3 text-accent fill-accent" /> {headerRating.toFixed(1)}
                    <span>•</span>
                    <MapPin className="w-3 h-3" /> {headerDistance.toFixed(1)} km
                  </div>
                </div>
              ) : (
                <div className="text-xs text-primary-foreground/60">
                  {formatServiceWithSubtype(request.serviceLabel, request.serviceSubtypeLabel)}
                </div>
              )}
            </div>
          </div>
          {uiStatus === "confirmed" && isClient && whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="p-2 text-primary-foreground/70 hover:text-primary-foreground">
              <Phone className="w-5 h-5" />
            </a>
          ) : (
            <button className="p-2 text-primary-foreground/40" disabled>
              <Phone className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Status banner */}
      <div className={`border-b ${banner.bg} px-4 py-2.5`}>
        <div className="container flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex items-center gap-2">
              <banner.icon className={`w-4 h-4 shrink-0 ${banner.text}`} />
              <span className={`text-sm font-medium ${banner.text}`}>{banner.label}</span>
            </div>
            {(uiStatus === "negotiating" || uiStatus === "waiting_provider") && (
              <span className={`text-sm ${banner.text} opacity-90`}>
                <span className="text-muted-foreground font-normal">· Valor combinado:</span>{" "}
                <span className="font-medium">{agreedValueText}</span>
              </span>
            )}
          </div>
          {uiStatus !== "negotiating" && uiStatus !== "waiting_provider" && request.agreedValue > 0 && (
            <span className="text-xs text-muted-foreground">Valor: {request.agreedValueLabel}</span>
          )}
        </div>
        <div className="container mt-2">
          <Button variant="outline" size="sm" onClick={() => setReportOpen((v) => !v)}>
            <AlertTriangle className="w-4 h-4" /> Reportar problema
          </Button>
        </div>
        {reportOpen && (
          <div className="container mt-3 rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "fraude", label: "Fraude" },
                { id: "conduta", label: "Conduta" },
                { id: "cobranca", label: "Cobrança" },
                { id: "seguranca", label: "Segurança" },
                { id: "outro", label: "Outro" },
              ].map((type) => (
                <Button
                  key={type.id}
                  type="button"
                  size="sm"
                  variant={incidentType === type.id ? "hero" : "outline"}
                  onClick={() => setIncidentType(type.id as typeof incidentType)}
                >
                  {type.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Descreva o problema (mínimo 10 caracteres)"
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="hero"
                onClick={() => incidentMutation.mutate()}
                disabled={incidentMutation.isPending || incidentDescription.trim().length < 10}
              >
                Enviar reporte
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReportOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messagesQuery.isLoading ? (
          <div className="text-center text-muted-foreground">Carregando mensagens...</div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.from === "system";
            const isOwn = msg.from === role;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isSystem ? "justify-center" : isOwn ? "justify-end" : "justify-start"}`}
              >
                {isSystem ? (
                  <div className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm text-center max-w-[85%]">
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                      isOwn
                        ? "bg-accent text-accent-foreground rounded-br-md"
                        : "bg-card text-card-foreground border border-border rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${isOwn ? "text-accent-foreground/60" : "text-muted-foreground"}`}>
                      {msg.time}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEnd} />
      </div>

      {(uiStatus === "waiting_provider" || uiStatus === "negotiating" || uiStatus === "confirmed") && (
        <div className="bg-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="container space-y-3">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Digite sua mensagem…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessageHandler();
                  }
                }}
                rows={2}
                className="min-h-[52px] max-h-[140px] resize-none py-3 flex-1"
              />
              <Button
                variant="hero"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={sendMessageHandler}
                disabled={!input.trim() || sendMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Enter envia · Shift+Enter nova linha</p>

            {canConfirm && (
              <>
                {!isClient ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border/60">
                    <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Seu valor proposto (ex: R$ 150,00)"
                      value={agreedValue}
                      onChange={(e) => setAgreedValue(e.target.value)}
                      className="border-0 bg-transparent h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/80 border border-border/60 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>
                      Valor proposto pelo prestador: <span className="font-medium text-foreground">{agreedValueText}</span>
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="hero"
                    size="sm"
                    className="flex-1"
                    onClick={() => confirmMutation.mutate(!isClient ? agreedValue : undefined)}
                    disabled={confirmMutation.isPending}
                  >
                    <Check className="w-4 h-4" /> {isClient ? "Aceitar serviço" : "Confirmar Serviço"}
                  </Button>
                  {canCancel && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                      <X className="w-4 h-4" /> Cancelar
                    </Button>
                  )}
                </div>
              </>
            )}

            {waitingOther && (
              <div className="text-sm text-muted-foreground">Aguardando confirmação da outra parte.</div>
            )}

            {canComplete && (
              <div className="flex gap-2">
                <Button variant="hero" size="sm" className="flex-1" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                  <Check className="w-4 h-4" /> Finalizar Serviço
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {(uiStatus === "cancelled" || uiStatus === "completed") && (
        <div className="bg-card border-t border-border p-4">
          <div className="container text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {uiStatus === "completed"
                ? "Serviço finalizado. Esta conversa e apenas para consulta."
                : "Serviço cancelado. Apenas visualização."}
            </p>
            <Button variant="hero" size="sm" onClick={() => navigate(backPath)}>
              Voltar ao Inicio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
