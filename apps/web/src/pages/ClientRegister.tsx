import { useEffect, useMemo, useRef, useState } from "react";
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

function formatBrazilPhoneInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${ddd}`;
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function formatCpfInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCpfDigits(digits: string) {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const nums = digits.split("").map((c) => Number(c));
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(9);
  const d2 = calc(10);
  return d1 === nums[9] && d2 === nums[10];
}

function getPasswordStrength(password: string) {
  const p = password ?? "";
  const lengthOk = p.length >= 8;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasNumber = /\d/.test(p);
  const hasSpecial = /[^A-Za-z0-9]/.test(p);
  const variety = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  // Score is intentionally simple (no extra deps).
  const score =
    (lengthOk ? 2 : p.length >= 6 ? 1 : 0) +
    (variety >= 3 ? 2 : variety === 2 ? 1 : 0);

  const level = score >= 4 ? "forte" : score >= 3 ? "boa" : score >= 2 ? "fraca" : "muito fraca";
  const colorClass =
    level === "forte"
      ? "text-emerald-600"
      : level === "boa"
        ? "text-amber-600"
        : "text-destructive";

  return { lengthOk, hasLower, hasUpper, hasNumber, hasSpecial, variety, score, level, colorClass };
}

const ClientRegister = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    addressStreet: "",
    addressNumber: "",
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
  const [cepNeedsStreet, setCepNeedsStreet] = useState(false);
  const [cpfTouched, setCpfTouched] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const inputErrorClass = (key: string) =>
    errors[key] ? "border-destructive focus-visible:ring-destructive" : "";

  const syncPasswordConfirmError = (nextPassword: string, nextConfirm: string) => {
    const mismatch = nextConfirm.length > 0 && nextPassword !== nextConfirm;
    setErrors((prev) => {
      const next = { ...prev };
      if (mismatch) next.passwordConfirm = "As senhas não conferem";
      else delete next.passwordConfirm;
      return next;
    });
  };

  const getCpfError = (cpfDigits: string) => {
    if (!cpfDigits) return "CPF é obrigatório";
    if (cpfDigits.length < 11) return "CPF deve ter 11 dígitos";
    if (cpfDigits.length > 11) return "CPF deve ter 11 dígitos";
    if (!isValidCpfDigits(cpfDigits)) return "CPF inválido";
    return null;
  };

  const syncCpfError = (cpfDigits: string) => {
    const err = getCpfError(cpfDigits);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next.cpf = err;
      else delete next.cpf;
      return next;
    });
  };

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

  const focusFirstError = (e: Record<string, string>) => {
    const order = [
      "name",
      "email",
      "phone",
      "cpf",
      "cep",
      "state",
      "city",
      "addressStreet",
      "addressNumber",
      "neighborhood",
      "password",
      "passwordConfirm",
    ];
    const first = order.find((k) => e[k]);
    if (!first) return;
    const el = inputRefs.current[first];
    if (el && typeof el.focus === "function") {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!hasFullName(form.name)) {
      e.name = "Informe nome completo (nome e sobrenome)";
    }
    if (!isValidBrazilPhone(form.phone)) {
      e.phone = "Telefone inválido: use DDD + número (10 ou 11 dígitos)";
    }
    const cpfDigits = form.cpf.replace(/\D/g, "");
    const cpfErr = getCpfError(cpfDigits);
    if (cpfErr) e.cpf = cpfErr;
    if (!form.state) e.state = "Selecione o estado";
    if (!form.city) e.city = "Selecione a cidade";
    const cepDigits = form.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      e.cep = "CEP deve ter 8 dígitos";
    }
    if (!form.addressStreet.trim()) e.addressStreet = "Informe o logradouro (rua/avenida)";
    if (!form.addressNumber.trim()) e.addressNumber = "Informe o número";

    if (form.password && (passwordStrength.score < 3 || passwordStrength.variety < 3 || !passwordStrength.lengthOk)) {
      e.password = "Senha fraca. Use no mínimo 8 caracteres e combine 3 itens: maiúscula, minúscula, número, símbolo.";
    }
    if (form.passwordConfirm && form.password !== form.passwordConfirm) {
      e.passwordConfirm = "As senhas não conferem";
    }
    setErrors(e);
    return { ok: Object.keys(e).length === 0, errors: e };
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
        addressStreet: data.logradouro ? data.logradouro : f.addressStreet,
        neighborhood: data.bairro ? data.bairro : f.neighborhood,
      }));
      setCepNeedsStreet(!data.logradouro);
      toast.success("Endereço encontrado pelo CEP");
    } catch {
      setErrors((prev) => ({ ...prev, cep: "Não foi possível buscar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate();
    if (!result.ok) {
      focusFirstError(result.errors);
      return;
    }
    const cepDigits = form.cep.replace(/\D/g, "");
    const via = await fetchViaCep(cepDigits);
    if (!via) {
      const next = { ...result.errors, cep: "CEP não encontrado" };
      setErrors(next);
      toast.error("Confira o CEP antes de continuar.");
      focusFirstError(next);
      return;
    }
    if (!via.logradouro) {
      setCepNeedsStreet(true);
      if (!form.addressStreet.trim()) {
        const next = { ...result.errors, addressStreet: "Informe o logradouro (ViaCEP não retornou rua para este CEP)" };
        setErrors(next);
        toast.error("Preencha o logradouro manualmente (ViaCEP não retornou a rua).");
        focusFirstError(next);
        return;
      }
    }
    setLoading(true);
    try {
      const addressCombined = `${form.addressStreet.trim()}, ${form.addressNumber.trim()}`;
      const auth = await registerClient({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        cpf: form.cpf.replace(/\D/g, ""),
        address: addressCombined,
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

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Ex.: Luis Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={Boolean(errors.name)}
                className={inputErrorClass("name")}
                ref={(el) => {
                  inputRefs.current.name = el;
                }}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={Boolean(errors.email)}
                className={inputErrorClass("email")}
                ref={(el) => {
                  inputRefs.current.email = el;
                }}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(11) 99999-9999"
                value={form.phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => setForm({ ...form, phone: formatBrazilPhoneInput(e.target.value) })}
                aria-invalid={Boolean(errors.phone)}
                className={inputErrorClass("phone")}
                ref={(el) => {
                  inputRefs.current.phone = el;
                }}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={form.cpf}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => {
                  const masked = formatCpfInput(e.target.value);
                  setForm((f) => ({ ...f, cpf: masked }));
                  if (cpfTouched) syncCpfError(masked.replace(/\D/g, ""));
                }}
                onBlur={() => {
                  setCpfTouched(true);
                  syncCpfError(form.cpf.replace(/\D/g, ""));
                }}
                aria-invalid={Boolean(errors.cpf)}
                className={inputErrorClass("cpf")}
                ref={(el) => {
                  inputRefs.current.cpf = el;
                }}
              />
              {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf}</p>}
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
                  inputMode="numeric"
                  autoComplete="postal-code"
                  aria-invalid={Boolean(errors.cep)}
                  className={inputErrorClass("cep")}
                  ref={(el) => {
                    inputRefs.current.cep = el;
                  }}
                />
                <Button type="button" variant="outline" disabled={cepLoading} onClick={() => void lookupCep()}>
                  {cepLoading ? "…" : "Buscar"}
                </Button>
              </div>
              {errors.cep && <p className="text-xs text-destructive mt-1">{errors.cep}</p>}
              {cepNeedsStreet ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Este CEP não retornou logradouro no ViaCEP. Preencha a rua/avenida manualmente.
                </p>
              ) : null}
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.state || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}
              >
                <SelectTrigger className={errors.state ? "border-destructive focus:ring-destructive" : ""}>
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
                <SelectTrigger className={errors.city ? "border-destructive focus:ring-destructive" : ""}>
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
              <Label htmlFor="addressStreet">Logradouro (rua/avenida) *</Label>
              <Input
                id="addressStreet"
                placeholder="Ex.: Rua das Flores"
                value={form.addressStreet}
                onChange={(e) => setForm({ ...form, addressStreet: e.target.value })}
                aria-invalid={Boolean(errors.addressStreet)}
                className={inputErrorClass("addressStreet")}
                ref={(el) => {
                  inputRefs.current.addressStreet = el;
                }}
              />
              {errors.addressStreet && <p className="text-xs text-destructive mt-1">{errors.addressStreet}</p>}
            </div>
            <div>
              <Label htmlFor="addressNumber">Número *</Label>
              <Input
                id="addressNumber"
                placeholder="Ex.: 123"
                value={form.addressNumber}
                onChange={(e) => setForm({ ...form, addressNumber: e.target.value })}
                inputMode="numeric"
                aria-invalid={Boolean(errors.addressNumber)}
                className={inputErrorClass("addressNumber")}
                ref={(el) => {
                  inputRefs.current.addressNumber = el;
                }}
              />
              {errors.addressNumber && <p className="text-xs text-destructive mt-1">{errors.addressNumber}</p>}
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
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={(e) => {
                  const nextPassword = e.target.value;
                  setForm((f) => ({ ...f, password: nextPassword }));
                  syncPasswordConfirmError(nextPassword, form.passwordConfirm);
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                className={inputErrorClass("password")}
                ref={(el) => {
                  inputRefs.current.password = el;
                }}
              />
              <div className="mt-2 space-y-1">
                <p className={`text-xs ${passwordStrength.colorClass}`}>
                  Força: <span className="font-medium">{passwordStrength.level}</span>
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li className={passwordStrength.lengthOk ? "text-emerald-600" : ""}>- Pelo menos 8 caracteres</li>
                  <li className={passwordStrength.hasUpper ? "text-emerald-600" : ""}>- 1 letra maiúscula</li>
                  <li className={passwordStrength.hasLower ? "text-emerald-600" : ""}>- 1 letra minúscula</li>
                  <li className={passwordStrength.hasNumber ? "text-emerald-600" : ""}>- 1 número</li>
                  <li className={passwordStrength.hasSpecial ? "text-emerald-600" : ""}>- 1 símbolo</li>
                </ul>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <div>
              <Label htmlFor="passwordConfirm">Confirmar senha</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="Repita a senha"
                value={form.passwordConfirm}
                onChange={(e) => {
                  const nextConfirm = e.target.value;
                  setForm((f) => ({ ...f, passwordConfirm: nextConfirm }));
                  syncPasswordConfirmError(form.password, nextConfirm);
                }}
                onBlur={() => {
                  syncPasswordConfirmError(form.password, form.passwordConfirm);
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.passwordConfirm)}
                className={inputErrorClass("passwordConfirm")}
                ref={(el) => {
                  inputRefs.current.passwordConfirm = el;
                }}
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
