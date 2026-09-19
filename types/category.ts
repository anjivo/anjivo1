export type Category = {
  id: string;
  name: string;
  slug: string;

  description?: string;

  image?: string;
  icon?: string;

  parentId?: string | null;

  productCount?: number;

  featured?: boolean;
  trending?: boolean;

  status: "active" | "inactive";

  sortOrder?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};
