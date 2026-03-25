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
import { Wrench, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, registerClient, setAuth } from "@/lib/api";
import { BR_STATES } from "@/lib/brazil-states";
import { fetchMunicipiosByUf, matchMunicipioName } from "@/lib/ibge-municipios";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { fetchViaCep } from "@/lib/viacep";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

function formatCepInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const ClientRegister = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    password: "",
    passwordConfirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!form.state) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    fetchMunicipiosByUf(form.state)
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
  }, [form.state]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!hasFullName(form.name)) {
      e.name = "Informe nome completo (nome e sobrenome)";
    }
    if (!isValidBrazilPhone(form.phone)) {
      e.phone = "Telefone inválido: use DDD + número (10 ou 11 dígitos)";
    }
    if (!form.state) e.state = "Selecione o estado";
    if (!form.city) e.city = "Selecione a cidade";
    const cepDigits = form.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      e.cep = "CEP deve ter 8 dígitos";
    }
    if (form.password.length > 0 && form.password.length < 6) {
      e.password = "Senha deve ter no mínimo 6 caracteres";
    }
    if (form.passwordConfirm && form.password !== form.passwordConfirm) {
      e.passwordConfirm = "As senhas não conferem";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const lookupCep = async () => {
    const cepDigits = form.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      setErrors((prev) => ({ ...prev, cep: "CEP deve ter 8 dígitos" }));
      return;
    }
    setCepLoading(true);
    try {
      const data = await fetchViaCep(cepDigits);
      if (!data) {
        setErrors((prev) => ({ ...prev, cep: "CEP não encontrado" }));
        return;
      }
      const munList = await fetchMunicipiosByUf(data.uf);
      const cityValue = matchMunicipioName(munList, data.localidade) ?? data.localidade;
      setCities(munList);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.cep;
        return next;
      });
      setForm((f) => ({
        ...f,
        state: data.uf,
        city: cityValue,
        address: data.logradouro ? data.logradouro : f.address,
        neighborhood: data.bairro ? data.bairro : f.neighborhood,
      }));
      toast.success("Endereço encontrado pelo CEP");
    } catch {
      setErrors((prev) => ({ ...prev, cep: "Não foi possível buscar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const cepDigits = form.cep.replace(/\D/g, "");
    const via = await fetchViaCep(cepDigits);
    if (!via) {
      setErrors((prev) => ({ ...prev, cep: "CEP não encontrado" }));
      toast.error("Confira o CEP antes de continuar.");
      return;
    }
    setLoading(true);
    try {
      const auth = await registerClient({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        complement: form.complement.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim(),
        state: form.state,
        cep: cepDigits,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      });
      setAuth(auth);
      toast.success(UI_MESSAGES.auth.clientRegisterSuccess);
      navigate("/client/home");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.auth.register;
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
            <span className="font-display text-2xl font-bold text-primary-foreground">Repara Tudo!</span>
          </div>
          <h2 className="font-display text-4xl font-bold text-primary-foreground mb-4">
            Resolva qualquer problema da sua casa
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Profissionais verificados e avaliados prontos para atender você em minutos.
          </p>
          <div className="mt-12 space-y-4">
            {["Profissionais perto de você", "Chat direto com o prestador", "Avaliações reais de clientes"].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Criar Conta</h1>
          <p className="text-muted-foreground mb-8">Preencha seus dados para começar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Ex.: Luis Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.state || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}
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
              {errors.state && <p className="text-xs text-destructive mt-1">{errors.state}</p>}
            </div>
            <div>
              <Label>Cidade</Label>
              <Select
                value={form.city || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}
                disabled={!form.state || citiesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.state ? (citiesLoading ? "Carregando…" : "Selecione a cidade") : "Selecione o estado primeiro"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
            </div>
            <div>
              <Label htmlFor="cep">CEP</Label>
              <div className="flex gap-2">
                <Input
                  id="cep"
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: formatCepInput(e.target.value) })}
                  onBlur={() => {
                    if (form.cep.replace(/\D/g, "").length === 8) void lookupCep();
                  }}
                  required
                />
                <Button type="button" variant="outline" disabled={cepLoading} onClick={() => void lookupCep()}>
                  {cepLoading ? "…" : "Buscar"}
                </Button>
              </div>
              {errors.cep && <p className="text-xs text-destructive mt-1">{errors.cep}</p>}
              <p className="text-xs text-muted-foreground mt-1">Consulta em ViaCEP para validar o endereço</p>
            </div>
            <div>
              <Label htmlFor="address">Endereço (rua e número) *</Label>
              <Input id="address" placeholder="Rua, número" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="complement">Complemento (opcional)</Label>
              <Input id="complement" placeholder="Apto, bloco..." value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
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
            <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
              Criar Conta
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            É profissional?{" "}
            <Link to="/provider/register" className="text-accent font-medium hover:underline">
              Cadastre-se aqui
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ClientRegister;
