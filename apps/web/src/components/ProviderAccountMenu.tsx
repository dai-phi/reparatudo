import { CreditCard, FileText, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type ProviderAccountSection = "profile" | "statement" | "plans";

const items: Array<{
  id: ProviderAccountSection;
  label: string;
  href: string;
  icon: typeof UserRound;
}> = [
  { id: "profile", label: "Perfil", href: "/provider/perfil?tab=profile", icon: UserRound },
  { id: "statement", label: "Extrato", href: "/provider/perfil?tab=statement", icon: FileText },
  { id: "plans", label: "Planos", href: "/provider/plans", icon: CreditCard },
];

export function ProviderAccountMenu({ active }: { active: ProviderAccountSection }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            to={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
