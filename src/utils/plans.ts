export type PlanId = "starter" | "business" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  maxDepartments: number;
  maxUsers: number;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Старт",
    price: 4990,
    maxDepartments: 3,
    maxUsers: 5,
    features: ["До 3 отделов", "До 5 пользователей", "История чатов"],
  },
  business: {
    id: "business",
    name: "Бизнес",
    price: 14990,
    maxDepartments: 10,
    maxUsers: 25,
    features: [
      "До 10 отделов",
      "До 25 пользователей",
      "История чатов",
      "Загрузка файлов",
      "Артефакты",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Корпоратив",
    price: 39990,
    maxDepartments: Infinity,
    maxUsers: Infinity,
    features: [
      "Без лимитов",
      "Приоритетная поддержка",
      "Кастомизация под компанию",
    ],
  },
};

export const DEFAULT_PLAN: PlanId = "business";
