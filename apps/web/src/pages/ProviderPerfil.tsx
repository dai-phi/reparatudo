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

const ProviderPerfil = () => {
  const navigate = useNavigate();
  useRequireAuth("/login");
  const { data: me } = useAuthUser();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    radiusKm: "",
    workCep: "",
    workAddress: "",
    photoUrl: "",
  });

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate("/client/home");
    }
  }, [me, navigate]);

  useEffect(() => {
    if (me) {
      setProfileForm({
        name: me.name ?? "",
        phone: me.phone ?? "",
        radiusKm: me.radiusKm ? String(me.radiusKm) : "10",
        workCep: me.workCep ?? "",
        workAddress: me.workAddress ?? "",
        photoUrl: me.photoUrl ?? "",
      });
    }
  }, [me]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setStoredUser(user);
      toast.success("Perfil atualizado!");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel atualizar o perfil";
      toast.error(message);
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = () => {
    updateMutation.mutate({
      name: profileForm.name.trim() || undefined,
      phone: profileForm.phone.trim() || undefined,
      radiusKm: profileForm.radiusKm ? Number(profileForm.radiusKm) : undefined,
      workCep: profileForm.workCep.replace(/\D/g, "") || undefined,
      workAddress: profileForm.workAddress.trim() || undefined,
      photoUrl: profileForm.photoUrl.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="container flex items-center justify-between h-16">
          <Link to="/provider/dashboard" className="flex items-center gap-2 text-primary-foreground hover:opacity-90">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Repara Tudo!</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/provider/dashboard"
              className="relative p-2 text-primary-foreground/70 hover:text-primary-foreground"
              title="Pedidos"
            >
              <Bell className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-primary-foreground/70 hover:text-primary-foreground"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <Link
              to="/provider/perfil"
              className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center"
              title="Meu perfil"
            >
              <User className="w-5 h-5 text-accent" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Link
          to="/provider/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div className="max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Meu perfil</h1>
          <div className="p-6 rounded-xl bg-card shadow-card space-y-4">
            <div className="flex items-center gap-4 mb-4">
              {profileForm.photoUrl ? (
                <img src={profileForm.photoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-accent" />
                </div>
              )}
              <div>
                <p className="font-bold text-card-foreground">{me?.name ?? "Profissional"}</p>
                <p className="text-sm text-muted-foreground">{me?.email ?? "email@exemplo.com"}</p>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Raio de atuação (km)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={profileForm.radiusKm}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, radiusKm: e.target.value }))}
              />
            </div>
            <div>
              <Label>Endereço do local de trabalho</Label>
              <Input
                placeholder="Rua, número, bairro, cidade, UF"
                value={profileForm.workAddress}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, workAddress: e.target.value }))}
              />
            </div>
            <div>
              <Label>CEP do local de trabalho</Label>
              <Input
                placeholder="00000-000"
                value={profileForm.workCep}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, workCep: e.target.value }))}
              />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                placeholder="https://..."
                value={profileForm.photoUrl}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Cole o link de uma imagem para sua foto de perfil</p>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
              Salvar Alteracoes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderPerfil;
