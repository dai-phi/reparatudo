import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Wrench, Zap, Droplets, PaintBucket, Hammer, MapPin, User, Bell,
  Search, ArrowRight, Loader2, ClipboardList, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const services = [
  { id: "eletrica", icon: Zap, label: "Elétrica", desc: "Tomadas, fiação, disjuntores", color: "from-yellow-400 to-amber-500" },
  { id: "hidraulica", icon: Droplets, label: "Hidráulica", desc: "Vazamentos, encanamento", color: "from-blue-400 to-cyan-500" },
  { id: "pintura", icon: PaintBucket, label: "Pintura", desc: "Paredes, tetos, fachadas", color: "from-pink-400 to-rose-500" },
  { id: "montagem", icon: Hammer, label: "Montagem", desc: "Móveis, prateleiras", color: "from-orange-400 to-red-500" },
  { id: "reparos", icon: Wrench, label: "Reparos Gerais", desc: "Diversos serviços", color: "from-emerald-400 to-green-500" },
];

const mockCompletedServices = [
  { id: 1, provider: "Carlos Mendes", service: "Elétrica", desc: "Troca de tomada na cozinha", date: "28/02/2026", value: "R$ 120,00", rated: false, rating: 0, review: "" },
  { id: 2, provider: "João Pereira", service: "Hidráulica", desc: "Conserto de vazamento no banheiro", date: "20/02/2026", value: "R$ 250,00", rated: true, rating: 5, review: "Excelente profissional!" },
  { id: 3, provider: "Roberto Lima", service: "Pintura", desc: "Pintura da sala de estar", date: "10/02/2026", value: "R$ 800,00", rated: true, rating: 4, review: "Bom trabalho, pontual." },
];

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

const ClientHome = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"request" | "history">("request");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [searching, setSearching] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [completedServices, setCompletedServices] = useState(mockCompletedServices);
  const [ratingServiceId, setRatingServiceId] = useState<number | null>(null);
  const [tempRating, setTempRating] = useState(0);
  const [tempReview, setTempReview] = useState("");

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { setLocationGranted(true); toast.success("Localização obtida!"); },
        () => toast.error("Não foi possível obter localização")
      );
    }
  };

  const handleRequest = () => {
    if (!selectedService) { toast.error("Selecione um serviço"); return; }
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      toast.success("Profissional encontrado! Abrindo chat...");
      navigate("/chat/1");
    }, 3000);
  };

  const submitRating = (id: number) => {
    if (tempRating === 0) { toast.error("Selecione uma nota"); return; }
    setCompletedServices((prev) =>
      prev.map((s) => s.id === id ? { ...s, rated: true, rating: tempRating, review: tempReview } : s)
    );
    setRatingServiceId(null);
    setTempRating(0);
    setTempReview("");
    toast.success("Avaliação enviada! Obrigado.");
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
            <span className="font-display text-lg font-bold text-foreground">FixJá</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-8 w-fit">
          {[
            { key: "request" as const, label: "Novo Serviço", icon: Search },
            { key: "history" as const, label: "Serviços Realizados", icon: ClipboardList },
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

        {activeTab === "request" ? (
          <>
            {/* Location */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              {!locationGranted ? (
                <div className="p-5 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-accent" />
                    <div>
                      <p className="font-semibold text-foreground">Ative sua localização</p>
                      <p className="text-sm text-muted-foreground">Para encontrar profissionais perto de você</p>
                    </div>
                  </div>
                  <Button variant="hero" size="sm" onClick={requestLocation}>Ativar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-success">
                  <MapPin className="w-5 h-5" />
                  <span className="text-sm font-medium">Localização ativa • São Paulo, SP</span>
                </div>
              )}
            </motion.div>

            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">O que você precisa?</h1>
              <p className="text-muted-foreground">Selecione o tipo de serviço</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {services.map((service) => {
                const selected = selectedService === service.id;
                return (
                  <motion.button
                    key={service.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedService(service.id)}
                    className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all text-center ${
                      selected
                        ? "border-accent bg-accent/5 shadow-elevated"
                        : "border-border bg-card hover:border-accent/30 shadow-card"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                      <service.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-card-foreground">{service.label}</p>
                      <p className="text-xs text-muted-foreground">{service.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedService && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-8">
                  <Label className="mb-2 block">Descreva o problema (opcional)</Label>
                  <Textarea placeholder="Ex: A tomada da cozinha parou de funcionar..." value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={3} />
                </motion.div>
              )}
            </AnimatePresence>

            <Button variant="hero" size="xl" className="w-full animate-pulse-glow" onClick={handleRequest} disabled={!selectedService || !locationGranted || searching}>
              {searching ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Buscando profissionais...</>
              ) : (
                <><Search className="w-5 h-5" /> Chamar Marido de Aluguel <ArrowRight className="w-5 h-5" /></>
              )}
            </Button>
          </>
        ) : (
          /* History / Completed Services */
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-foreground">Serviços Realizados</h2>
            {completedServices.map((svc) => (
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
                  <div className="flex items-center gap-3">
                    <StarRating rating={svc.rating} interactive={false} />
                    {svc.review && <p className="text-sm text-muted-foreground italic">"{svc.review}"</p>}
                  </div>
                ) : ratingServiceId === svc.id ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-2 border-t border-border">
                    <div>
                      <Label className="mb-2 block text-sm">Sua nota</Label>
                      <StarRating rating={tempRating} onRate={setTempRating} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm">Comentário (opcional)</Label>
                      <Textarea placeholder="Como foi a experiência?" value={tempReview} onChange={(e) => setTempReview(e.target.value)} rows={2} className="resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="hero" size="sm" onClick={() => submitRating(svc.id)}>Enviar Avaliação</Button>
                      <Button variant="outline" size="sm" onClick={() => { setRatingServiceId(null); setTempRating(0); setTempReview(""); }}>Cancelar</Button>
                    </div>
                  </motion.div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setRatingServiceId(svc.id)}>
                    <Star className="w-4 h-4" /> Avaliar Prestador
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientHome;
