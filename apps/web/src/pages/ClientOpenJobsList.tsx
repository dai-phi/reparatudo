import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientOpenJobs } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ClientOpenJobsList = () => {
  useRequireAuth("/login");
  const q = useQuery({
    queryKey: ["clientOpenJobs"],
    queryFn: async () => (await getClientOpenJobs()).items,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/client/home" aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-display text-lg font-semibold">Chamados abertos</h1>
        </div>
      </header>

      <div className="container py-6 max-w-lg mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          Pedidos publicados para receber propostas de prestadores. Depois de aceitar uma proposta, o atendimento continua no chat.
        </p>

        {q.isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : q.isError ? (
          <p className="text-muted-foreground text-center py-8">Nao foi possivel carregar.</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum chamado aberto ainda.</p>
            <Button variant="link" asChild className="mt-2">
              <Link to="/client/home">Criar na aba Novo Servico</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {q.data!.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/client/open-jobs/${job.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{job.serviceLabel}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{job.description || "Sem descricao"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          job.status === "open" && "border-amber-500/40",
                          job.status === "awarded" && "border-emerald-500/40",
                          job.status === "cancelled" && "opacity-70"
                        )}
                      >
                        {job.status === "open" && "Aberto"}
                        {job.status === "awarded" && "Fechado"}
                        {job.status === "cancelled" && "Cancelado"}
                      </Badge>
                      {job.status === "open" && (
                        <span className="text-xs text-muted-foreground">
                          {job.quoteCount} proposta(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ClientOpenJobsList;
