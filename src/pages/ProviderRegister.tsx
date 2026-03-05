import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Zap, Droplets, PaintBucket, Hammer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, registerProvider, setAuth } from "@/lib/api";

const serviceOptions = [
  { id: "eletrica", icon: Zap, label: "Elétrica" },
  { id: "hidraulica", icon: Droplets, label: "Hidráulica" },
  { id: "pintura", icon: PaintBucket, label: "Pintura" },
  { id: "montagem", icon: Hammer, label: "Montagem" },
  { id: "reparos", icon: Wrench, label: "Reparos Gerais" },
];

const ProviderRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf: "", radius: "10", password: "", workCep: "", photoUrl: "" });
  const [loading, setLoading] = useState(false);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    const workCepNumeric = form.workCep.replace(/\D/g, "");
    setLoading(true);
    try {
      const auth = await registerProvider({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        cpf: form.cpf.trim() || undefined,
        radiusKm: Number(form.radius) || 10,
        services: selectedServices,
        workCep: workCepNumeric,
        photoUrl: form.photoUrl.trim() || undefined,
        password: form.password,
      });
      setAuth(auth);
      toast.success("Cadastro realizado com sucesso!");
      navigate("/provider/dashboard");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Não foi possível concluir o cadastro";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-hero relative items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-primary-foreground">FixJá</span>
          </div>
          <h2 className="font-display text-4xl font-bold text-primary-foreground mb-4">
            Ganhe dinheiro com suas habilidades
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Cadastre-se como profissional, receba pedidos de clientes próximos e trabalhe no seu ritmo.
          </p>
          <div className="mt-12 space-y-4">
            {["Receba pedidos na sua região", "Defina seu raio de atuação", "Chat direto com o cliente"].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {step === 1 ? "Dados Pessoais" : "Serviços Oferecidos"}
          </h1>
          <p className="text-muted-foreground mb-8">Passo {step} de 2</p>

          {/* Progress */}
          <div className="flex gap-2 mb-8">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-accent" : "bg-muted"}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-accent" : "bg-muted"}`} />
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="workCep">CEP do local de trabalho</Label>
                <Input id="workCep" placeholder="00000-000" value={form.workCep} onChange={(e) => setForm({ ...form, workCep: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="photoUrl">Foto (URL)</Label>
                <Input id="photoUrl" placeholder="https://..." value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" placeholder="Crie uma senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(2)} disabled={!form.name || !form.email || !form.password || !form.workCep}>
                Continuar
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">Selecione seus serviços</Label>
                <div className="grid grid-cols-2 gap-3">
                  {serviceOptions.map((service) => {
                    const selected = selectedServices.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <service.icon className={`w-5 h-5 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                          {service.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="radius">Raio de atuação (km)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="1"
                  max="50"
                  value={form.radius}
                  onChange={(e) => setForm({ ...form, radius: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" size="lg" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button variant="hero" className="flex-1" size="lg" onClick={handleSubmit} disabled={selectedServices.length === 0 || loading}>
                  Cadastrar
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProviderRegister;
