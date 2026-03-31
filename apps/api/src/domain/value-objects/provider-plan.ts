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
    name: "Standard",
    description: "Essential monthly access for providers.",
    price: 50,
    billingCycleDays: 30,
    features: [
      "Receive service requests on the platform",
      "Manage profile, statement and history",
      "Maintain an active monthly subscription",
    ],
    sortOrder: 1,
  },
  {
    id: "pro" as const,
    code: "pro" as const,
    name: "Pro",
    description: "Extended monthly access for providers.",
    price: 90,
    billingCycleDays: 30,
    features: [
      "Receive service requests on the platform",
      "Manage profile, statement and history",
      "Access the premium provider plan tier",
    ],
    sortOrder: 2,
  },
] as const;
