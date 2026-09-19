export type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export type Product = {
  id: string;

  name: string;
  slug: string;

  description?: string;

  categoryId: string;
  categoryName?: string;
  subcategoryId?: string;

  sellerId: string;
  sellerName?: string;
  sellerVerified?: boolean;

  images: string[];

  mrp: number;
  retailPrice: number;

  wholesalePrice: number;
  moq: number;

  wholesaleTiers: WholesaleTier[];

  stock: number;

  rating?: number;
  reviewsCount?: number;

  status: "active" | "draft" | "out_of_stock" | "blocked";

  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};
