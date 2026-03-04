import { useState, useRef, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, User, Wrench, Star, Phone, MapPin, DollarSign, Check, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Message {
  id: number;
  from: "client" | "provider" | "system";
  text: string;
  time: string;
}

type ServiceStatus = "negotiating" | "confirmed" | "cancelled" | "completed";

const initialMessages: Message[] = [
  { id: 1, from: "provider", text: "Olá! Aceite seu pedido. Vamos negociar o valor do serviço?", time: "14:30" },
  { id: 2, from: "client", text: "Ótimo! Qual seria o valor?", time: "14:31" },
  { id: 3, from: "provider", text: "Pelo que você descreveu, ficaria em torno de R$ 150,00. Pode ser?", time: "14:32" },
];

const Chat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ServiceStatus>("negotiating");
  const [agreedValue, setAgreedValue] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: Date.now(), from: "system", text, time: now() }]);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now(), from: "client", text: input, time: now() }]);
    setInput("");
  };

  const handleConfirmService = () => {
    setStatus("confirmed");
    addSystemMessage(`✅ Serviço confirmado! Valor acordado: ${agreedValue || "a combinar"}. O prestador está a caminho.`);
    toast.success("Serviço confirmado! O prestador está a caminho.");
  };

  const handleCancelService = () => {
    setStatus("cancelled");
    addSystemMessage("❌ Serviço cancelado pelo cliente.");
    toast("Serviço cancelado");
  };

  const handleCompleteService = () => {
    setStatus("completed");
    addSystemMessage("🎉 Serviço finalizado! Obrigado por usar o FixJá.");
    toast.success("Serviço finalizado!");
  };

  const statusBanner = () => {
    switch (status) {
      case "negotiating":
        return { bg: "bg-warning/10 border-warning/30", text: "text-warning", icon: DollarSign, label: "Negociando valor" };
      case "confirmed":
        return { bg: "bg-success/10 border-success/30", text: "text-success", icon: Check, label: "Serviço confirmado" };
      case "cancelled":
        return { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", icon: X, label: "Serviço cancelado" };
      case "completed":
        return { bg: "bg-accent/10 border-accent/30", text: "text-accent", icon: Star, label: "Serviço finalizado" };
    }
  };

  const banner = statusBanner();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex items-center gap-4 h-16">
          <Link to="/client/home" className="text-primary-foreground/70 hover:text-primary-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-primary-foreground">Carlos Mendes</p>
              <div className="flex items-center gap-2 text-xs text-primary-foreground/60">
                <Star className="w-3 h-3 text-accent fill-accent" /> 4.9
                <span>•</span>
                <MapPin className="w-3 h-3" /> 2.3 km
              </div>
            </div>
          </div>
          <button className="p-2 text-primary-foreground/70 hover:text-primary-foreground">
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Status banner */}
      <div className={`border-b ${banner.bg} px-4 py-2.5`}>
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <banner.icon className={`w-4 h-4 ${banner.text}`} />
            <span className={`text-sm font-medium ${banner.text}`}>{banner.label}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.from === "client" ? "justify-end" : msg.from === "system" ? "justify-center" : "justify-start"}`}
          >
            {msg.from === "system" ? (
              <div className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm text-center max-w-[85%]">
                {msg.text}
              </div>
            ) : (
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  msg.from === "client"
                    ? "bg-accent text-accent-foreground rounded-br-md"
                    : "bg-card text-card-foreground border border-border rounded-bl-md"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${msg.from === "client" ? "text-accent-foreground/60" : "text-muted-foreground"}`}>
                  {msg.time}
                </p>
              </div>
            )}
          </motion.div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Action bar based on status */}
      {status === "negotiating" && (
        <div className="bg-card border-t border-border p-4">
          <div className="container space-y-3">
            {/* Value input */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Valor acordado (ex: R$ 150,00)"
                value={agreedValue}
                onChange={(e) => setAgreedValue(e.target.value)}
                className="border-0 bg-transparent h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="hero" size="sm" className="flex-1" onClick={handleConfirmService}>
                <Check className="w-4 h-4" /> Confirmar Serviço
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCancelService}>
                <X className="w-4 h-4" /> Cancelar
              </Button>
            </div>
            {/* Chat input */}
            <div className="flex gap-3">
              <Input
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1"
              />
              <Button variant="hero" size="icon" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {status === "confirmed" && (
        <div className="bg-card border-t border-border p-4">
          <div className="container space-y-3">
            <div className="flex gap-2">
              <Button variant="hero" size="sm" className="flex-1" onClick={handleCompleteService}>
                <Check className="w-4 h-4" /> Finalizar Serviço
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCancelService}>
                <X className="w-4 h-4" /> Cancelar Serviço
              </Button>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1"
              />
              <Button variant="hero" size="icon" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {(status === "cancelled" || status === "completed") && (
        <div className="bg-card border-t border-border p-4">
          <div className="container text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {status === "completed" ? "Serviço finalizado! Avalie o prestador na aba de histórico." : "Serviço cancelado."}
            </p>
            <Button variant="hero" size="sm" onClick={() => navigate("/client/home")}>
              Voltar ao Início
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
