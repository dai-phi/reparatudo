import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, fetchLegalDocument, type LegalDocument } from "@/lib/api";

type Tab = "terms" | "privacy" | "retention";

const tabs: { id: Tab; label: string }[] = [
  { id: "terms", label: "Termos de uso" },
  { id: "privacy", label: "Privacidade" },
  { id: "retention", label: "Retenção de dados" },
];

const Legal = () => {
  const [tab, setTab] = useState<Tab>("terms");
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLegalDocument(tab)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setDoc(null);
          setError(e instanceof ApiError ? e.message : "Não foi possível carregar o documento.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-display font-semibold text-lg">Repara Tudo</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Início
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold mb-2">Informações legais (LGPD)</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Transparência sobre uso da plataforma, privacidade e retenção de dados. Versão indicada em cada documento.
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={tab === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {loading && <p className="text-muted-foreground">Carregando…</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {doc && !loading && (
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <h2 className="text-2xl font-semibold mt-0 mb-1">{doc.title}</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Versão {doc.version} · atualizado em {doc.updatedAt}
            </p>
            {doc.sections.map((s) => (
              <section key={s.heading} className="mb-6">
                <h3 className="text-lg font-medium mb-2">{s.heading}</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.body}</p>
              </section>
            ))}
          </article>
        )}
      </main>
    </div>
  );
};

export default Legal;
