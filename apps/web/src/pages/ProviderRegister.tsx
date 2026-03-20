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
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    radius: "10",
    workAddress: "",
    workComplement: "",
    workNeighborhood: "",
    workCity: "",
    workState: "",
    workCep: "",
    password: "",
    passwordConfirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.password.length > 0 && form.password.length < 6) {
      e.password = "Senha deve ter no mínimo 6 caracteres";
    }
    if (form.passwordConfirm && form.password !== form.passwordConfirm) {
      e.passwordConfirm = "As senhas não conferem";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
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
        workAddress: form.workAddress.trim(),
        workComplement: form.workComplement.trim() || undefined,
        workNeighborhood: form.workNeighborhood.trim() || undefined,
        workCity: form.workCity.trim() || undefined,
        workState: form.workState.trim() || undefined,
        workCep: workCepNumeric,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
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

      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <motion.div
          className="w-full max-w-md py-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {step === 1 ? "Dados Pessoais" : "Serviços Oferecidos"}
          </h1>
          <p className="text-muted-foreground mb-6">Passo {step} de 2</p>

          <div className="flex gap-2 mb-6">
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

              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Endereço do local de trabalho</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="workAddress">Endereço completo *</Label>
                    <Input id="workAddress" placeholder="Rua, número" value={form.workAddress} onChange={(e) => setForm({ ...form, workAddress: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="workComplement">Complemento</Label>
                    <Input id="workComplement" placeholder="Sala, andar..." value={form.workComplement} onChange={(e) => setForm({ ...form, workComplement: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="workNeighborhood">Bairro</Label>
                    <Input id="workNeighborhood" placeholder="Bairro" value={form.workNeighborhood} onChange={(e) => setForm({ ...form, workNeighborhood: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="workCity">Cidade</Label>
                      <Input id="workCity" placeholder="Cidade" value={form.workCity} onChange={(e) => setForm({ ...form, workCity: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="workState">Estado</Label>
                      <Input id="workState" placeholder="UF" value={form.workState} onChange={(e) => setForm({ ...form, workState: e.target.value })} maxLength={2} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="workCep">CEP</Label>
                    <Input id="workCep" placeholder="00000-000" value={form.workCep} onChange={(e) => setForm({ ...form, workCep: e.target.value })} required />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <div>
                <Label htmlFor="passwordConfirm">Confirmar senha</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  placeholder="Repita a senha"
                  value={form.passwordConfirm}
                  onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                  required
                />
                {errors.passwordConfirm && <p className="text-xs text-destructive mt-1">{errors.passwordConfirm}</p>}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setStep(2)}
                disabled={!form.name || !form.email || !form.password || !form.passwordConfirm || !form.workAddress || !form.workCep || form.password !== form.passwordConfirm}
              >
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
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          selected ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
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
