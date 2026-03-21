import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Wrench, Star, ClipboardList, DollarSign, Clock, MapPin, Bell,
  User, LogOut, Check, X, MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, RequestSummary, acceptRequest, getProviderRequests, getProviderStats, logout, rejectRequest } from "@/lib/api";
import { useWebsocket, type WebsocketEvent } from "@/lib/websocket";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [hasNewRequest, setHasNewRequest] = useState(false);

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

  const handleAccept = (id: string) => {
    setHasNewRequest(false);
    acceptMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    setHasNewRequest(false);
    rejectMutation.mutate(id);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const requests = requestsQuery.data ?? [];
  const stats = statsQuery.data;
  const statsCards = [
    { icon: ClipboardList, label: "Pedidos Atendidos", value: String(stats?.attendedCount ?? 0), color: "text-accent" },
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
              className="p-5 rounded-xl bg-card shadow-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mb-2`} />
              <p className="font-display text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">Pedidos Próximos</h2>
            <AnimatePresence>
              {requestsQuery.isLoading ? (
                <div className="text-center py-16 text-muted-foreground">Carregando pedidos...</div>
              ) : requestsQuery.isError ? (
                <div className="text-center py-16 text-muted-foreground">Nao foi possivel carregar os pedidos.</div>
              ) : requests.length > 0 ? requests.map((req) => (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-5 rounded-xl bg-card shadow-card border border-border"
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
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {req.distance}
                      </div>
                      <p className="text-xs text-muted-foreground">{req.time}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{req.desc}</p>
                  <div className="flex gap-3">
                    <Button
                      variant="hero"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAccept(req.id)}
                      disabled={req.status === "accepted"}
                    >
                      <Check className="w-4 h-4" /> Aceitar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReject(req.id)} disabled={req.status === "accepted"}>
                      <X className="w-4 h-4" />
                    </Button>
                    {req.status === "accepted" && (
                      <Link to={`/chat/${req.id}`}>
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pedido no momento</p>
                  <p className="text-sm">Novos pedidos aparecerao aqui</p>
                </div>
              )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
