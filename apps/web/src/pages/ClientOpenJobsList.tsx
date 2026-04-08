import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientOpenJobsListContent } from "@/components/client/client-open-jobs-list-content";
import { useRequireAuth } from "@/hooks/useAuth";

const ClientOpenJobsList = () => {
  useRequireAuth("/login");

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

      <div className="container py-6 max-w-lg mx-auto">
        <ClientOpenJobsListContent showIntro />
      </div>
    </div>
  );
};

export default ClientOpenJobsList;
