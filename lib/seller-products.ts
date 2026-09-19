import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  Product,
  WholesaleTier,
} from "@/types/product";

export type CreateSellerProductInput = {
  name: string;
  slug: string;
  description: string;

  categoryId: string;
  categoryName: string;

  sellerId: string;
  sellerName: string;

  images: string[];

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;

  moq: number;
  wholesaleTiers: WholesaleTier[];

  stock: number;
};

export async function createSellerProduct(
  input: CreateSellerProductInput
): Promise<string> {
  const productRef = await addDoc(
    collection(db, "products"),
    {
      name: input.name.trim(),

      slug: input.slug.trim(),

      description:
        input.description.trim(),

      categoryId:
        input.categoryId.trim(),

      categoryName:
        input.categoryName.trim(),

      sellerId:
        input.sellerId,

      sellerName:
        input.sellerName.trim(),

      sellerVerified: false,

      images: input.images,

      mrp: input.mrp,

      retailPrice:
        input.retailPrice,

      wholesalePrice:
        input.wholesalePrice,

      moq: input.moq,

      wholesaleTiers:
        input.wholesaleTiers,

      stock: input.stock,

      rating: 0,

      reviewsCount: 0,

      status: "draft",

      featured: false,

      bestSeller: false,

      trending: false,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return productRef.id;
}

export async function getSellerProducts(
  sellerId: string
): Promise<Product[]> {
  const productsQuery = query(
    collection(db, "products"),
    where(
      "sellerId",
      "==",
      sellerId
    ),
    orderBy(
      "createdAt",
      "desc"
    )
  );

  const snapshot =
    await getDocs(productsQuery);

  return snapshot.docs.map(
    (document) => {
      const data =
        document.data();

      return {
        id: document.id,

        name: String(
          data.name ?? ""
        ),

        slug: String(
          data.slug ?? ""
        ),

        description:
          data.description
            ? String(
                data.description
              )
            : undefined,

        categoryId: String(
          data.categoryId ?? ""
        ),

        categoryName:
          data.categoryName
            ? String(
                data.categoryName
              )
            : undefined,

        sellerId: String(
          data.sellerId ?? ""
        ),

        sellerName:
          data.sellerName
            ? String(
                data.sellerName
              )
            : undefined,

        sellerVerified:
          Boolean(
            data.sellerVerified
          ),

        images: Array.isArray(
          data.images
        )
          ? data.images.map(String)
          : [],

        mrp: Number(
          data.mrp ?? 0
        ),

        retailPrice: Number(
          data.retailPrice ?? 0
        ),

        wholesalePrice: Number(
          data.wholesalePrice ?? 0
        ),

        moq: Number(
          data.moq ?? 1
        ),

        wholesaleTiers:
          Array.isArray(
            data.wholesaleTiers
          )
            ? data.wholesaleTiers.map(
                (tier) => {
                  const item =
                    tier as Record<
                      string,
                      unknown
                    >;

                  return {
                    minQuantity:
                      Number(
                        item.minQuantity ??
                          1
                      ),

                    maxQuantity:
                      item.maxQuantity !==
                      undefined
                        ? Number(
                            item.maxQuantity
                          )
                        : undefined,

                    price: Number(
                      item.price ?? 0
                    ),
                  };
                }
              )
            : [],

        stock: Number(
          data.stock ?? 0
        ),

        rating:
          data.rating !==
          undefined
            ? Number(
                data.rating
              )
            : undefined,

        reviewsCount:
          data.reviewsCount !==
          undefined
            ? Number(
                data.reviewsCount
              )
            : undefined,

        status:
          data.status ===
            "out_of_stock" ||
          data.status ===
            "blocked" ||
          data.status ===
            "draft"
            ? data.status
            : "active",

        featured:
          Boolean(
            data.featured
          ),

        bestSeller:
          Boolean(
            data.bestSeller
          ),

        trending:
          Boolean(
            data.trending
          ),

        createdAt:
          data.createdAt,

        updatedAt:
          data.updatedAt,
      };
    }
  );
}
