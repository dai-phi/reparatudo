import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientOpenJobs } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatServiceWithSubtype(service: string, subtypeLabel?: string | null) {
  return subtypeLabel ? `${service} — ${subtypeLabel}` : service;
}

export type ChamadosSituation = "open" | "closed";

export type ClientOpenJobsListContentProps = {
  className?: string;
  /** Hide the explanatory paragraph (e.g. when parent already describes the area). */
  showIntro?: boolean;
  /** If set, empty state uses a button to switch tabs instead of a link to /client/home. */
  onEmptyGoToNovoServico?: () => void;
  /** When both are set, Situação toggle is not rendered here (e.g. parent puts it in the toolbar row). */
  situation?: ChamadosSituation;
  onSituationChange?: (value: ChamadosSituation) => void;
};

export function ClientOpenJobsListContent({
  className,
  showIntro = true,
  onEmptyGoToNovoServico,
  situation: situationProp,
  onSituationChange,
}: ClientOpenJobsListContentProps) {
  const [internalSituation, setInternalSituation] = useState<ChamadosSituation>("open");
  const toolbarLifted = situationProp !== undefined && onSituationChange !== undefined;
  const chamadosSituation = toolbarLifted ? situationProp : internalSituation;
  const setChamadosSituation = toolbarLifted ? onSituationChange : setInternalSituation;

  const q = useQuery({
    queryKey: ["clientOpenJobs"],
    queryFn: async () => (await getClientOpenJobs()).items,
  });

  const allJobs = q.data ?? [];
  const filteredJobs =
    chamadosSituation === "open"
      ? allJobs.filter((job) => job.status === "open")
      : allJobs.filter((job) => job.status === "awarded" || job.status === "cancelled");

  return (
    <div className={cn("space-y-4", className)}>
      {showIntro ? (
        <p className="text-sm text-muted-foreground">
          Pedidos publicados para receber propostas de prestadores. Depois de aceitar uma proposta, o atendimento continua no chat.
        </p>
      ) : null}

      {q.isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : q.isError ? (
        <p className="text-muted-foreground text-center py-8">Nao foi possivel carregar.</p>
      ) : allJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum chamado aberto ainda.</p>
          {onEmptyGoToNovoServico ? (
            <Button type="button" variant="link" className="mt-2" onClick={onEmptyGoToNovoServico}>
              Criar na aba Novo Servico
            </Button>
          ) : (
            <Button variant="link" asChild className="mt-2">
              <Link to="/client/home">Criar na aba Novo Servico</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {!toolbarLifted ? (
            <div
              className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
              role="group"
              aria-label="Situação dos chamados"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:mr-auto">
                Situação
              </span>
              <div className="inline-flex rounded-full border border-border/80 bg-background/80 p-0.5 shadow-sm">
                {(
                  [
                    { key: "open" as const, label: "Em aberto" },
                    { key: "closed" as const, label: "Encerrados" },
                  ] as const
                ).map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => setChamadosSituation(seg.key)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      chamadosSituation === seg.key
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
              {chamadosSituation === "open"
                ? "Nenhum chamado em aberto."
                : "Nenhum chamado encerrado (fechado ou cancelado)."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/client/open-jobs/${job.id}`}
                  className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:border-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-card-foreground break-words">
                        {formatServiceWithSubtype(job.serviceLabel, job.serviceSubtypeLabel)}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          job.status === "open" && "border-amber-500/40",
                          job.status === "awarded" && "border-emerald-500/40",
                          job.status === "cancelled" && "opacity-70"
                        )}
                      >
                        {job.status === "open" && "Aberto"}
                        {job.status === "awarded" && "Fechado"}
                        {job.status === "cancelled" && "Cancelado"}
                      </Badge>
                    </div>
                    {job.status === "open" ? (
                      <p className="text-sm text-muted-foreground">{job.quoteCount} proposta(s)</p>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.description || "Sem descrição"}</p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
