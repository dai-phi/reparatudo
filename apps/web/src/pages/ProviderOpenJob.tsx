import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getOpenJobForProvider, submitOpenJobQuote } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ProviderOpenJob = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useRequireAuth("/login");
  const [amount, setAmount] = useState("");
  const [etaDays, setEtaDays] = useState("");
  const [message, setMessage] = useState("");
  const [conditions, setConditions] = useState("");

  const jobQuery = useQuery({
    queryKey: ["openJob", "provider", id],
    queryFn: () => getOpenJobForProvider(id!),
    enabled: Boolean(id),
  });

  const submitMut = useMutation({
    mutationFn: () => {
      const n = Number(amount.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error("Informe um valor valido.");
      }
      const etaRaw = etaDays.trim();
      let eta: number | null = null;
      if (etaRaw !== "") {
        const parsed = Number.parseInt(etaRaw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          eta = parsed;
        }
      }
      return submitOpenJobQuote(id!, {
        amount: n,
        etaDays: eta,
        message: message.trim() || null,
        conditions: conditions.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Proposta enviada.");
      queryClient.invalidateQueries({ queryKey: ["openJob", "provider", id] });
      queryClient.invalidateQueries({ queryKey: ["providerOpenJobsDiscover"] });
      navigate("/provider/dashboard");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Erro ao enviar.");
    },
  });

  if (!id) return null;

  const job = jobQuery.data;
  const myQuote = job?.quotes[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/provider/dashboard" aria-label="Voltar">
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
          <p className="text-center text-muted-foreground">Chamado nao encontrado ou sem acesso.</p>
        ) : (
          <>
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="secondary">{job.serviceLabel}</Badge>
                {job.serviceSubtypeLabel ? (
                  <Badge variant="outline" className="font-normal">
                    {job.serviceSubtypeLabel}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description || "Sem descricao."}</p>
            </div>

            {job.status !== "open" && (
              <p className="text-sm text-muted-foreground rounded-lg border border-border p-4">
                Este chamado nao aceita novas propostas.
                {job.resultRequestId && myQuote?.status === "accepted" && (
                  <>
                    {" "}
                    <Link className="text-accent underline font-medium" to={`/chat/${job.resultRequestId}`}>
                      Abrir chat
                    </Link>
                  </>
                )}
              </p>
            )}

            {myQuote && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sua proposta</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>{myQuote.amountLabel}</p>
                  {myQuote.etaDays != null && <p className="text-muted-foreground">Prazo: {myQuote.etaDays} dia(s)</p>}
                  <Badge variant="outline" className={cn(myQuote.status === "pending" && "border-amber-500/40")}>
                    {myQuote.status}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {job.status === "open" && !myQuote && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitMut.mutate();
                }}
              >
                <div>
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="Ex: 150"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="eta">Prazo estimado (dias)</Label>
                  <Input
                    id="eta"
                    inputMode="numeric"
                    placeholder="Opcional"
                    value={etaDays}
                    onChange={(e) => setEtaDays(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="msg">Mensagem</Label>
                  <Textarea
                    id="msg"
                    placeholder="Como pretende executar o servico..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label htmlFor="cond">Condicoes (opcional)</Label>
                  <Textarea
                    id="cond"
                    placeholder="Materiais, horarios, garantia..."
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={submitMut.isPending}>
                  {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar proposta"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProviderOpenJob;
