import { NextResponse } from "next/server";
import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebase-admin";

import {
  verifyIdToken,
} from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

type PricingType =
  | "retail"
  | "wholesale";

type RequestedItem = {
  id?: unknown;
  productId?: unknown;
  sellerId?: unknown;
  quantity?: unknown;
  pricingType?: unknown;
};

type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

type ProductData = {
  name?: unknown;
  slug?: unknown;
  sellerId?: unknown;
  sellerName?: unknown;
  status?: unknown;
  stock?: unknown;
  mrp?: unknown;
  retailPrice?: unknown;
  wholesalePrice?: unknown;
  moq?: unknown;
  wholesaleTiers?: unknown;
  images?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
};

type ValidatedItem = {
  productId: string;
  sellerId: string;
  sellerName: string;
  name: string;
  slug: string;
  image: string;
  quantity: number;
  pricingType: PricingType;
  unitPrice: number;
  lineTotal: number;
  stock: number;
  moq: number;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleTiers: WholesaleTier[];
};

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  }

  return fallback;
}

function normalizePricingType(
  value: unknown
): PricingType | null {
  if (
    value === "retail" ||
    value === "wholesale"
  ) {
    return value;
  }

  return null;
}

function normalizeWholesaleTiers(
  value: unknown
): WholesaleTier[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tier) => {
      if (
        !tier ||
        typeof tier !== "object"
      ) {
        return null;
      }

      const source =
        tier as Record<
          string,
          unknown
        >;

      const minQuantity =
        numberValue(
          source.minQuantity
        );

      const maxQuantityRaw =
        source.maxQuantity;

      const price =
        numberValue(
          source.price
        );

      if (
        minQuantity <= 0 ||
        price < 0
      ) {
        return null;
      }

      const maxQuantity =
        maxQuantityRaw === undefined ||
        maxQuantityRaw === null ||
        maxQuantityRaw === ""
          ? undefined
          : numberValue(
              maxQuantityRaw
            );

      return {
        minQuantity,
        ...(maxQuantity !== undefined
          ? { maxQuantity }
          : {}),
        price,
      };
    })
    .filter(
      (
        tier
      ): tier is WholesaleTier =>
        tier !== null
    )
    .sort(
      (a, b) =>
        b.minQuantity -
        a.minQuantity
    );
}

function getWholesalePrice(
  wholesalePrice: number,
  wholesaleTiers: WholesaleTier[],
  quantity: number
): number {
  for (
    const tier of wholesaleTiers
  ) {
    const minimumMatches =
      quantity >= tier.minQuantity;

    const maximumMatches =
      tier.maxQuantity ===
        undefined ||
      quantity <=
        tier.maxQuantity;

    if (
      minimumMatches &&
      maximumMatches
    ) {
      return tier.price;
    }
  }

  return wholesalePrice;
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Checkout validation failed.";
}

