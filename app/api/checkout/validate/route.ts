import { NextResponse } from "next/server";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type RequestItem = {
  productId: string;
  sellerId: string;
  quantity: number;
  pricingType: "retail" | "wholesale";
};

type ProductData = {
  id: string;
  name: string;
  slug?: string;

  sellerId: string;
  sellerName?: string;

  status:
    | "active"
    | "draft"
    | "out_of_stock"
    | "blocked";

  stock: number;

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;

  moq: number;

  wholesaleTiers?: {
    minQuantity: number;
    maxQuantity?: number;
    price: number;
  }[];

  images?: string[];
};

type ValidatedItem = {
  productId: string;
  sellerId: string;

  name: string;
  sellerName: string;

  image: string;

  quantity: number;

  pricingType: "retail" | "wholesale";

  unitPrice: number;
  subtotal: number;

  moq: number;
  stock: number;
};

type ValidationError = {
  productId?: string;
  code: string;
  message: string;
};

type SellerGroup = {
  sellerId: string;
  sellerName: string;
  itemCount: number;
  subtotal: number;
};

function numberValue(
  value: unknown,
  fallback = 0
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function getWholesalePrice(
  product: ProductData,
  quantity: number
): number {
  const tiers =
    Array.isArray(
      product.wholesaleTiers
    )
      ? [...product.wholesaleTiers]
      : [];

  tiers.sort(
    (a, b) =>
      numberValue(b.minQuantity) -
      numberValue(a.minQuantity)
  );

  const matchingTier =
    tiers.find(
      (tier) =>
        quantity >=
          numberValue(
            tier.minQuantity
          ) &&
        (tier.maxQuantity ===
          undefined ||
          quantity <=
            numberValue(
              tier.maxQuantity
            ))
    );

  if (matchingTier) {
    return numberValue(
      matchingTier.price
    );
  }

  return numberValue(
    product.wholesalePrice
  );
}

function normaliseProduct(
  id: string,
  data: Record<string, unknown>
): ProductData {
  return {
    id,

    name: stringValue(
      data.name,
      "Product"
    ),

    slug: stringValue(
      data.slug
    ),

    sellerId: stringValue(
      data.sellerId
    ),

    sellerName: stringValue(
      data.sellerName,
      "ANJIVO Seller"
    ),

    status:
      data.status === "draft" ||
      data.status ===
        "out_of_stock" ||
      data.status === "blocked"
        ? data.status
        : "active",

    stock: numberValue(
      data.stock
    ),

    mrp: numberValue(
      data.mrp
    ),

    retailPrice: numberValue(
      data.retailPrice
    ),

    wholesalePrice:
      numberValue(
        data.wholesalePrice
      ),

    moq: numberValue(
      data.moq,
      1
    ),

    wholesaleTiers:
      Array.isArray(
        data.wholesaleTiers
      )
        ? data.wholesaleTiers
            .filter(
              (tier) =>
                tier &&
                typeof tier ===
                  "object"
            )
            .map(
              (tier) =>
                tier as {
                  minQuantity: number;
                  maxQuantity?: number;
                  price: number;
                }
            )
        : [],

    images:
      Array.isArray(
        data.images
      )
        ? data.images.filter(
            (image) =>
              typeof image ===
              "string"
          )
        : [],
  };
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const userId =
      stringValue(body?.userId);

    const items =
      body?.items;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          errors: [
            {
              code: "AUTH_REQUIRED",
              message:
                "Please login before checkout.",
            },
          ],
        },
        {
          status: 401,
        }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          errors: [
            {
              code: "EMPTY_CART",
              message:
                "Your cart is empty.",
            },
          ],
        },
        {
          status: 400,
        }
      );
    }

    const requestItems: RequestItem[] =
      items.map(
        (item: unknown) => {
          const value =
            item as Record<
              string,
              unknown
            >;

          const pricingType =
            value.pricingType ===
            "wholesale"
              ? "wholesale"
              : "retail";

          return {
            productId:
              stringValue(
                value.id ??
                  value.productId
              ),

            sellerId:
              stringValue(
                value.sellerId
              ),

            quantity: Math.floor(
              numberValue(
                value.quantity
              )
            ),

            pricingType,
          };
        }
      );

    const errors: ValidationError[] =
      [];

    const validatedItems: ValidatedItem[] =
      [];

    /*
     * Important:
     * Product IDs are collected first.
     * Actual product documents are then
     * fetched from Firestore.
     *
     * Browser-supplied price, stock,
     * seller name etc. are NOT trusted.
     */

    const uniqueProductIds =
      Array.from(
        new Set(
          requestItems
            .map(
              (item) =>
                item.productId
            )
            .filter(Boolean)
        )
      );

    const productSnapshots =
      await Promise.all(
        uniqueProductIds.map(
          async (productId) => {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "products",
                  productId
                )
              );

            return {
              productId,
              snapshot,
            };
          }
        )
      );

    const productMap =
      new Map<
        string,
        ProductData
      >();

    for (const {
      productId,
      snapshot,
    } of productSnapshots) {
      if (!snapshot.exists()) {
        continue;
      }

      const data =
        snapshot.data() as Record<
          string,
          unknown
        >;

      productMap.set(
        productId,
        normaliseProduct(
          productId,
          data
        )
      );
    }

    /*
     * Prevent duplicate product/seller/
     * pricing combinations from being
     * accidentally processed multiple times.
     */

    const combinationMap =
      new Map<
        string,
        RequestItem
      >();

    for (const item of requestItems) {
      if (
        !item.productId ||
        !item.sellerId
      ) {
        errors.push({
          productId:
            item.productId,
          code: "INVALID_ITEM",
          message:
            "One of the cart items is invalid.",
        });

        continue;
      }

      if (
        !Number.isFinite(
          item.quantity
        ) ||
        item.quantity <= 0
      ) {
        errors.push({
          productId:
            item.productId,
          code: "INVALID_QUANTITY",
          message:
            "Product quantity must be greater than zero.",
        });

        continue;
      }

      const key = [
        item.productId,
        item.sellerId,
        item.pricingType,
      ].join("|");

      const existing =
        combinationMap.get(key);

      if (existing) {
        existing.quantity +=
          item.quantity;
      } else {
        combinationMap.set(
          key,
          {
            ...item,
          }
        );
      }
    }

    const finalRequestItems =
      Array.from(
        combinationMap.values()
      );

    for (const item of finalRequestItems) {
      const product =
        productMap.get(
          item.productId
        );

      if (!product) {
        errors.push({
          productId:
            item.productId,
          code: "PRODUCT_NOT_FOUND",
          message:
            "This product is no longer available.",
        });

        continue;
      }

      /*
       * Seller validation
       */
      if (
        product.sellerId !==
        item.sellerId
      ) {
        errors.push({
          productId:
            item.productId,
          code: "SELLER_MISMATCH",
          message:
            "Product seller information has changed. Please refresh your cart.",
        });

        continue;
      }

      /*
       * Product status
       */
      if (
        product.status !==
        "active"
      ) {
        errors.push({
          productId:
            item.productId,
          code: "PRODUCT_UNAVAILABLE",
          message:
            `${product.name} is currently unavailable.`,
        });

        continue;
      }

      /*
       * Stock validation
       */
      if (
        product.stock <= 0
      ) {
        errors.push({
          productId:
            item.productId,
          code: "OUT_OF_STOCK",
          message:
            `${product.name} is out of stock.`,
        });

        continue;
      }

      if (
        item.quantity >
        product.stock
      ) {
        errors.push({
          productId:
            item.productId,
          code: "INSUFFICIENT_STOCK",
          message:
            `${product.name} has only ${product.stock} units available.`,
        });

        continue;
      }

      /*
       * Wholesale validation
       */
      if (
        item.pricingType ===
        "wholesale"
      ) {
        const moq =
          Math.max(
            1,
            product.moq
          );

        if (
          item.quantity <
          moq
        ) {
          errors.push({
            productId:
              item.productId,
            code: "MOQ_NOT_MET",
            message:
              `${product.name} requires a minimum wholesale quantity of ${moq}.`,
          });

          continue;
        }
      }

      /*
       * Price calculation happens
       * from Firestore product data.
       */
      let unitPrice =
        product.retailPrice;

      if (
        item.pricingType ===
        "wholesale"
      ) {
        unitPrice =
          getWholesalePrice(
            product,
            item.quantity
          );
      }

      if (
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice < 0
      ) {
        errors.push({
          productId:
            item.productId,
          code: "INVALID_PRICE",
          message:
            `${product.name} has an invalid price configuration.`,
        });

        continue;
      }

      const subtotal =
        unitPrice *
        item.quantity;

      validatedItems.push({
        productId:
          product.id,

        sellerId:
          product.sellerId,

        name:
          product.name,

        sellerName:
          product.sellerName ||
          "ANJIVO Seller",

        image:
          product.images?.[0] ||
          "",

        quantity:
          item.quantity,

        pricingType:
          item.pricingType,

        unitPrice,

        subtotal,

        moq:
          product.moq,

        stock:
          product.stock,
      });
    }

    /*
     * Seller-wise aggregation
     */
    const sellerMap =
      new Map<
        string,
        SellerGroup
      >();

    for (const item of validatedItems) {
      const existing =
        sellerMap.get(
          item.sellerId
        );

      if (existing) {
        existing.itemCount +=
          item.quantity;

        existing.subtotal +=
          item.subtotal;
      } else {
        sellerMap.set(
          item.sellerId,
          {
            sellerId:
              item.sellerId,

            sellerName:
              item.sellerName,

            itemCount:
              item.quantity,

            subtotal:
              item.subtotal,
          }
        );
      }
    }

    const sellerGroups =
      Array.from(
        sellerMap.values()
      );

    /*
     * Financial summary
     */
    const subtotal =
      validatedItems.reduce(
        (sum, item) =>
          sum +
          item.subtotal,
        0
      );

    const retailSubtotal =
      validatedItems
        .filter(
          (item) =>
            item.pricingType ===
            "retail"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.subtotal,
          0
        );

    const wholesaleSubtotal =
      validatedItems
        .filter(
          (item) =>
            item.pricingType ===
            "wholesale"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.subtotal,
          0
        );

    const totalItems =
      validatedItems.reduce(
        (sum, item) =>
          sum +
          item.quantity,
        0
      );

    /*
     * Shipping and coupon are intentionally
     * not trusted/calculated here yet.
     *
     * They will be added through the
     * secure checkout/order architecture.
     */
    const shippingCharge = 0;
    const discount = 0;

    const total =
      Math.max(
        0,
        subtotal +
          shippingCharge -
          discount
      );

    return NextResponse.json({
      success:
        errors.length === 0,

      userId,

      items:
        validatedItems,

      errors,

      sellerGroups,

      sellerCount:
        sellerGroups.length,

      totalItems,

      subtotal,

      retailSubtotal,

      wholesaleSubtotal,

      shippingCharge,

      discount,

      total,

      currency: "INR",

      validatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Checkout validation API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        errors: [
          {
            code: "CHECKOUT_VALIDATION_FAILED",
            message:
              "Unable to validate checkout. Please try again.",
          },
        ],
      },
      {
        status: 500,
      }
    );
  }
}
