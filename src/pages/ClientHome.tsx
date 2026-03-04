import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Wrench, Zap, Droplets, PaintBucket, Hammer, MapPin, User, Bell,
  Search, ArrowRight, Loader2
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

const ClientHome = () => {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [searching, setSearching] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationGranted(true);
          toast.success("Localização obtida!");
        },
        () => toast.error("Não foi possível obter localização")
      );
    }
  };

  const handleRequest = () => {
    if (!selectedService) {
      toast.error("Selecione um serviço");
      return;
    }
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      toast.success("Profissional encontrado! Abrindo chat...");
      navigate("/chat/1");
    }, 3000);
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
        {/* Location */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {!locationGranted ? (
            <div className="p-5 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-accent" />
                <div>
                  <p className="font-semibold text-foreground">Ative sua localização</p>
                  <p className="text-sm text-muted-foreground">Para encontrar profissionais perto de você</p>
                </div>
              </div>
              <Button variant="hero" size="sm" onClick={requestLocation}>
                Ativar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-success">
              <MapPin className="w-5 h-5" />
              <span className="text-sm font-medium">Localização ativa • São Paulo, SP</span>
            </div>
          )}
        </motion.div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">O que você precisa?</h1>
          <p className="text-muted-foreground">Selecione o tipo de serviço</p>
        </div>

        {/* Service selection */}
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

        {/* Description */}
        <AnimatePresence>
          {selectedService && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <Label className="mb-2 block">Descreva o problema (opcional)</Label>
              <Textarea
                placeholder="Ex: A tomada da cozinha parou de funcionar..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <Button
          variant="hero"
          size="xl"
          className="w-full animate-pulse-glow"
          onClick={handleRequest}
          disabled={!selectedService || !locationGranted || searching}
        >
          {searching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Buscando profissionais...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Chamar Marido de Aluguel
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ClientHome;