export async function POST(
  request: Request
) {
  try {
    /*
     * -----------------------------------------
     * 1. Authenticate Firebase user
     * -----------------------------------------
     */

    const decodedToken =
      await verifyIdToken(
        request.headers.get(
          "authorization"
        )
      );

    const userId =
      decodedToken.uid;

    /*
     * -----------------------------------------
     * 2. Read request body
     * -----------------------------------------
     */

    const body =
      await request.json();

    const requestedItems =
      Array.isArray(body?.items)
        ? (body.items as RequestedItem[])
        : [];

    if (
      requestedItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your cart is empty.",
          errors: [],
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 3. Normalize requested items
     * -----------------------------------------
     */

    const normalizedItems =
      requestedItems.map(
        (item) => ({
          productId:
            stringValue(
              item.productId ??
                item.id
            ),

          sellerId:
            stringValue(
              item.sellerId
            ),

          quantity:
            Math.floor(
              numberValue(
                item.quantity
              )
            ),

          pricingType:
            normalizePricingType(
              item.pricingType
            ),
        })
      );

    const errors: Array<{
      productId?: string;
      sellerId?: string;
      message: string;
    }> = [];

    /*
     * -----------------------------------------
     * 4. Basic request validation
     * -----------------------------------------
     */

    for (
      const item of normalizedItems
    ) {
      if (!item.productId) {
        errors.push({
          message:
            "Product ID is missing.",
        });

        continue;
      }

      if (!item.sellerId) {
        errors.push({
          productId:
            item.productId,
          message:
            "Seller ID is missing.",
        });

        continue;
      }

      if (
        !Number.isInteger(
          item.quantity
        ) ||
        item.quantity <= 0
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Invalid product quantity.",
        });
      }

      if (!item.pricingType) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Invalid pricing type.",
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Some cart items are invalid.",
          errors,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 5. Prevent duplicate product/seller/
     *    pricing combinations
     * -----------------------------------------
     */

    const uniqueKeys =
      new Set<string>();

    for (
      const item of normalizedItems
    ) {
      const key =
        `${item.productId}:${item.sellerId}:${item.pricingType}`;

      if (
        uniqueKeys.has(key)
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Duplicate product found in checkout.",
        });
      }

      uniqueKeys.add(key);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Duplicate cart items detected.",
          errors,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 6. Read current products directly
     *    from Firestore Admin SDK
     * -----------------------------------------
     */

    const validatedItems: ValidatedItem[] =
      [];

    /*
     * Track total requested quantity
     * per product.
     *
     * This prevents:
     *
     * Retail quantity 5
     * +
     * Wholesale quantity 10
     *
     * from bypassing total stock.
     */

    const requestedQuantityByProduct =
      new Map<string, number>();

    for (
      const item of normalizedItems
    ) {
      const current =
        requestedQuantityByProduct.get(
          item.productId
        ) ?? 0;

      requestedQuantityByProduct.set(
        item.productId,
        current + item.quantity
      );
    }

    /*
     * -----------------------------------------
     * 7. Validate every product
     * -----------------------------------------
     */

    for (
      const item of normalizedItems
    ) {
      const productRef =
        adminDb
          .collection("products")
          .doc(item.productId);

      const productSnapshot =
        await productRef.get();

      if (
        !productSnapshot.exists
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Product is no longer available.",
        });

        continue;
      }

      const product =
        productSnapshot.data() as ProductData;

      const actualSellerId =
        stringValue(
          product.sellerId
        );

      const status =
        stringValue(
          product.status
        );

      const stock =
        Math.max(
          0,
          Math.floor(
            numberValue(
              product.stock
            )
          )
        );

      const retailPrice =
        Math.max(
          0,
          numberValue(
            product.retailPrice
          )
        );

      const wholesalePrice =
        Math.max(
          0,
          numberValue(
            product.wholesalePrice
          )
        );

      const moq =
        Math.max(
          1,
          Math.floor(
            numberValue(
              product.moq,
              1
            )
          )
        );

      const wholesaleTiers =
        normalizeWholesaleTiers(
          product.wholesaleTiers
        );

      /*
       * Seller verification
       */

      if (
        actualSellerId !==
        item.sellerId
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Seller information has changed. Please refresh your cart.",
        });

        continue;
      }

      /*
       * Product status
       */

      if (
        status !== "active"
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "This product is currently unavailable.",
        });

        continue;
      }

      /*
       * Stock
       */

      const totalRequestedQuantity =
        requestedQuantityByProduct.get(
          item.productId
        ) ?? item.quantity;

      if (
        stock <= 0 ||
        totalRequestedQuantity >
          stock
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            `Only ${stock} unit(s) are currently available.`,
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
        if (
          item.quantity <
          moq
        ) {
          errors.push({
            productId:
              item.productId,
            sellerId:
              item.sellerId,
            message:
              `Minimum wholesale quantity is ${moq}.`,
          });

          continue;
        }

        /*
         * Current checkout user must be
         * authorized for wholesale.
         *
         * For now we check the user's
         * Firestore customer profile.
         */

        const userSnapshot =
          await adminDb
            .collection("users")
            .doc(userId)
            .get();

        const userData =
          userSnapshot.exists
            ? userSnapshot.data()
            : null;

        const customerType =
          stringValue(
            userData?.customerType ??
              userData?.role
          );

        const isWholesaleCustomer =
          customerType ===
          "WHOLESALE_CUSTOMER";

        const isSeller =
          customerType ===
          "SELLER";

        if (
          !isWholesaleCustomer &&
          !isSeller
        ) {
          errors.push({
            productId:
              item.productId,
            sellerId:
              item.sellerId,
            message:
              "Wholesale pricing is available only for approved wholesale customers.",
          });

          continue;
        }
      }

      /*
       * Calculate authoritative price
       */

      const unitPrice =
        item.pricingType ===
        "wholesale"
          ? getWholesalePrice(
              wholesalePrice,
              wholesaleTiers,
              item.quantity
            )
          : retailPrice;

      if (
        unitPrice < 0
      ) {
        errors.push({
          productId:
            item.productId,
          sellerId:
            item.sellerId,
          message:
            "Invalid product price.",
        });

        continue;
      }

      const images =
        Array.isArray(
          product.images
        )
          ? product.images
              .filter(
                (
                  image
                ): image is string =>
                  typeof image ===
                  "string" &&
                  image.trim()
                    .length > 0
              )
          : [];

      validatedItems.push({
        productId:
          item.productId,

        sellerId:
          item.sellerId,

        sellerName:
          stringValue(
            product.sellerName
          ) ||
          "ANJIVO Seller",

        name:
          stringValue(
            product.name
          ) ||
          "Product",

        slug:
          stringValue(
            product.slug
          ),

        image:
          images[0] || "",

        quantity:
          item.quantity,

        pricingType:
          item.pricingType!,

        unitPrice,

        lineTotal:
          unitPrice *
          item.quantity,

        stock,

        moq,

        retailPrice,

        wholesalePrice,

        wholesaleTiers,
      });
    }

    /*
     * -----------------------------------------
     * 8. Return validation errors
     * -----------------------------------------
     */

    if (
      errors.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please review your cart before checkout.",
          errors,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 9. Seller-wise grouping
     * -----------------------------------------
     */

    const sellerGroups =
      new Map<
        string,
        {
          sellerId: string;
          sellerName: string;
          items: ValidatedItem[];
          subtotal: number;
        }
      >();

    for (
      const item of validatedItems
    ) {
      const existing =
        sellerGroups.get(
          item.sellerId
        );

      if (!existing) {
        sellerGroups.set(
          item.sellerId,
          {
            sellerId:
              item.sellerId,

            sellerName:
              item.sellerName,

            items: [item],

            subtotal:
              item.lineTotal,
          }
        );
      } else {
        existing.items.push(
          item
        );

        existing.subtotal +=
          item.lineTotal;
      }
    }

    /*
     * -----------------------------------------
     * 10. Calculate totals
     * -----------------------------------------
     */

    const subtotal =
      validatedItems.reduce(
        (sum, item) =>
          sum + item.lineTotal,
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
            sum + item.lineTotal,
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
            sum + item.lineTotal,
          0
        );

    /*
     * Shipping and discount will later
     * be calculated server-side from:
     *
     * - pincode
     * - shipping partner
     * - coupon
     * - seller rules
     * - promotion
     * - order value
     */

    const shippingCharge = 0;
    const discount = 0;

    const total =
      subtotal +
      shippingCharge -
      discount;

    /*
     * -----------------------------------------
     * 11. Response
     * -----------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        userId,

        items:
          validatedItems.map(
            (item) => ({
              productId:
                item.productId,

              sellerId:
                item.sellerId,

              sellerName:
                item.sellerName,

              name:
                item.name,

              slug:
                item.slug,

              image:
                item.image,

              quantity:
                item.quantity,

              pricingType:
                item.pricingType,

              unitPrice:
                item.unitPrice,

              lineTotal:
                item.lineTotal,

              moq:
                item.moq,

              stock:
                item.stock,
            })
          ),

        sellerGroups:
          Array.from(
            sellerGroups.values()
          ).map(
            (group) => ({
              sellerId:
                group.sellerId,

              sellerName:
                group.sellerName,

              subtotal:
                group.subtotal,

              items:
                group.items.map(
                  (item) => ({
                    productId:
                      item.productId,

                    name:
                      item.name,

                    quantity:
                      item.quantity,

                    pricingType:
                      item.pricingType,

                    unitPrice:
                      item.unitPrice,

                    lineTotal:
                      item.lineTotal,
                  })
                ),
            })
          ),

        subtotal,

        retailSubtotal,

        wholesaleSubtotal,

        shippingCharge,

        discount,

        total,

        validatedAt:
          Timestamp.now(),
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Checkout validation error:",
      error
    );

    const message =
      getErrorMessage(error);

    if (
      message ===
        "Authentication required." ||
      message ===
        "Authentication token missing."
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 401,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to validate checkout right now. Please try again.",
        error:
          process.env.NODE_ENV ===
          "development"
            ? message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}
