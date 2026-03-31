import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUser } from "@/hooks/useAuth";
import {
  ApiError,
  decideAdminProviderVerification,
  getAdminProviderVerifications,
  type VerificationStatus,
} from "@/lib/api";

const STATUS_OPTIONS: VerificationStatus[] = ["pending", "unverified", "verified", "rejected"];
const PAGE_SIZE = 8;
const ADMIN_SESSION_KEY = "reparatudo_admin_session";
const ADMIN_KYC_KEY_STORAGE = "reparatudo_admin_kyc_key";

function statusLabel(status: VerificationStatus) {
  switch (status) {
    case "pending":
      return "Em análise";
    case "verified":
      return "Verificado";
    case "rejected":
      return "Rejeitado";
    default:
      return "Não verificado";
  }
}

export default function AdminProviderVerifications() {
  const navigate = useNavigate();
  const { data: me, isLoading: authLoading } = useAuthUser();
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState(
    sessionStorage.getItem(ADMIN_KYC_KEY_STORAGE) || import.meta.env.VITE_ADMIN_KYC_KEY || ""
  );
  const [statusFilter, setStatusFilter] = useState<VerificationStatus>("pending");
  const [page, setPage] = useState(1);
  const canLoad = adminKey.trim().length > 0;
  const hasAdminSession = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  const hasProviderSession = me?.role === "provider";
  const hasAccess = hasAdminSession || hasProviderSession;

  useEffect(() => {
    if (authLoading) return;
    if (!hasAccess) {
      navigate("/admin/login", { replace: true });
    }
  }, [authLoading, hasAccess, navigate]);

  useEffect(() => {
    if (adminKey.trim()) {
      sessionStorage.setItem(ADMIN_KYC_KEY_STORAGE, adminKey.trim());
    }
  }, [adminKey]);

  const listQuery = useQuery({
    queryKey: ["adminProviderVerifications", statusFilter, adminKey],
    queryFn: () => getAdminProviderVerifications(adminKey.trim(), statusFilter),
    enabled: canLoad,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ providerId, status }: { providerId: string; status: "verified" | "rejected" }) =>
      decideAdminProviderVerification(adminKey.trim(), providerId, status),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminProviderVerifications"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Falha ao registrar decisão";
      toast.error(message);
    },
  });

  const rows = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [statusFilter, rows.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Admin KYC de prestadores</h1>
          <p className="text-sm text-muted-foreground">Fila mínima para aprovar ou rejeitar verificação de prestadores.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acesso admin</CardTitle>
            <CardDescription>Informe a chave do backend (`x-admin-key`) para carregar a fila.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor="admin-key">Chave admin KYC</Label>
              <Input
                id="admin-key"
                type="password"
                placeholder="ADMIN_KYC_KEY"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  size="sm"
                  variant={statusFilter === opt ? "default" : "outline"}
                  onClick={() => setStatusFilter(opt)}
                >
                  {statusLabel(opt)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {!canLoad ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Preencha a chave admin para listar os prestadores.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Fila ({statusLabel(statusFilter)})</CardTitle>
              <CardDescription>{rows.length} item(ns) encontrado(s).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {listQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {listQuery.isError && (
                <p className="text-sm text-destructive">Não foi possível carregar a fila. Verifique a chave admin.</p>
              )}
              {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum prestador nesta fila.</p>
              )}

              {pageRows.map((row) => (
                <div key={row.providerId} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-card-foreground">{row.name}</p>
                    <Badge variant={row.status === "verified" ? "default" : "secondary"}>{statusLabel(row.status)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{row.email}</p>
                    <p>{row.phone}</p>
                    <p>CPF: {row.cpf ?? "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.documentUrl ? (
                      <a className="text-sm underline" href={row.documentUrl} target="_blank" rel="noreferrer">
                        Abrir documento
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Documento ausente</span>
                    )}
                    {row.selfieUrl ? (
                      <a className="text-sm underline" href={row.selfieUrl} target="_blank" rel="noreferrer">
                        Abrir selfie
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Selfie ausente</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => decisionMutation.mutate({ providerId: row.providerId, status: "verified" })}
                      disabled={decisionMutation.isPending}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => decisionMutation.mutate({ providerId: row.providerId, status: "rejected" })}
                      disabled={decisionMutation.isPending}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}

              {!listQuery.isLoading && !listQuery.isError && rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
