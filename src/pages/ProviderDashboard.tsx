import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wrench, Star, ClipboardList, DollarSign, Clock, MapPin, Bell,
  User, Settings, LogOut, Check, X, MessageCircle, Zap, Droplets
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const mockRequests = [
  { id: 1, client: "Maria Silva", service: "Elétrica", icon: Zap, desc: "Troca de tomada na cozinha", distance: "2.3 km", time: "Agora" },
  { id: 2, client: "João Santos", service: "Hidráulica", icon: Droplets, desc: "Vazamento no banheiro", distance: "4.1 km", time: "5 min atrás" },
];

const ProviderDashboard = () => {
  const [activeTab, setActiveTab] = useState<"requests" | "profile">("requests");
  const [requests, setRequests] = useState(mockRequests);

  const handleAccept = (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Pedido aceito! Chat aberto com o cliente.");
  };

  const handleReject = (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast("Pedido recusado");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-primary-foreground">FixJá</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-primary-foreground/70 hover:text-primary-foreground">
              <Bell className="w-5 h-5" />
              {requests.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">Olá, Carlos! 👋</h1>
          <p className="text-muted-foreground">Veja suas métricas e pedidos do dia</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: ClipboardList, label: "Pedidos Atendidos", value: "147", color: "text-accent" },
            { icon: Star, label: "Avaliação", value: "4.9", color: "text-warning" },
            { icon: DollarSign, label: "Ganhos do Mês", value: "R$ 4.230", color: "text-success" },
            { icon: Clock, label: "Tempo Médio", value: "35 min", color: "text-accent" },
          ].map((stat) => (
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

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 w-fit">
          {[
            { key: "requests" as const, label: "Pedidos", icon: ClipboardList },
            { key: "profile" as const, label: "Meu Perfil", icon: User },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "requests" ? (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">Pedidos Próximos</h2>
            <AnimatePresence>
              {requests.length > 0 ? requests.map((req) => (
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
                        <req.icon className="w-5 h-5 text-accent" />
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
                    <Button variant="hero" size="sm" className="flex-1" onClick={() => handleAccept(req.id)}>
                      <Check className="w-4 h-4" /> Aceitar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReject(req.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Link to="/chat/1">
                      <Button variant="ghost" size="sm">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pedido no momento</p>
                  <p className="text-sm">Novos pedidos aparecerão aqui</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="max-w-md space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">Editar Perfil</h2>
            <div className="p-6 rounded-xl bg-card shadow-card space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <p className="font-bold text-card-foreground">Carlos Mendes</p>
                  <p className="text-sm text-muted-foreground">carlos@email.com</p>
                </div>
              </div>
              <div>
                <Label>Nome</Label>
                <Input defaultValue="Carlos Mendes" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input defaultValue="(11) 98765-4321" />
              </div>
              <div>
                <Label>Raio de atuação (km)</Label>
                <Input type="number" defaultValue="10" />
              </div>
              <Button variant="hero" className="w-full" onClick={() => toast.success("Perfil atualizado!")}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderDashboard;
