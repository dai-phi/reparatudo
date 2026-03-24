import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, LogOut, User, Wrench } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, logout, setStoredUser, updateMe } from "@/lib/api";
import { useAuthUser, useRequireAuth } from "@/hooks/useAuth";
import { UI_ERRORS, UI_MESSAGES } from "@/value-objects/messages";

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

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setStoredUser(user);
      toast.success(UI_MESSAGES.profile.updated);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : UI_ERRORS.profile.update;
      toast.error(message);
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      complement: form.complement.trim() || undefined,
      neighborhood: form.neighborhood.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      cep: form.cep.replace(/\D/g, "") || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/client/home" className="flex items-center gap-2 text-foreground hover:opacity-90">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Repara Tudo!</span>
          </Link>
          <div className="flex items-center gap-3">
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

      <div className="container py-8">
        <Link
          to="/client/home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <div className="max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Meu perfil</h1>
          <div className="p-6 rounded-xl bg-card shadow-card border border-border space-y-4">
            <div className="flex items-center gap-4 mb-4">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-lg font-bold text-accent">
                  {(me?.name ?? "?").charAt(0)}
                </div>
              )}
              <div>
                <p className="font-bold text-card-foreground">{me?.name ?? "Cliente"}</p>
                <p className="text-sm text-muted-foreground">{me?.email ?? ""}</p>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
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
              <Label>Complemento</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.state} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>CEP</Label>
              <Input placeholder="00000-000" value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Cole o link de uma imagem para sua foto de perfil</p>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSave} disabled={updateMutation.isPending}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPerfil;
