export const PROVIDER_PLAN_IDS = ["standard", "pro"] as const;
export type ProviderPlanId = (typeof PROVIDER_PLAN_IDS)[number];

export const PROVIDER_PLAN_PAYMENT_METHODS = ["pix", "credit_card", "debit_card"] as const;
export type ProviderPlanPaymentMethod = (typeof PROVIDER_PLAN_PAYMENT_METHODS)[number];

export const PROVIDER_PLAN_SUBSCRIPTION_STATUSES = ["active", "expired", "cancelled"] as const;
export type ProviderPlanSubscriptionStatus = (typeof PROVIDER_PLAN_SUBSCRIPTION_STATUSES)[number];

export const PROVIDER_PLAN_PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled"] as const;
export type ProviderPlanPaymentStatus = (typeof PROVIDER_PLAN_PAYMENT_STATUSES)[number];

export const PROVIDER_PLAN_CATALOG = [
  {
    id: "standard" as const,
    code: "standard" as const,
    name: "Padrao",
    description: "Acesso mensal essencial para receber e gerir servicos na plataforma.",
    price: 50,
    billingCycleDays: 30,
    features: [
      "Receber solicitacoes de servico na plataforma",
      "Gerir perfil, extrato e historico de atendimentos",
      "Manter assinatura mensal ativa",
    ],
    sortOrder: 1,
  },
  {
    id: "pro" as const,
    code: "pro" as const,
    name: "Pro",
    description: "Acesso mensal ampliado com beneficios adicionais para o prestador.",
    price: 90,
    billingCycleDays: 30,
    features: [
      "Receber solicitacoes de servico na plataforma",
      "Gerir perfil, extrato e historico de atendimentos",
      "Acesso ao nivel premium de planos para prestadores",
    ],
    sortOrder: 2,
  },
] as const;
