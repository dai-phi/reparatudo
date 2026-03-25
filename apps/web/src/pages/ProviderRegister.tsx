import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, Zap, Droplets, PaintBucket, Hammer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, registerProvider, setAuth } from "@/lib/api";
import { BR_STATES } from "@/lib/brazil-states";
import { fetchMunicipiosByUf, matchMunicipioName } from "@/lib/ibge-municipios";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { fetchViaCep } from "@/lib/viacep";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const serviceOptions = [
  { id: "eletrica", icon: Zap, label: "Elétrica" },
  { id: "hidraulica", icon: Droplets, label: "Hidráulica" },
  { id: "pintura", icon: PaintBucket, label: "Pintura" },
  { id: "montagem", icon: Hammer, label: "Montagem" },
  { id: "reparos", icon: Wrench, label: "Reparos Gerais" },
];

function formatCepInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

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
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!form.workState) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    fetchMunicipiosByUf(form.workState)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .catch(() => {
        if (!cancelled) {
          setCities([]);
          toast.error("Não foi possível carregar as cidades deste estado.");
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.workState]);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const validatePasswords = () => {
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

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!hasFullName(form.name)) e.name = "Informe nome completo (nome e sobrenome)";
    if (!isValidBrazilPhone(form.phone)) e.phone = "Telefone inválido: use DDD + número (10 ou 11 dígitos)";
    if (!form.workState) e.workState = "Selecione o estado";
    if (!form.workCity) e.workCity = "Selecione a cidade";
    const cepDigits = form.workCep.replace(/\D/g, "");
    if (cepDigits.length !== 8) e.workCep = "CEP deve ter 8 dígitos";
    if (!form.workAddress.trim()) e.workAddress = "Endereço obrigatório";
    if (form.password.length > 0 && form.password.length < 6) e.password = "Senha deve ter no mínimo 6 caracteres";
    if (form.passwordConfirm && form.password !== form.passwordConfirm) e.passwordConfirm = "As senhas não conferem";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const lookupWorkCep = async () => {
    const cepDigits = form.workCep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      setErrors((prev) => ({ ...prev, workCep: "CEP deve ter 8 dígitos" }));
      return;
    }
    setCepLoading(true);
    try {
      const data = await fetchViaCep(cepDigits);
      if (!data) {
        setErrors((prev) => ({ ...prev, workCep: "CEP não encontrado" }));
        return;
      }
      const munList = await fetchMunicipiosByUf(data.uf);
      const cityValue = matchMunicipioName(munList, data.localidade) ?? data.localidade;
      setCities(munList);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.workCep;
        return next;
      });
      setForm((f) => ({
        ...f,
        workState: data.uf,
        workCity: cityValue,
        workAddress: data.logradouro ? data.logradouro : f.workAddress,
        workNeighborhood: data.bairro ? data.bairro : f.workNeighborhood,
      }));
      toast.success("Endereço encontrado pelo CEP");
    } catch {
      setErrors((prev) => ({ ...prev, workCep: "Não foi possível buscar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const goStep2 = () => {
    if (!validateStep1()) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!validatePasswords()) return;
    if (!hasFullName(form.name) || !isValidBrazilPhone(form.phone) || !form.workState || !form.workCity) {
      toast.error("Revise seus dados no passo anterior.");
      setStep(1);
      return;
    }
    const workCepNumeric = form.workCep.replace(/\D/g, "");
    const via = await fetchViaCep(workCepNumeric);
    if (!via) {
      toast.error("CEP não encontrado. Verifique no passo anterior.");
      setStep(1);
      return;
    }
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
        workCity: form.workCity.trim(),
        workState: form.workState,
        workCep: workCepNumeric,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      });
      setAuth(auth);
      toast.success(UI_MESSAGES.auth.providerRegisterSuccess);
      navigate("/provider/dashboard");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.auth.register;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const step1Ok =
    form.name &&
    hasFullName(form.name) &&
    form.email &&
    form.phone &&
    isValidBrazilPhone(form.phone) &&
    form.workAddress.trim() &&
    form.workState &&
    form.workCity &&
    form.workCep.replace(/\D/g, "").length === 8 &&
    form.password &&
    form.password.length >= 6 &&
    form.passwordConfirm &&
    form.password === form.passwordConfirm;

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-hero relative items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-primary-foreground">Repara Tudo!</span>
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
                <Input id="name" placeholder="Ex.: Luis Silva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="cpf">CPF (opcional)</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Endereço do local de trabalho</p>
                <div className="space-y-3">
                  <div>
                    <Label>Estado</Label>
                    <Select
                      value={form.workState || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, workState: v, workCity: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {BR_STATES.map((s) => (
                          <SelectItem key={s.uf} value={s.uf}>
                            {s.name} ({s.uf})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.workState && <p className="text-xs text-destructive mt-1">{errors.workState}</p>}
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Select
                      value={form.workCity || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, workCity: v }))}
                      disabled={!form.workState || citiesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            form.workState ? (citiesLoading ? "Carregando…" : "Selecione a cidade") : "Selecione o estado primeiro"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {cities.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.workCity && <p className="text-xs text-destructive mt-1">{errors.workCity}</p>}
                  </div>
                  <div>
                    <Label htmlFor="workCep">CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="workCep"
                        placeholder="00000-000"
                        value={form.workCep}
                        onChange={(e) => setForm({ ...form, workCep: formatCepInput(e.target.value) })}
                        onBlur={() => {
                          if (form.workCep.replace(/\D/g, "").length === 8) void lookupWorkCep();
                        }}
                      />
                      <Button type="button" variant="outline" disabled={cepLoading} onClick={() => void lookupWorkCep()}>
                        {cepLoading ? "…" : "Buscar"}
                      </Button>
                    </div>
                    {errors.workCep && <p className="text-xs text-destructive mt-1">{errors.workCep}</p>}
                  </div>
                  <div>
                    <Label htmlFor="workAddress">Rua e número *</Label>
                    <Input
                      id="workAddress"
                      placeholder="Rua, número"
                      value={form.workAddress}
                      onChange={(e) => setForm({ ...form, workAddress: e.target.value })}
                    />
                    {errors.workAddress && <p className="text-xs text-destructive mt-1">{errors.workAddress}</p>}
                  </div>
                  <div>
                    <Label htmlFor="workComplement">Complemento (opcional)</Label>
                    <Input id="workComplement" placeholder="Sala, andar..." value={form.workComplement} onChange={(e) => setForm({ ...form, workComplement: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="workNeighborhood">Bairro</Label>
                    <Input id="workNeighborhood" placeholder="Bairro" value={form.workNeighborhood} onChange={(e) => setForm({ ...form, workNeighborhood: e.target.value })} />
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

              <Button className="w-full" size="lg" onClick={goStep2} disabled={!step1Ok}>
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
                <Button variant="hero" className="flex-1" size="lg" onClick={() => void handleSubmit()} disabled={selectedServices.length === 0 || loading}>
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
