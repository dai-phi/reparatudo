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
import { Wrench, Zap, Droplets, PaintBucket, Hammer, ArrowLeft, CheckCircle2, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, registerProvider, setAuth } from "@/lib/api";
import { BR_STATES } from "@/lib/brazil-states";
import { fetchMunicipiosByUf, matchMunicipioName } from "@/lib/ibge-municipios";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { fetchViaCep } from "@/lib/viacep";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

const ACCEPT_PROFILE_IMAGES = "image/jpeg,image/png,image/webp";

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
    workStreet: "",
    workNumber: "",
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
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepNeedsStreet, setCepNeedsStreet] = useState(false);
  const [cpfTouched, setCpfTouched] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const inputErrorClass = (key: string) =>
    errors[key] ? "border-destructive focus-visible:ring-destructive" : "";
  const selectErrorClass = (key: string) =>
    errors[key] ? "border-destructive focus-visible:ring-destructive" : "";

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

  const syncPasswordConfirmError = (nextPassword: string, nextConfirm: string) => {
    const mismatch = nextConfirm.length > 0 && nextPassword !== nextConfirm;
    setErrors((prev) => {
      const next = { ...prev };
      if (mismatch) next.passwordConfirm = "As senhas não conferem";
      else delete next.passwordConfirm;
      return next;
    });
  };

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
    setSelectedServices((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      if (next.length > 0) {
        setErrors((old) => {
          const copy = { ...old };
          delete copy.services;
          return copy;
        });
      }
      return next;
    });
  };

  const focusFirstError = (e: Record<string, string>) => {
    const order = [
      "name",
      "email",
      "phone",
      "cpf",
      "workCep",
      "workStreet",
      "workNumber",
      "workNeighborhood",
      "password",
      "passwordConfirm",
      "services",
    ];
    const first = order.find((k) => e[k]);
    if (!first) return;
    const el = inputRefs.current[first];
    if (el && typeof el.focus === "function") {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const validatePasswords = () => {
    const e: Record<string, string> = {};
    if (form.password && (passwordStrength.score < 3 || passwordStrength.variety < 3 || !passwordStrength.lengthOk)) {
      e.password = "Senha fraca. Use no mínimo 8 caracteres e combine 3 itens: maiúscula, minúscula, número, símbolo.";
    }
    if (form.passwordConfirm && form.password !== form.passwordConfirm) {
      e.passwordConfirm = "As senhas não conferem";
    }
    setErrors(e);
    return { ok: Object.keys(e).length === 0, errors: e };
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!hasFullName(form.name)) e.name = "Informe nome completo (nome e sobrenome)";
    if (!isValidBrazilPhone(form.phone)) e.phone = "Telefone inválido: use DDD + número (10 ou 11 dígitos)";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    const cpfErr = getCpfError(cpfDigits);
    if (cpfErr) e.cpf = cpfErr;
    if (!form.workState) e.workState = "Selecione o estado";
    if (!form.workCity) e.workCity = "Selecione a cidade";
    const cepDigits = form.workCep.replace(/\D/g, "");
    if (cepDigits.length !== 8) e.workCep = "CEP deve ter 8 dígitos";
    if (!form.workStreet.trim()) e.workStreet = "Informe o logradouro (rua/avenida)";
    if (!form.workNumber.trim()) e.workNumber = "Informe o número";
    if (form.password && (passwordStrength.score < 3 || passwordStrength.variety < 3 || !passwordStrength.lengthOk)) {
      e.password = "Senha fraca. Use no mínimo 8 caracteres e combine 3 itens: maiúscula, minúscula, número, símbolo.";
    }
    if (form.passwordConfirm && form.password !== form.passwordConfirm) e.passwordConfirm = "As senhas não conferem";
    setErrors(e);
    return { ok: Object.keys(e).length === 0, errors: e };
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
        workStreet: data.logradouro ? data.logradouro : f.workStreet,
        workNeighborhood: data.bairro ? data.bairro : f.workNeighborhood,
      }));
      setCepNeedsStreet(!data.logradouro);
      toast.success("Endereço encontrado pelo CEP");
    } catch {
      setErrors((prev) => ({ ...prev, workCep: "Não foi possível buscar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const goStep2 = () => {
    const result = validateStep1();
    if (!result.ok) {
      toast.error("Corrija os campos destacados.");
      focusFirstError(result.errors);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const passResult = validatePasswords();
    if (!passResult.ok) {
      focusFirstError(passResult.errors);
      return;
    }
    const step1Result = validateStep1();
    if (!step1Result.ok) {
      toast.error("Revise seus dados no passo anterior.");
      setStep(1);
      focusFirstError(step1Result.errors);
      return;
    }
    if (selectedServices.length === 0) {
      const next = { services: "Selecione ao menos um serviço" };
      setErrors((prev) => ({ ...prev, ...next }));
      toast.error("Selecione ao menos um serviço para continuar.");
      focusFirstError(next);
      return;
    }
    const workCepNumeric = form.workCep.replace(/\D/g, "");
    const via = await fetchViaCep(workCepNumeric);
    if (!via) {
      toast.error("CEP não encontrado. Verifique no passo anterior.");
      setStep(1);
      return;
    }
    if (!via.logradouro) {
      setCepNeedsStreet(true);
      if (!form.workStreet.trim()) {
        setErrors((prev) => ({
          ...prev,
          workStreet: "Informe o logradouro (ViaCEP não retornou rua para este CEP)",
        }));
        toast.error("Preencha o logradouro manualmente (ViaCEP não retornou a rua).");
        setStep(1);
        return;
      }
    }
    setLoading(true);
    try {
      const cpfDigits = form.cpf.replace(/\D/g, "");
      const workAddressCombined = `${form.workStreet.trim()}, ${form.workNumber.trim()}`;
      const auth = await registerProvider({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        cpf: cpfDigits,
        radiusKm: Number(form.radius) || 10,
        services: selectedServices,
        workAddress: workAddressCombined,
        workComplement: form.workComplement.trim() || undefined,
        workNeighborhood: form.workNeighborhood.trim() || undefined,
        workCity: form.workCity.trim(),
        workState: form.workState,
        workCep: workCepNumeric,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        profilePhoto: profilePhoto ?? undefined,
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
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {step === 1 ? "Dados pessoais" : "Serviços oferecidos"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {step === 1 ? "Passo 1 de 2 - Dados de cadastro" : "Passo 2 de 2 - Serviços e área de atuação"}
          </p>

          <div className="flex gap-2 mb-6">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-accent" : "bg-muted"}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-accent" : "bg-muted"}`} />
          </div>

          {step === 1 ? (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                goStep2();
              }}
            >
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

              <div className="rounded-xl border border-border p-4 space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  Foto de perfil (opcional)
                </Label>
                <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP. Máx. 5 MB. Aparece no perfil após o cadastro.</p>
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept={ACCEPT_PROFILE_IMAGES}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    setProfilePhoto(f);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => profilePhotoInputRef.current?.click()}>
                    {profilePhoto ? profilePhoto.name : "Escolher imagem"}
                  </Button>
                  {profilePhoto ? (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setProfilePhoto(null)}>
                      Remover
                    </Button>
                  ) : null}
                </div>
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
                    inputMode="numeric"
                    autoComplete="postal-code"
                    aria-invalid={Boolean(errors.workCep)}
                    className={inputErrorClass("workCep")}
                    ref={(el) => {
                      inputRefs.current.workCep = el;
                    }}
                  />
                  <Button type="button" variant="outline" disabled={cepLoading} onClick={() => void lookupWorkCep()}>
                    {cepLoading ? "…" : "Buscar"}
                  </Button>
                </div>
                {errors.workCep && <p className="text-xs text-destructive mt-1">{errors.workCep}</p>}
                {cepNeedsStreet ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Este CEP não retornou logradouro no ViaCEP. Preencha a rua/avenida manualmente.
                  </p>
                ) : null}
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
                      <SelectTrigger className={selectErrorClass("workState")}>
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
                      <SelectTrigger className={selectErrorClass("workCity")}>
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
                    <Label htmlFor="workStreet">Logradouro (rua/avenida) *</Label>
                    <Input
                      id="workStreet"
                      placeholder="Ex.: Rua das Flores"
                      value={form.workStreet}
                      onChange={(e) => setForm({ ...form, workStreet: e.target.value })}
                      aria-invalid={Boolean(errors.workStreet)}
                      className={inputErrorClass("workStreet")}
                      ref={(el) => {
                        inputRefs.current.workStreet = el;
                      }}
                    />
                    {errors.workStreet && <p className="text-xs text-destructive mt-1">{errors.workStreet}</p>}
                  </div>
                  <div>
                    <Label htmlFor="workNumber">Número *</Label>
                    <Input
                      id="workNumber"
                      placeholder="Ex.: 123"
                      value={form.workNumber}
                      onChange={(e) => setForm({ ...form, workNumber: e.target.value })}
                      inputMode="numeric"
                      aria-invalid={Boolean(errors.workNumber)}
                      className={inputErrorClass("workNumber")}
                      ref={(el) => {
                        inputRefs.current.workNumber = el;
                      }}
                    />
                    {errors.workNumber && <p className="text-xs text-destructive mt-1">{errors.workNumber}</p>}
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
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => {
                    const nextPassword = e.target.value;
                    setForm((f) => ({ ...f, password: nextPassword }));
                    syncPasswordConfirmError(nextPassword, form.passwordConfirm);
                  }}
                  required
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
                  required
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.passwordConfirm)}
                  className={inputErrorClass("passwordConfirm")}
                  ref={(el) => {
                    inputRefs.current.passwordConfirm = el;
                  }}
                />
                {errors.passwordConfirm && <p className="text-xs text-destructive mt-1">{errors.passwordConfirm}</p>}
              </div>

              <Button className="w-full" size="lg" variant="hero" type="submit">
                Continuar
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">Selecione os serviços que você oferece</Label>
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
                {errors.services && <p className="text-xs text-destructive mt-2">{errors.services}</p>}
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
                <Button variant="hero" className="flex-1" size="lg" onClick={() => void handleSubmit()} disabled={loading}>
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
