import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, User, Wrench, Star, Phone, MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface Message {
  id: number;
  from: "client" | "provider";
  text: string;
  time: string;
}

const initialMessages: Message[] = [
  { id: 1, from: "provider", text: "Olá! Aceite seu pedido. Estou a caminho!", time: "14:30" },
  { id: 2, from: "client", text: "Ótimo! Quanto tempo demora?", time: "14:31" },
  { id: 3, from: "provider", text: "Chego aí em uns 15 minutos. Pode me descrever melhor o problema?", time: "14:32" },
];

const Chat = () => {
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "client", text: input, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setInput("");
  };

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}
          >
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
          </motion.div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-card border-t border-border p-4">
        <div className="container flex gap-3">
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
  );
};

export default Chat;
