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
import { ArrowLeft, Bell, LogOut, User, Wrench } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage, logout, setStoredUser, updateMe } from "@/lib/api";
import { BR_STATES } from "@/lib/brazil-states";
import { fetchMunicipiosByUf, matchMunicipioName } from "@/lib/ibge-municipios";
import { hasFullName } from "@/lib/person-name";
import { isValidBrazilPhone } from "@/lib/phone";
import { fetchViaCep } from "@/lib/viacep";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

function formatCepInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const ClientPerfil = () => {
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    photoUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (me && me.role !== "client") {
      navigate("/provider/dashboard");
    }
  }, [me, navigate]);

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.name ?? "",
      phone: me.phone ?? "",
      address: me.address ?? "",
      complement: (me as { complement?: string }).complement ?? "",
      neighborhood: (me as { neighborhood?: string }).neighborhood ?? "",
      city: (me as { city?: string }).city ?? "",
      state: (me as { state?: string }).state ?? "",
      cep: me.cep ?? "",
      photoUrl: me.photoUrl ?? "",
    });
  }, [me]);

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

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setStoredUser(user);
      toast.success(UI_MESSAGES.profile.updated);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, UI_ERRORS.profile.update));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
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

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (form.name.trim() && !hasFullName(form.name)) {
      e.name = "Informe nome completo (nome e sobrenome)";
    }
    if (form.phone.trim() && !isValidBrazilPhone(form.phone)) {
      e.phone = "Telefone inválido: use DDD + número (10 ou 11 dígitos)";
    }
    if (form.state && !form.city) e.city = "Selecione a cidade";
    const cepDigits = form.cep.replace(/\D/g, "");
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      e.cep = "CEP deve ter 8 dígitos";
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    if (cepDigits.length === 8) {
      const via = await fetchViaCep(cepDigits);
      if (!via) {
        setErrors((prev) => ({ ...prev, cep: "CEP não encontrado" }));
        toast.error("CEP inválido ou não encontrado.");
        return;
      }
    }

    updateMutation.mutate({
      name: form.name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim(),
      complement: form.complement.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      cep: cepDigits || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex flex-wrap items-center justify-between gap-3 h-auto min-h-16 py-2 sm:h-16 sm:py-0 px-4 sm:px-6">
          <Link to="/client/home" className="flex items-center gap-2 text-foreground hover:opacity-90">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Repara Tudo!</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
            <button type="button" className="p-2 text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </button>
            <button type="button" className="p-2 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/client/perfil"
              className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center"
              title="Meu perfil"
            >
              <User className="w-5 h-5 text-accent" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-6 sm:py-8 px-4 sm:px-6">
        <Link
          to="/client/home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Voltar ao início
        </Link>

        <div className="max-w-3xl mx-auto w-full space-y-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Meu perfil</h1>
          <div className="rounded-xl bg-card shadow-card p-4 sm:p-6 space-y-4 sm:max-w-2xl border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt="Foto"
                  className="w-24 h-24 sm:w-16 sm:h-16 rounded-full object-cover mx-auto sm:mx-0"
                />
              ) : (
                <div className="w-24 h-24 sm:w-16 sm:h-16 rounded-full bg-accent/10 flex items-center justify-center text-2xl sm:text-lg font-bold text-accent mx-auto sm:mx-0">
                  {(me?.name ?? "?").charAt(0)}
                </div>
              )}
              <div className="text-center sm:text-left min-w-0">
                <p className="font-bold text-card-foreground">{me?.name ?? "Cliente"}</p>
                <p className="text-sm text-muted-foreground break-all">{me?.email ?? ""}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.state || undefined} onValueChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}>
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
              </div>
              <div>
                <Label>Cidade</Label>
                <Select
                  value={form.city || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  disabled={!form.state || citiesLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={form.state ? (citiesLoading ? "Carregando…" : "Selecione a cidade") : "Selecione o estado primeiro"}
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
                {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
              </div>
              <div>
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) => setForm((f) => ({ ...f, cep: formatCepInput(e.target.value) }))}
                    onBlur={() => {
                      if (form.cep.replace(/\D/g, "").length === 8) void lookupCep();
                    }}
                  />
                  <Button type="button" variant="outline" disabled={cepLoading} onClick={() => void lookupCep()}>
                    {cepLoading ? "…" : "Buscar"}
                  </Button>
                </div>
                {errors.cep && <p className="text-xs text-destructive mt-1">{errors.cep}</p>}
              </div>
              <div>
                <Label>Endereço</Label>
                <Input
                  placeholder="Rua, número"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <Label>Complemento (opcional)</Label>
                <Input
                  placeholder="Apto, bloco..."
                  value={form.complement}
                  onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
              </div>
              <div>
                <Label>Foto (URL) (opcional)</Label>
                <Input
                  placeholder="https://..."
                  value={form.photoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                />
              </div>
              <Button variant="hero" className="w-full sm:w-auto" onClick={() => void handleSave()} disabled={updateMutation.isPending}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPerfil;
