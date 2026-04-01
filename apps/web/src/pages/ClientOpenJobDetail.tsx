import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  acceptOpenJobQuote,
  ApiError,
  cancelClientOpenJob,
  getOpenJobForClient,
} from "@/lib/api";
import { useWebsocket } from "@/lib/websocket";
import { useRequireAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ClientOpenJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useRequireAuth("/login");
  const [cancelOpen, setCancelOpen] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["openJob", "client", id],
    queryFn: () => getOpenJobForClient(id!),
    enabled: Boolean(id),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["openJob", "client", id] });
    queryClient.invalidateQueries({ queryKey: ["clientOpenJobs"] });
  }, [queryClient, id]);

  useWebsocket({
    enabled: Boolean(id),
    onEvent: (event) => {
      if (event.type === "open_job.updated" && event.payload?.openJobId === id) {
        invalidate();
      }
    },
  });

  const acceptMut = useMutation({
    mutationFn: ({ quoteId }: { quoteId: string }) => acceptOpenJobQuote(id!, quoteId),
    onSuccess: (data) => {
      toast.success("Proposta aceita. Abrindo o chat com o prestador.");
      invalidate();
      navigate(`/chat/${data.requestId}`);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof ApiError ? e.message : "Nao foi possivel aceitar a proposta.");
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelClientOpenJob(id!),
    onSuccess: () => {
      toast.success("Chamado cancelado.");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof ApiError ? e.message : "Nao foi possivel cancelar.");
    },
  });

  if (!id) {
    return null;
  }

  const job = jobQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/client/open-jobs" aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-display text-lg font-semibold truncate">Chamado aberto</h1>
        </div>
      </header>

      <div className="container py-6 max-w-lg mx-auto space-y-6">
        {jobQuery.isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : jobQuery.isError || !job ? (
          <p className="text-center text-muted-foreground">Chamado nao encontrado.</p>
        ) : (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="secondary">{job.serviceLabel}</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    job.status === "open" && "border-amber-500/50 text-amber-800 dark:text-amber-200",
                    job.status === "awarded" && "border-emerald-500/50 text-emerald-800 dark:text-emerald-200",
                    job.status === "cancelled" && "border-muted-foreground/50"
                  )}
                >
                  {job.status === "open" && "Recebendo propostas"}
                  {job.status === "awarded" && "Proposta aceita"}
                  {job.status === "cancelled" && "Cancelado"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.description || "Sem descricao adicional."}
              </p>
            </div>

            {job.status === "awarded" && job.resultRequestId && (
              <Button className="w-full" variant="hero" asChild>
                <Link to={`/chat/${job.resultRequestId}`}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Abrir chat do pedido
                </Link>
              </Button>
            )}

            {job.status === "open" && (
              <Button variant="outline" className="w-full text-destructive border-destructive/30" onClick={() => setCancelOpen(true)}>
                Cancelar chamado
              </Button>
            )}

            <div className="space-y-3">
              <h2 className="font-display font-semibold text-foreground">Propostas</h2>
              {job.quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6 text-center">
                  Nenhuma proposta ainda. Prestadores na regiao podem enviar valores e prazos.
                </p>
              ) : (
                job.quotes.map((q) => (
                  <Card key={q.id} className="border-border shadow-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {q.providerPhotoUrl ? (
                            <img src={q.providerPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-semibold shrink-0">
                              {q.providerName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="text-base font-semibold truncate flex items-center gap-2">
                              {q.providerName}
                              {q.providerVerified && (
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">{q.amountLabel}</p>
                          </div>
                        </div>
                        <Badge variant={q.status === "pending" ? "default" : "secondary"}>
                          {q.status === "pending" ? "Pendente" : q.status === "accepted" ? "Aceita" : "Recusada"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {q.etaDays != null && (
                        <p className="text-muted-foreground">Prazo estimado: {q.etaDays} dia(s)</p>
                      )}
                      {q.message && <p className="text-card-foreground">{q.message}</p>}
                      {q.conditions && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Condicoes: </span>
                          {q.conditions}
                        </p>
                      )}
                      {job.status === "open" && q.status === "pending" && (
                        <Button
                          variant="hero"
                          className="w-full mt-2"
                          disabled={acceptMut.isPending}
                          onClick={() => acceptMut.mutate({ quoteId: q.id })}
                        >
                          {acceptMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar proposta"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este chamado?</AlertDialogTitle>
            <AlertDialogDescription>
              As propostas pendentes serao recusadas e os prestadores nao poderao enviar novas ofertas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMut.mutate()}
            >
              {cancelMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientOpenJobDetail;
