export const PLANS = {
  starter: {
    id: "starter",
    name: "Старт",
    price: 4990,
    maxDepartments: 3,
    maxUsers: 5,
  },
  business: {
    id: "business",
    name: "Бизнес",
    price: 14990,
    maxDepartments: 10,
    maxUsers: 25,
  },
  enterprise: {
    id: "enterprise",
    name: "Корпоратив",
    price: 39990,
    maxDepartments: Infinity,
    maxUsers: Infinity,
  },
};

export const DEFAULT_PLAN = "business";
